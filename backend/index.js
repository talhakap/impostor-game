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
// Grace period timers: socketId → setTimeout handle.
// When a player disconnects we wait GRACE_MS before treating it as permanent.
const disconnectTimers = {};
const GRACE_MS = 60_000; // 60 seconds — covers mobile tab suspension

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
  "round_complete", "revealing", "voting",
  "tiebreaker_answering", "tiebreaker_revealing", "tiebreaker_voting",
  "round_results", "game_over",
]);

function buildRoomView(room) {
  const showAll = REVEAL_PHASES.has(room.phase);
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
  const shuffled  = [...activeIds].sort(() => Math.random() - 0.5);
  const impostorCount = Math.min(room.settings.impostorCount, activeIds.length - 1);
  const impostors = new Set(shuffled.slice(0, impostorCount));

  room.roles = {};
  activeIds.forEach((id) => { room.roles[id] = impostors.has(id) ? "impostor" : "normal"; });

  activeIds.forEach((id) => {
    const role = room.roles[id];
    io.to(id).emit("player:role_assigned", {
      role,
      word:     role === "normal" ? wordEntry.word : null,
      category: wordEntry.category,
    });
  });
}

function startAnsweringPhase(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;
  room.submissions  = {};
  room.phase        = "answering";
  room.timerEndsAt  = Date.now() + room.settings.roundDurationSecs * 1000;
  clearTimer(roomCode);
  activeTimers[roomCode] = setTimeout(
    () => advanceAnsweringRound(roomCode),
    room.settings.roundDurationSecs * 1000
  );
  broadcastRoom(roomCode);
}

