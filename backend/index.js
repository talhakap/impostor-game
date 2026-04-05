const express = require("express");
const http    = require("http");
const path    = require("path");
const { Server } = require("socket.io");
const cors    = require("cors");
const { getRandomWord } = require("./words");
const uno     = require("./uno");

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));
app.get("*splat", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

const rooms          = {};
const socketToRoom   = {};
const activeTimers   = {};
// Grace period timers for Impostor rooms only: socketId → setTimeout handle.
const disconnectTimers = {};
const GRACE_MS = 60_000; // 60 seconds — covers mobile tab suspension (Impostor only)

// ─── UNO round-end helper ─────────────────────────────────────────────────────
// Called whenever a round finishes. Awards 1 win, resets play state, and sends
// everyone straight back to the lobby so wins are visible immediately.
function endUnoRound(room, winnerId) {
  if (winnerId) {
    room.scores[winnerId] = (room.scores[winnerId] || 0) + 1;
    room.lastRoundWinnerId = winnerId;
  }
  // Keep turnOrder so seat positions stay consistent next game.
  // start_game will rotate it instead of re-randomising.
  room.phase            = "uno_lobby";
  room.hands            = null;
  room.drawPile         = null;
  room.discardPile      = null;
  room.currentColor     = null;
  room.direction        = 1;
  room.currentTurnIndex = 0;
  room.pendingDrawCount = 0;
  room.pendingDrawType  = null;
  room.saidUno          = {};
  room.roundWinnerId    = winnerId ?? null;
  room.drawnCardId      = null;
  room.chainValue       = null;
  room.chainType        = null;
  room.chainCount       = 0;
}

// ─── UNO player removal helper ────────────────────────────────────────────────
// Removes a player from the active UNO game state (turnOrder, hands, chain).
// Does NOT touch room.players or room.scores — callers handle that.
function removePlayerFromUno(room, playerId) {
  if (!room.hands) return; // not in play phase
  const wasTheirTurn = uno.getCurrentPlayerId(room) === playerId;
  const idx = room.turnOrder.indexOf(playerId);

  if (wasTheirTurn) {
    room.drawnCardId      = null;
    room.chainValue       = null;
    room.chainType        = null;
    room.chainCount       = 0;
    room.pendingDrawCount = 0;
    room.pendingDrawType  = null;
  }

  if (idx !== -1) {
    room.turnOrder.splice(idx, 1);
    if (room.turnOrder.length === 0) {
      // Everyone left — end the round with no winner
      endUnoRound(room, null);
      return;
    } else if (wasTheirTurn) {
      room.currentTurnIndex = idx % room.turnOrder.length;
    } else if (idx < room.currentTurnIndex) {
      room.currentTurnIndex = Math.max(0, room.currentTurnIndex - 1);
    } else {
      room.currentTurnIndex = Math.min(room.currentTurnIndex, room.turnOrder.length - 1);
    }
  }

  delete room.hands[playerId];
  if (room.saidUno) delete room.saidUno[playerId];

  // Auto-win if only one player left
  if (room.turnOrder.length === 1 && room.phase === "uno_playing") {
    endUnoRound(room, room.turnOrder[0]);
  }
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function generateRoomCode() {
  let code;
  do { code = Math.random().toString(36).substring(2, 8).toUpperCase(); }
  while (rooms[code]);
  return code;
}

function getConnectedPlayers(room) {
  return Object.values(room.players).filter((p) => p.isConnected);
}

function getActivePlayers(room) {
  return Object.values(room.players).filter((p) => p.isConnected && !p.isEliminated);
}

function clearTimer(roomCode) {
  if (activeTimers[roomCode]) {
    clearTimeout(activeTimers[roomCode]);
    delete activeTimers[roomCode];
  }
}

// ─── Impostor view builder ────────────────────────────────────────────────────

const REVEAL_PHASES = new Set([
  "all_answers", "revealing", "voting",
  "tiebreaker_answering", "tiebreaker_revealing", "tiebreaker_voting",
  "round_results", "game_over",
]);

function buildRoomView(room) {
  const showAll = REVEAL_PHASES.has(room.phase);
  const currentAnsweringPlayerId =
    room.playerAnswerOrder && room.currentAnsweringIndex < room.playerAnswerOrder.length
      ? room.playerAnswerOrder[room.currentAnsweringIndex]
      : null;
  return {
    code:           room.code,
    hostId:         room.hostId,
    phase:          room.phase,
    settings:       room.settings,
    answeringRound: room.answeringRound,
    timerEndsAt:    room.timerEndsAt,
    tiedPlayerIds:  room.tiedPlayerIds || [],
    tiebreakerCount: room.tiebreakerCount || 0,
    players: Object.values(room.players).map((p) => ({
      id:           p.id,
      name:         p.name,
      isHost:       p.id === room.hostId,
      isConnected:  p.isConnected,
      isEliminated: p.isEliminated,
      hasSubmitted: room.submissions ? p.id in room.submissions : false,
      hasVoted:     room.votes      ? p.id in room.votes       : false,
    })),
    allSubmissions: showAll ? room.allSubmissions : null,
    submittedIds:   Object.keys(room.submissions || {}),
    roundResults:   room.roundResults || null,
    // Sequential answering fields
    currentAnsweringPlayerId,
    revealedAnswers: room.revealedAnswers || {},
    playerAnswerOrder: room.playerAnswerOrder || [],
  };
}

// ─── Broadcast ────────────────────────────────────────────────────────────────

// UNO rooms require per-player broadcasts to protect private hand data.
// Impostor rooms broadcast a single shared view.
function broadcastRoom(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;
  if (room.gameType === "uno") {
    for (const playerId of Object.keys(room.players)) {
      io.to(playerId).emit("room:updated", uno.buildUnoView(room, playerId));
    }
  } else {
    io.to(roomCode).emit("room:updated", buildRoomView(room));
  }
}

// ─── Impostor game logic ──────────────────────────────────────────────────────

function assignRoles(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;

  const wordEntry = getRandomWord();
  room.currentWord     = wordEntry.word;
  room.currentCategory = wordEntry.category;
  room.currentHint     = wordEntry.hint;
  room.allSubmissions  = {};
  room.submissions     = {};
  room.votes           = {};
  room.roundResults    = null;
  room.answeringRound  = 1;
  room.tiedPlayerIds   = [];
  room.pendingEliminations = [];
  room.tiebreakerCount = 0;

  const active    = getActivePlayers(room);
  const activeIds = active.map((p) => p.id);
  // Fisher-Yates shuffle for unbiased impostor selection
  const shuffled  = [...activeIds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const impostorCount = Math.min(room.settings.impostorCount, activeIds.length - 1);
  const impostors = new Set(shuffled.slice(0, impostorCount));

  room.roles = {};
  activeIds.forEach((id) => { room.roles[id] = impostors.has(id) ? "impostor" : "normal"; });

  // Sequential answering order — randomised separately from impostor assignment
  const answerOrder = [...activeIds];
  for (let i = answerOrder.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [answerOrder[i], answerOrder[j]] = [answerOrder[j], answerOrder[i]];
  }
  room.playerAnswerOrder     = answerOrder;
  room.currentAnsweringIndex = 0;
  room.revealedAnswers       = {};

  activeIds.forEach((id) => {
    const role = room.roles[id];
    io.to(id).emit("player:role_assigned", {
      role,
      word:     role === "normal" ? wordEntry.word : null,
      category: wordEntry.category,
    });
  });
}

function startPlayerAnswering(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;
  room.submissions = {};
  room.phase       = "player_answering";
  room.timerEndsAt = Date.now() + room.settings.roundDurationSecs * 1000;
  clearTimer(roomCode);
  activeTimers[roomCode] = setTimeout(
    () => advanceToNextPlayer(roomCode),
    room.settings.roundDurationSecs * 1000
  );
  broadcastRoom(roomCode);
}

function advanceToNextPlayer(roomCode) {
  const room = rooms[roomCode];
  if (!room || room.phase !== "player_answering") return;
  clearTimer(roomCode);

  // If current player didn't answer (timed out), store empty string
  const currentPlayerId = room.playerAnswerOrder[room.currentAnsweringIndex];
  if (currentPlayerId && !(currentPlayerId in room.revealedAnswers)) {
    room.revealedAnswers[currentPlayerId] = "";
  }

  room.currentAnsweringIndex++;

  // Skip eliminated or missing players
  while (
    room.currentAnsweringIndex < room.playerAnswerOrder.length &&
    (
      room.players[room.playerAnswerOrder[room.currentAnsweringIndex]]?.isEliminated ||
      !room.players[room.playerAnswerOrder[room.currentAnsweringIndex]]
    )
  ) {
    room.currentAnsweringIndex++;
  }

  if (room.currentAnsweringIndex >= room.playerAnswerOrder.length) {
    // All players answered — move to review screen
    room.allSubmissions = { round_1: { ...room.revealedAnswers } };
    room.phase          = "all_answers";
    room.timerEndsAt    = null;
    broadcastRoom(roomCode);
    return;
  }

  // Start next player's turn
  room.timerEndsAt = Date.now() + room.settings.roundDurationSecs * 1000;
  activeTimers[roomCode] = setTimeout(
    () => advanceToNextPlayer(roomCode),
    room.settings.roundDurationSecs * 1000
  );
  broadcastRoom(roomCode);
}

function startTiebreaker(roomCode, pendingEliminations, tiedCandidates) {
  const room = rooms[roomCode];
  room.pendingEliminations = pendingEliminations;
  room.tiedPlayerIds  = tiedCandidates;
  room.tiebreakerCount = (room.tiebreakerCount || 0) + 1;
  room.votes       = {};
  room.submissions = {};
  room.phase       = "tiebreaker_answering";
  room.timerEndsAt = Date.now() + 30 * 1000;
  clearTimer(roomCode);
  activeTimers[roomCode] = setTimeout(() => advanceTiebreakerToReveal(roomCode), 30 * 1000);
  broadcastRoom(roomCode);
}

function advanceTiebreakerToReveal(roomCode) {
  const room = rooms[roomCode];
  if (!room || room.phase !== "tiebreaker_answering") return;
  clearTimer(roomCode);
  room.allSubmissions[`tb_${room.tiebreakerCount}`] = { ...room.submissions };
  room.submissions = {};
  room.phase       = "tiebreaker_revealing";
  room.timerEndsAt = null;
  broadcastRoom(roomCode);
}

function finalizeEliminations(roomCode, eliminatedIds, voteCounts, voteMap) {
  const room = rooms[roomCode];
  eliminatedIds.forEach((id) => { if (room.players[id]) room.players[id].isEliminated = true; });

  const surviving         = Object.values(room.players).filter((p) => !p.isEliminated);
  const survivingImpostors = surviving.filter((p) => room.roles[p.id] === "impostor");
  const survivingCrew     = surviving.filter((p) => room.roles[p.id] === "normal");

  let winner = null;
  if (survivingImpostors.length === 0) winner = "crew";
  else if (survivingCrew.length === 0) winner = "impostors";

  room.roundResults = {
    voteMap:        { ...voteMap },
    voteCounts:     { ...voteCounts },
    eliminatedIds,
    eliminatedNames: eliminatedIds.map((id) => room.players[id]?.name),
    impostorIds:   Object.keys(room.roles).filter((id) => room.roles[id] === "impostor"),
    impostorNames: Object.keys(room.roles)
      .filter((id) => room.roles[id] === "impostor")
      .map((id) => room.players[id]?.name),
    word:     room.currentWord,
    category: room.currentCategory,
    winner,
  };

  room.phase       = "round_results";
  room.timerEndsAt = null;
  broadcastRoom(roomCode);
}

function tallyVotesAndFinish(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;

  const isRegular    = room.phase === "voting";
  const isTiebreaker = room.phase === "tiebreaker_voting";
  if (!isRegular && !isTiebreaker) return;

  const candidates = isRegular
    ? getActivePlayers(room).map((p) => p.id)
    : room.tiedPlayerIds || [];

  const voteCounts = {};
  candidates.forEach((id) => { voteCounts[id] = 0; });
  Object.entries(room.votes).forEach(([, targetId]) => {
    if (voteCounts[targetId] !== undefined) voteCounts[targetId]++;
  });

  if (isRegular) {
    const N = Math.min(room.settings.impostorCount, candidates.length - 1);
    if (N === 0) { finalizeEliminations(roomCode, [], voteCounts, room.votes); return; }

    const sorted   = [...candidates].sort((a, b) => voteCounts[b] - voteCounts[a]);
    const nthVotes = voteCounts[sorted[N - 1]];
    const nextVotes = sorted.length > N ? voteCounts[sorted[N]] : -1;

    if (nthVotes === nextVotes) {
      const aboveBoundary = sorted.filter((id) => voteCounts[id] > nthVotes);
      const atBoundary    = sorted.filter((id) => voteCounts[id] === nthVotes);
      startTiebreaker(roomCode, aboveBoundary, atBoundary);
    } else {
      finalizeEliminations(roomCode, sorted.slice(0, N), voteCounts, room.votes);
    }
  } else {
    const sorted   = [...candidates].sort((a, b) => voteCounts[b] - voteCounts[a]);
    const maxVotes = voteCounts[sorted[0]];
    const topTied  = sorted.filter((id) => voteCounts[id] === maxVotes);

    if (topTied.length > 1) {
      startTiebreaker(roomCode, room.pendingEliminations, topTied);
    } else {
      const allEliminated = [...(room.pendingEliminations || []), sorted[0]];
      finalizeEliminations(roomCode, allEliminated, voteCounts, room.votes);
    }
  }
}

function checkAllSubmitted(roomCode) {
  const room = rooms[roomCode];
  if (!room || room.phase !== "tiebreaker_answering") return;
  const active = getActivePlayers(room);
  if (active.every((p) => p.id in room.submissions)) advanceTiebreakerToReveal(roomCode);
}

function checkAllVoted(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;
  if (room.phase !== "voting" && room.phase !== "tiebreaker_voting") return;
  const active = getActivePlayers(room);
  if (active.every((p) => p.id in room.votes)) tallyVotesAndFinish(roomCode);
}

// ─── Socket handlers ──────────────────────────────────────────────────────────

io.on("connection", (socket) => {
  console.log(`[+] ${socket.id} connected`);

  // ── Room creation ──────────────────────────────────────────────────────────

  socket.on("room:create", ({ playerName, gameType }, callback) => {
    if (!playerName?.trim()) return callback({ error: "Name required" });
    const type = gameType === "uno" ? "uno" : "impostor";
    const code = generateRoomCode();

    const baseRoom = {
      code,
      hostId:    socket.id,
      gameType:  type,
      createdAt: Date.now(),
      players: {
        [socket.id]: {
          id: socket.id,
          name: playerName.trim().slice(0, 20),
          isConnected: true,
          isEliminated: false,
        },
      },
    };

    if (type === "uno") {
      rooms[code] = {
        ...baseRoom,
        phase:            "uno_lobby",
        roundNumber:      1,
        scores:           { [socket.id]: 0 },
        hands:            null,
        drawPile:         null,
        discardPile:      null,
        turnOrder:        [],
        currentColor:     null,
        direction:        1,
        currentTurnIndex: 0,
        pendingDrawCount: 0,
        pendingDrawType:  null,
        saidUno:          {},
        roundWinnerId:    null,
        gameWinnerId:     null,
        drawnCardId:      null,
        chainValue:       null,
        chainType:        null,
        chainCount:       0,
      };
    } else {
      rooms[code] = {
        ...baseRoom,
        phase:          "lobby",
        answeringRound: 1,
        settings: { impostorCount: 1, roundDurationSecs: 60 },
        roles: {}, submissions: {}, votes: {}, allSubmissions: {},
        currentWord: null, currentCategory: null,
        timerEndsAt: null, roundResults: null,
        tiedPlayerIds: [], pendingEliminations: [], tiebreakerCount: 0,
      };
    }

    socketToRoom[socket.id] = code;
    socket.join(code);
    callback({ code });
    broadcastRoom(code);
  });

  // ── Room join ──────────────────────────────────────────────────────────────

  socket.on("room:join", ({ code, playerName }, callback) => {
    const upperCode = code?.toUpperCase();
    const room      = rooms[upperCode];
    if (!room) return callback({ error: "Room not found" });

    const isJoinable = room.phase === "lobby" || room.phase === "uno_lobby";
    if (!isJoinable) return callback({ error: "Game already in progress" });
    if (Object.keys(room.players).length >= 20) return callback({ error: "Room is full" });
    if (!playerName?.trim()) return callback({ error: "Name required" });

    const nameExists = Object.values(room.players).some(
      (p) => p.name.toLowerCase() === playerName.trim().toLowerCase()
    );
    if (nameExists) return callback({ error: "Name already taken in this room" });

    room.players[socket.id] = {
      id: socket.id,
      name: playerName.trim().slice(0, 20),
      isConnected:  true,
      isEliminated: false,
    };
    if (room.gameType === "uno") {
      room.scores[socket.id] = 0;
    }

    socketToRoom[socket.id] = upperCode;
    socket.join(upperCode);
    callback({ code: upperCode });
    broadcastRoom(upperCode);
  });

  // ── Impostor: lobby settings ───────────────────────────────────────────────

  socket.on("host:update_settings", ({ impostorCount, roundDurationSecs }) => {
    const code = socketToRoom[socket.id];
    const room = rooms[code];
    if (!room || room.hostId !== socket.id || room.phase !== "lobby") return;
    const playerCount = Object.keys(room.players).length;
    if (impostorCount !== undefined)
      room.settings.impostorCount = Math.max(1, Math.min(Number(impostorCount), playerCount - 1));
    if (roundDurationSecs !== undefined)
      room.settings.roundDurationSecs = Math.max(15, Math.min(300, Number(roundDurationSecs)));
    broadcastRoom(code);
  });

  // ── Impostor: start game ───────────────────────────────────────────────────

  socket.on("host:start_game", () => {
    const code = socketToRoom[socket.id];
    const room = rooms[code];
    if (!room || room.hostId !== socket.id || room.phase !== "lobby") return;
    if (getConnectedPlayers(room).length < 2) {
      socket.emit("error", { message: "Need at least 2 players to start" });
      return;
    }
    room.phase = "assigning_roles";
    broadcastRoom(code);
    setTimeout(() => {
      if (!rooms[code]) return;
      assignRoles(code);
      startPlayerAnswering(code);
    }, 1500);
  });

  // ── Impostor: kick player ──────────────────────────────────────────────────

  socket.on("host:kick_player", ({ playerId }) => {
    const code = socketToRoom[socket.id];
    const room = rooms[code];
    if (!room || room.hostId !== socket.id) return;
    if (playerId === socket.id || !room.players[playerId]) return;

    io.to(playerId).emit("kicked");
    delete room.players[playerId];
    if (socketToRoom[playerId] === code) delete socketToRoom[playerId];

    // UNO: also clean up game state
    if (room.gameType === "uno") {
      delete room.scores[playerId];
      if (room.phase === "uno_playing") removePlayerFromUno(room, playerId);
      else if (room.hands) { delete room.hands[playerId]; delete room.saidUno?.[playerId]; }
    }

    broadcastRoom(code);
  });

  // ── Impostor: proceed from all_answers to voting ──────────────────────────

  socket.on("host:proceed_to_vote", () => {
    const code = socketToRoom[socket.id];
    const room = rooms[code];
    if (!room || room.hostId !== socket.id || room.phase !== "all_answers") return;
    room.votes = {};
    room.phase = "voting";
    broadcastRoom(code);
  });

  // ── Impostor: submit answer ────────────────────────────────────────────────

  socket.on("player:submit_answer", ({ answer }) => {
    const code = socketToRoom[socket.id];
    const room = rooms[code];
    if (!room) return;

    if (room.phase === "player_answering") {
      // Only the current answering player may submit
      const currentId = room.playerAnswerOrder[room.currentAnsweringIndex];
      if (socket.id !== currentId) return;
      if (socket.id in room.revealedAnswers) return;
      const trimmed = (answer || "").trim().slice(0, 200);
      if (!trimmed) return;
      room.revealedAnswers[socket.id] = trimmed;
      broadcastRoom(code); // show answer to all
      advanceToNextPlayer(code);
      return;
    }

    if (room.phase === "tiebreaker_answering") {
      if (room.players[socket.id]?.isEliminated) return;
      if (socket.id in room.submissions) return;
      const trimmed = (answer || "").trim().slice(0, 200);
      if (!trimmed) return;
      room.submissions[socket.id] = trimmed;
      broadcastRoom(code);
      checkAllSubmitted(code);
      return;
    }
  });

  // ── Impostor: advance to voting ────────────────────────────────────────────

  socket.on("host:advance_to_voting", () => {
    const code = socketToRoom[socket.id];
    const room = rooms[code];
    if (!room || room.hostId !== socket.id) return;
    if (room.phase === "revealing") {
      room.votes = {};
      room.phase = "voting";
      broadcastRoom(code);
    } else if (room.phase === "tiebreaker_revealing") {
      room.votes = {};
      room.phase = "tiebreaker_voting";
      broadcastRoom(code);
    }
  });

  // ── Impostor: submit vote ──────────────────────────────────────────────────

  socket.on("player:submit_vote", ({ targetId }) => {
    const code = socketToRoom[socket.id];
    const room = rooms[code];
    if (!room) return;
    if (room.phase !== "voting" && room.phase !== "tiebreaker_voting") return;
    if (room.players[socket.id]?.isEliminated) return;
    if (socket.id in room.votes) return;
    if (socket.id === targetId) return;

    if (room.phase === "voting") {
      if (!room.players[targetId] || room.players[targetId].isEliminated) return;
    } else {
      if (!room.tiedPlayerIds.includes(targetId)) return;
    }

    room.votes[socket.id] = targetId;
    broadcastRoom(code);
    checkAllVoted(code);
  });

  // ── Impostor: next round / play again ──────────────────────────────────────

  socket.on("host:next_round", () => {
    const code = socketToRoom[socket.id];
    const room = rooms[code];
    if (!room || room.hostId !== socket.id || room.phase !== "round_results") return;
    room.phase = "game_over";
    broadcastRoom(code);
  });

  socket.on("host:play_again", () => {
    const code = socketToRoom[socket.id];
    const room = rooms[code];
    if (!room || room.hostId !== socket.id || room.phase !== "game_over") return;
    Object.values(room.players).forEach((p) => { p.isEliminated = false; });
    room.phase = "lobby";
    room.roles = {}; room.submissions = {}; room.votes = {}; room.allSubmissions = {};
    room.roundResults = null; room.timerEndsAt = null;
    room.tiedPlayerIds = []; room.pendingEliminations = [];
    room.tiebreakerCount = 0; room.answeringRound = 1;
    room.playerAnswerOrder = []; room.currentAnsweringIndex = 0; room.revealedAnswers = {};
    clearTimer(code);
    broadcastRoom(code);
  });

  // ── UNO: start game ────────────────────────────────────────────────────────

  socket.on("uno:start_game", () => {
    const code = socketToRoom[socket.id];
    const room = rooms[code];
    if (!room || room.gameType !== "uno") return;
    if (room.hostId !== socket.id) return socket.emit("error", { message: "Only the host can start" });
    if (room.phase !== "uno_lobby") return;

    const connected = getConnectedPlayers(room);
    if (connected.length < 2) return socket.emit("error", { message: "Need at least 2 players to start" });

    const connectedIds = connected.map((p) => p.id);
    const prev = room.turnOrder ?? [];
    // If the exact same set of players is in the previous turn order, rotate
    // by one so seat positions stay consistent across rounds.
    if (prev.length === connectedIds.length && connectedIds.every((id) => prev.includes(id))) {
      room.turnOrder = [...prev.slice(1), prev[0]];
    } else {
      // New players or first game — randomise
      room.turnOrder = connectedIds.sort(() => Math.random() - 0.5);
    }
    for (const pid of room.turnOrder) {
      if (!(pid in room.scores)) room.scores[pid] = 0;
    }

    room.phase = "uno_playing";
    uno.dealCards(room);
    broadcastRoom(code);
  });

  // ── UNO: play a card ───────────────────────────────────────────────────────

  socket.on("uno:play_card", ({ cardId, chosenColor }) => {
    const code = socketToRoom[socket.id];
    const room = rooms[code];
    if (!room || room.gameType !== "uno") return;
    if (room.phase !== "uno_playing")
      return socket.emit("error", { message: "Not in play phase" });
    if (uno.getCurrentPlayerId(room) !== socket.id)
      return socket.emit("error", { message: "It's not your turn" });

    const hand = room.hands[socket.id];
    if (!hand) return;
    const cardIdx = hand.findIndex((c) => c.id === cardId);
    if (cardIdx === -1)
      return socket.emit("error", { message: "Card not found in your hand" });

    const card    = hand[cardIdx];
    const topCard = room.discardPile[room.discardPile.length - 1];

    // If a card was drawn this turn, only that card may be played
    if (room.drawnCardId && cardId !== room.drawnCardId)
      return socket.emit("error", { message: "You must play the drawn card or pass your turn" });

    // Chain validation
    if (room.chainValue !== null) {
      // Number chain — must match value or be wild
      const isChainable = card.color === "wild" ||
        (card.type === "number" && card.value === room.chainValue);
      if (!isChainable)
        return socket.emit("error", { message: "End your turn or play a matching number" });
    } else if (room.chainType !== null) {
      // Action chain — must be same type
      if (card.type !== room.chainType)
        return socket.emit("error", { message: `Play another ${room.chainType} or pass` });
    } else {
      // Normal validation (includes draw-stack restriction)
      if (!uno.isValidPlay(card, topCard, room.currentColor, room.pendingDrawCount, room.pendingDrawType))
        return socket.emit("error", { message: "That card cannot be played right now" });
    }

    if (card.type === "wild" || card.type === "wild_draw_four") {
      if (!["red", "green", "blue", "yellow"].includes(chosenColor))
        return socket.emit("error", { message: "Choose a valid color: red, green, blue, or yellow" });
    }

    // Remove from hand, place on discard pile
    hand.splice(cardIdx, 1);
    room.discardPile.push(card);
    room.drawnCardId = null;

    if (hand.length !== 1) room.saidUno[socket.id] = false;

    // Win condition
    if (hand.length === 0) {
      room.chainValue = null;
      room.chainType  = null;
      room.chainCount = 0;
      endUnoRound(room, socket.id);
      broadcastRoom(code);
      return;
    }

    // ── Number chain ──────────────────────────────────────────────────────
    if (card.type === "number") {
      const hasMoreSameValue = hand.some((c) => c.type === "number" && c.value === card.value);
      if (hasMoreSameValue) {
        room.chainValue   = card.value;
        room.currentColor = card.color;
        broadcastRoom(code);
        return;
      }
      // Chain done — fall through to applyCardEffect
      room.chainValue = null;
      uno.applyCardEffect(room, card, null);
      broadcastRoom(code);
      return;
    }

    // ── Skip chain ────────────────────────────────────────────────────────
    // Each skip skips one additional player. Accumulate until no more skips
    // in hand (or player passes). Effect applied at end of chain.
    if (card.type === "skip") {
      room.currentColor = card.color;
      room.chainType    = "skip";
      room.chainCount   = (room.chainCount || 0) + 1;
      if (hand.some((c) => c.type === "skip")) {
        broadcastRoom(code);
        return;
      }
      // No more skips — apply: advance by (chainCount + 1) to skip chainCount players
      const skips = room.chainCount;
      room.chainType  = null;
      room.chainCount = 0;
      uno.advanceTurn(room, skips + 1);
      broadcastRoom(code);
      return;
    }

    // ── Reverse chain ─────────────────────────────────────────────────────
    // Each reverse immediately flips direction so the arrow updates live.
    // At chain end, advance 1 in whatever the final direction is.
    if (card.type === "reverse") {
      room.currentColor = card.color;
      room.direction   *= -1; // flip immediately — visible to all clients
      room.chainType    = "reverse";
      room.chainCount   = (room.chainCount || 0) + 1;
      if (room.turnOrder.length === 2 || !hand.some((c) => c.type === "reverse")) {
        // 2-player: each reverse is a skip, so apply immediately rather than chain
        // Any player count: no more reverses — apply final advance
        const count     = room.chainCount;
        room.chainType  = null;
        room.chainCount = 0;
        const twoPlayer = room.turnOrder.length === 2;
        // 2-player: odd count = go again (advance 2), even = normal advance 1
        uno.advanceTurn(room, twoPlayer && count % 2 === 1 ? 2 : 1);
      }
      broadcastRoom(code);
      return;
    }

    // ── Wild / draw cards — apply effect normally ─────────────────────────
    room.chainValue = null;
    room.chainType  = null;
    room.chainCount = 0;
    uno.applyCardEffect(room, card, chosenColor ?? null);
    broadcastRoom(code);
  });

  // ── UNO: draw a card ───────────────────────────────────────────────────────
  // Draw one card. If it's immediately playable, stay on this player's turn
  // so they can play it. If it's not playable, auto-advance the turn.

  socket.on("uno:draw_card", () => {
    const code = socketToRoom[socket.id];
    const room = rooms[code];
    if (!room || room.gameType !== "uno") return;
    if (room.phase !== "uno_playing") return;
    if (uno.getCurrentPlayerId(room) !== socket.id)
      return socket.emit("error", { message: "It's not your turn" });

    // Cannot draw while already holding a drawn card or mid-chain
    if (room.drawnCardId)
      return socket.emit("error", { message: "Play the drawn card or pass your turn" });
    if (room.chainValue !== null)
      return socket.emit("error", { message: "End your turn or play a matching number" });
    if (room.chainType !== null)
      return socket.emit("error", { message: "Play another card or pass your turn" });

    // ── Active draw stack: player must draw the full accumulated penalty ──────
    if (room.pendingDrawCount > 0) {
      uno.drawCards(room, socket.id, room.pendingDrawCount);
      room.saidUno[socket.id] = false;
      room.pendingDrawCount   = 0;
      room.pendingDrawType    = null;
      uno.advanceTurn(room, 1);
      broadcastRoom(code);
      return;
    }

    // ── Normal single draw ────────────────────────────────────────────────────
    uno.drawCards(room, socket.id, 1);
    room.saidUno[socket.id] = false;

    const drawnCard = room.hands[socket.id][room.hands[socket.id].length - 1];
    const topCard   = room.discardPile[room.discardPile.length - 1];

    if (uno.isValidPlay(drawnCard, topCard, room.currentColor, 0, null)) {
      // Playable — stay on turn, highlight this card only
      room.drawnCardId = drawnCard.id;
    } else {
      // Not playable — auto-advance
      room.drawnCardId = null;
      uno.advanceTurn(room, 1);
    }
    broadcastRoom(code);
  });

  // ── UNO: pass turn ─────────────────────────────────────────────────────────
  // Used after drawing an unplayable card OR to end a same-value chain early.

  socket.on("uno:pass_turn", () => {
    const code = socketToRoom[socket.id];
    const room = rooms[code];
    if (!room || room.gameType !== "uno") return;
    if (room.phase !== "uno_playing") return;
    if (uno.getCurrentPlayerId(room) !== socket.id)
      return socket.emit("error", { message: "It's not your turn" });

    if (!room.drawnCardId && room.chainValue === null && room.chainType === null)
      return socket.emit("error", { message: "Nothing to pass" });

    if (room.chainType === "skip") {
      const skips     = room.chainCount;
      room.chainType  = null;
      room.chainCount = 0;
      uno.advanceTurn(room, skips + 1);
    } else if (room.chainType === "reverse") {
      // Direction already flipped incrementally; just advance
      const count     = room.chainCount;
      room.chainType  = null;
      room.chainCount = 0;
      const twoPlayer = room.turnOrder.length === 2;
      uno.advanceTurn(room, twoPlayer && count % 2 === 1 ? 2 : 1);
    } else {
      room.drawnCardId = null;
      room.chainValue  = null;
      uno.advanceTurn(room, 1);
    }
    broadcastRoom(code);
  });

  // ── UNO: say UNO ──────────────────────────────────────────────────────────

  socket.on("uno:say_uno", () => {
    const code = socketToRoom[socket.id];
    const room = rooms[code];
    if (!room || room.gameType !== "uno" || room.phase !== "uno_playing") return;
    if (room.hands[socket.id]?.length === 1) {
      room.saidUno[socket.id] = true;
      broadcastRoom(code);
    }
  });

  // ── UNO: challenge a player who forgot to say UNO ─────────────────────────

  socket.on("uno:challenge_uno", ({ targetId }) => {
    const code = socketToRoom[socket.id];
    const room = rooms[code];
    if (!room || room.gameType !== "uno" || room.phase !== "uno_playing") return;
    if (!room.hands[targetId] || room.hands[targetId].length !== 1) return;
    if (room.saidUno[targetId])
      return socket.emit("error", { message: "They already said UNO!" });

    uno.drawCards(room, targetId, 2);
    room.saidUno[targetId] = false;
    broadcastRoom(code);
  });


  // ── Rejoin (player returning after tab-switch / mobile suspend) ───────────

  socket.on("room:rejoin", ({ code, playerName }, callback) => {
    const upperCode = code?.toUpperCase();
    const room      = rooms[upperCode];
    if (!room) return callback({ error: "Room not found" });

    // Find the disconnected slot that matches this name
    const existing = Object.values(room.players).find(
      (p) => !p.isConnected && p.name.toLowerCase() === playerName?.trim().toLowerCase()
    );
    if (!existing) return callback({ error: "No disconnected player found with that name" });

    const oldId = existing.id;

    // Cancel the pending grace-period eviction
    if (disconnectTimers[oldId]) {
      clearTimeout(disconnectTimers[oldId]);
      delete disconnectTimers[oldId];
    }

    // Re-key the player under the new socket id
    delete room.players[oldId];
    existing.id          = socket.id;
    existing.isConnected = true;
    room.players[socket.id] = existing;

    // Update socketToRoom mapping
    delete socketToRoom[oldId];
    socketToRoom[socket.id] = upperCode;
    socket.join(upperCode);

    // Transfer host ownership if they were the host
    if (room.hostId === oldId) room.hostId = socket.id;

    // UNO: re-key hand and saidUno
    if (room.gameType === "uno" && room.hands) {
      if (room.hands[oldId] !== undefined) {
        room.hands[socket.id]   = room.hands[oldId];
        room.saidUno[socket.id] = room.saidUno[oldId] ?? false;
        delete room.hands[oldId];
        delete room.saidUno[oldId];
      }
      // Fix turn order reference
      const ti = room.turnOrder.indexOf(oldId);
      if (ti !== -1) room.turnOrder[ti] = socket.id;
    }

    // UNO: fix scores key
    if (room.gameType === "uno" && room.scores) {
      if (room.scores[oldId] !== undefined) {
        room.scores[socket.id] = room.scores[oldId];
        delete room.scores[oldId];
      }
    }

    // Impostor: re-key roles, submissions, votes
    if (room.gameType !== "uno") {
      if (room.roles?.[oldId] !== undefined) {
        room.roles[socket.id] = room.roles[oldId];
        delete room.roles[oldId];
      }
      if (room.submissions?.[oldId] !== undefined) {
        room.submissions[socket.id] = room.submissions[oldId];
        delete room.submissions[oldId];
      }
      if (room.votes?.[oldId] !== undefined) {
        room.votes[socket.id] = room.votes[oldId];
        delete room.votes[oldId];
      }
      // Fix any votes that were cast FOR the old id
      for (const voter of Object.keys(room.votes || {})) {
        if (room.votes[voter] === oldId) room.votes[voter] = socket.id;
      }
      // Re-key revealedAnswers
      if (room.revealedAnswers?.[oldId] !== undefined) {
        room.revealedAnswers[socket.id] = room.revealedAnswers[oldId];
        delete room.revealedAnswers[oldId];
      }
      // Re-key playerAnswerOrder
      if (room.playerAnswerOrder) {
        const pi = room.playerAnswerOrder.indexOf(oldId);
        if (pi !== -1) room.playerAnswerOrder[pi] = socket.id;
      }
      // Re-send private role data for Impostor
      if (room.roles?.[socket.id]) {
        const role = room.roles[socket.id];
        io.to(socket.id).emit("player:role_assigned", {
          role,
          word:     role === "normal" ? room.currentWord : null,
          category: room.currentCategory,
        });
      }
    }

    console.log(`[~] ${oldId} rejoined as ${socket.id} (${existing.name})`);
    callback({ code: upperCode });
    broadcastRoom(upperCode);
  });

  // ── Disconnect ─────────────────────────────────────────────────────────────

  socket.on("disconnect", () => {
    console.log(`[-] ${socket.id} disconnected`);
    const code = socketToRoom[socket.id];
    if (!code || !rooms[code]) return;
    const room   = rooms[code];
    const player = room.players[socket.id];
    if (!player) return;

    delete socketToRoom[socket.id];

    // ── UNO: kick immediately, no grace period ────────────────────────────
    if (room.gameType === "uno") {
      delete room.players[socket.id];
      delete room.scores[socket.id];

      const remaining = getConnectedPlayers(room);
      if (remaining.length === 0) { delete rooms[code]; return; }

      if (room.hostId === socket.id) room.hostId = remaining[0].id;

      if (room.phase === "uno_playing") removePlayerFromUno(room, socket.id);
      else if (room.hands) { delete room.hands[socket.id]; delete room.saidUno?.[socket.id]; }

      broadcastRoom(code);
      return;
    }

    // ── Impostor: mark offline + start grace period ───────────────────────
    player.isConnected = false;
    broadcastRoom(code);

    disconnectTimers[socket.id] = setTimeout(() => {
      delete disconnectTimers[socket.id];

      const r = rooms[code];
      if (!r || !r.players[socket.id]) return;

      const stillConnected = getConnectedPlayers(r);
      if (stillConnected.length === 0) {
        clearTimer(code);
        delete rooms[code];
        return;
      }

      if (r.hostId === socket.id) {
        const nextHost = stillConnected.find((p) => !p.isEliminated) || stillConnected[0];
        r.hostId = nextHost.id;
      }

      broadcastRoom(code);

      if (r.phase === "player_answering") {
        // If disconnected player was the current answerer, skip them
        const currentId = r.playerAnswerOrder[r.currentAnsweringIndex];
        if (currentId === socket.id) advanceToNextPlayer(code);
      }
      if (r.phase === "tiebreaker_answering") checkAllSubmitted(code);
      if (r.phase === "voting"    || r.phase === "tiebreaker_voting")    checkAllVoted(code);
    }, GRACE_MS);
  });
});

// ─── Stale room cleanup ───────────────────────────────────────────────────────

setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const code of Object.keys(rooms)) {
    if (rooms[code].createdAt < cutoff) {
      clearTimer(code);
      delete rooms[code];
    }
  }
}, 10 * 60 * 1000);

server.listen(3001, () => console.log("Backend running on http://localhost:3001"));