function advanceAnsweringRound(roomCode) {
  const room = rooms[roomCode];
  if (!room || room.phase !== "answering") return;
  clearTimer(roomCode);
  room.allSubmissions[`round_${room.answeringRound}`] = { ...room.submissions };
  room.submissions = {};
  room.phase       = "round_complete";
  room.timerEndsAt = null;
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
  if (!room) return;
  const active = getActivePlayers(room);
  if (room.phase === "answering") {
    if (active.every((p) => p.id in room.submissions)) advanceAnsweringRound(roomCode);
  } else if (room.phase === "tiebreaker_answering") {
    if (active.every((p) => p.id in room.submissions)) advanceTiebreakerToReveal(roomCode);
  }
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
        saidUno:          {},
        roundWinnerId:    null,
        gameWinnerId:     null,
        drawnCardId:      null,
        chainValue:       null,
      };
    } else {
      rooms[code] = {
        ...baseRoom,
        phase:          "lobby",
        answeringRound: 1,
        settings: { impostorCount: 1, roundDurationSecs: 60, totalRounds: 2 },
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
    if (Object.keys(room.players).length >= 10) return callback({ error: "Room is full" });
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

  socket.on("host:update_settings", ({ impostorCount, roundDurationSecs, totalRounds }) => {
    const code = socketToRoom[socket.id];
    const room = rooms[code];
    if (!room || room.hostId !== socket.id || room.phase !== "lobby") return;
    const playerCount = Object.keys(room.players).length;
    if (impostorCount !== undefined)
      room.settings.impostorCount = Math.max(1, Math.min(Number(impostorCount), playerCount - 1));
    if (roundDurationSecs !== undefined)
      room.settings.roundDurationSecs = Math.max(15, Math.min(300, Number(roundDurationSecs)));
    if (totalRounds !== undefined)
      room.settings.totalRounds = Math.max(1, Math.min(10, Number(totalRounds)));
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
      startAnsweringPhase(code);
    }, 1500);
  });

  // ── Impostor: kick player ──────────────────────────────────────────────────

  socket.on("host:kick_player", ({ playerId }) => {
    const code = socketToRoom[socket.id];
    const room = rooms[code];
    if (!room || room.hostId !== socket.id || room.phase !== "lobby") return;
    if (playerId === socket.id || !room.players[playerId]) return;
    io.to(playerId).emit("kicked");
    delete room.players[playerId];
    if (socketToRoom[playerId] === code) delete socketToRoom[playerId];
    broadcastRoom(code);
  });

  // ── Impostor: advance answering round ─────────────────────────────────────

  socket.on("host:advance_round", () => {
    const code = socketToRoom[socket.id];
    const room = rooms[code];
    if (!room || room.hostId !== socket.id || room.phase !== "round_complete") return;
    if (room.answeringRound >= room.settings.totalRounds) {
      room.votes = {};
      room.phase = "voting";
      broadcastRoom(code);
    } else {
      room.answeringRound++;
      startAnsweringPhase(code);
    }
  });

  // ── Impostor: submit answer ────────────────────────────────────────────────

  socket.on("player:submit_answer", ({ answer }) => {
    const code = socketToRoom[socket.id];
    const room = rooms[code];
    if (!room) return;
    if (room.phase !== "answering" && room.phase !== "tiebreaker_answering") return;
    if (room.players[socket.id]?.isEliminated) return;
    if (socket.id in room.submissions) return;
    const trimmed = (answer || "").trim().slice(0, 200);
    if (!trimmed) return;
    room.submissions[socket.id] = trimmed;
    broadcastRoom(code);
    checkAllSubmitted(code);
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

    // Randomise turn order
    room.turnOrder = connected.map((p) => p.id).sort(() => Math.random() - 0.5);
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

    // If in chain mode, only same-value number cards or wilds are allowed
    if (room.chainValue !== null) {
      const isChainable = card.color === "wild" ||
        (card.type === "number" && card.value === room.chainValue);
      if (!isChainable)
        return socket.emit("error", { message: "End your turn or play a matching number" });
    } else {
      // Normal validation (not in chain mode)
      if (!uno.isValidPlay(card, topCard, room.currentColor, room.pendingDrawCount))
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
      room.roundWinnerId = socket.id;
      const otherHands = {};
      for (const pid of room.turnOrder) {
        if (pid !== socket.id) otherHands[pid] = room.hands[pid];
      }
      room.scores[socket.id] = (room.scores[socket.id] || 0) + uno.calculateRoundScore(otherHands);
      room.phase = "uno_round_over";
      broadcastRoom(code);
      return;
    }

    // ── Same-value chain logic ────────────────────────────────────────────
    // After playing a number card, if the player still holds cards of the
    // same value they stay on their turn and can chain them.
    if (card.type === "number") {
      const hasMoreSameValue = hand.some((c) => c.type === "number" && c.value === card.value);
      if (hasMoreSameValue) {
        room.chainValue   = card.value;
        room.currentColor = card.color; // update active colour without advancing turn
        broadcastRoom(code);
        return;
      }
    }

    // No chain continuation: clear chain state and apply normal card effect
    room.chainValue = null;
    uno.applyCardEffect(room, card, chosenColor);
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

    uno.drawCards(room, socket.id, 1);
    room.saidUno[socket.id] = false;

    const drawnCard = room.hands[socket.id][room.hands[socket.id].length - 1];
    const topCard   = room.discardPile[room.discardPile.length - 1];

    if (uno.isValidPlay(drawnCard, topCard, room.currentColor, room.pendingDrawCount)) {
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

    if (!room.drawnCardId && room.chainValue === null)
      return socket.emit("error", { message: "Nothing to pass" });

    room.drawnCardId = null;
    room.chainValue  = null;
    uno.advanceTurn(room, 1);
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

  // ── UNO: next round ────────────────────────────────────────────────────────

  socket.on("uno:next_round", () => {
    const code = socketToRoom[socket.id];
    const room = rooms[code];
    if (!room || room.gameType !== "uno" || room.hostId !== socket.id) return;
    if (room.phase !== "uno_round_over") return;

    room.roundNumber++;
    // Rotate the starting player so a different player leads each round
    room.turnOrder = [...room.turnOrder.slice(1), room.turnOrder[0]];
    room.phase = "uno_playing";
    uno.dealCards(room);
    broadcastRoom(code);
  });

  // ── UNO: back to lobby (play again) ───────────────────────────────────────

  socket.on("uno:play_again", () => {
    const code = socketToRoom[socket.id];
    const room = rooms[code];
    if (!room || room.gameType !== "uno" || room.hostId !== socket.id) return;
    if (room.phase !== "uno_round_over") return;

    room.phase        = "uno_lobby";
    room.roundNumber  = 1;
    room.scores       = {};
    for (const pid of Object.keys(room.players)) room.scores[pid] = 0;
    room.hands        = null;
    room.drawPile     = null;
    room.discardPile  = null;
    room.turnOrder    = [];
    room.currentColor = null;
    room.direction    = 1;
    room.currentTurnIndex = 0;
    room.pendingDrawCount = 0;
    room.saidUno      = {};
    room.roundWinnerId = null;
    room.drawnCardId  = null;
    room.chainValue   = null;
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

    // Mark offline immediately so the UI shows them as disconnected
    player.isConnected = false;
    delete socketToRoom[socket.id];
    broadcastRoom(code);

    // ── Grace period: wait GRACE_MS before treating as permanent ──────────
    disconnectTimers[socket.id] = setTimeout(() => {
      delete disconnectTimers[socket.id];

      // Re-fetch in case room was deleted while we waited
      const r = rooms[code];
      if (!r || !r.players[socket.id]) return;

      const stillConnected = getConnectedPlayers(r);
      if (stillConnected.length === 0) {
        clearTimer(code);
        delete rooms[code];
        return;
      }

      // Transfer host
      if (r.hostId === socket.id) {
        const nextHost = stillConnected.find((p) => !p.isEliminated) || stillConnected[0];
        r.hostId = nextHost.id;
      }

      // UNO: skip their turn if it's currently theirs
      if (r.gameType === "uno" && r.phase === "uno_playing") {
        if (uno.getCurrentPlayerId(r) === socket.id) {
          uno.advanceTurn(r, 1);
        }
      }

      broadcastRoom(code);

      // Impostor: re-check completion conditions
      if (r.phase === "answering" || r.phase === "tiebreaker_answering") checkAllSubmitted(code);
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
