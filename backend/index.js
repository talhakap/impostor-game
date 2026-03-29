const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const cors = require("cors");
const { getRandomWord } = require("./words");

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

const rooms = {};
const socketToRoom = {};
const activeTimers = {};

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// Phases where all accumulated answers are visible to clients
const REVEAL_PHASES = new Set([
  "revealing", "voting",
  "tiebreaker_answering", "tiebreaker_revealing", "tiebreaker_voting",
  "round_results", "game_over",
]);

function buildRoomView(room) {
  const showAll = REVEAL_PHASES.has(room.phase);
  return {
    code: room.code,
    hostId: room.hostId,
    phase: room.phase,
    settings: room.settings,
    answeringRound: room.answeringRound,
    timerEndsAt: room.timerEndsAt,
    tiedPlayerIds: room.tiedPlayerIds || [],
    tiebreakerCount: room.tiebreakerCount || 0,
    players: Object.values(room.players).map((p) => ({
      id: p.id,
      name: p.name,
      isHost: p.id === room.hostId,
      isConnected: p.isConnected,
      isEliminated: p.isEliminated,
      hasSubmitted: room.submissions ? p.id in room.submissions : false,
      hasVoted: room.votes ? p.id in room.votes : false,
    })),
    // allSubmissions: keyed by "round_1", "round_2", "tb_1", etc.
    allSubmissions: showAll ? room.allSubmissions : null,
    // Current-round submission status only (content hidden during answering)
    submittedIds: Object.keys(room.submissions || {}),
    roundResults: room.roundResults || null,
  };
}

function broadcastRoom(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;
  io.to(roomCode).emit("room:updated", buildRoomView(room));
}

// ─── Game logic ───────────────────────────────────────────────────────────────

function assignRoles(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;

  const wordEntry = getRandomWord();
  room.currentWord = wordEntry.word;
  room.currentCategory = wordEntry.category;
  room.currentHint = wordEntry.hint;
  room.allSubmissions = {};
  room.submissions = {};
  room.votes = {};
  room.roundResults = null;
  room.answeringRound = 1;
  room.tiedPlayerIds = [];
  room.pendingEliminations = [];
  room.tiebreakerCount = 0;

  const active = getActivePlayers(room);
  const activeIds = active.map((p) => p.id);
  const shuffled = [...activeIds].sort(() => Math.random() - 0.5);
  const impostorCount = Math.min(room.settings.impostorCount, activeIds.length - 1);
  const impostors = new Set(shuffled.slice(0, impostorCount));

  room.roles = {};
  activeIds.forEach((id) => {
    room.roles[id] = impostors.has(id) ? "impostor" : "normal";
  });

  activeIds.forEach((id) => {
    const role = room.roles[id];
    io.to(id).emit("player:role_assigned", {
      role,
      word: role === "normal" ? wordEntry.word : null,
      category: wordEntry.category,
    });
  });
}

function startAnsweringPhase(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;
  room.submissions = {};
  room.phase = "answering";
  room.timerEndsAt = Date.now() + room.settings.roundDurationSecs * 1000;
  clearTimer(roomCode);
  activeTimers[roomCode] = setTimeout(() => advanceAnsweringRound(roomCode), room.settings.roundDurationSecs * 1000);
  broadcastRoom(roomCode);
}

function advanceAnsweringRound(roomCode) {
  const room = rooms[roomCode];
  if (!room || room.phase !== "answering") return;
  clearTimer(roomCode);
  room.allSubmissions[`round_${room.answeringRound}`] = { ...room.submissions };
  room.submissions = {};
  room.phase = "round_complete";
  room.timerEndsAt = null;
  broadcastRoom(roomCode);
}

function startTiebreaker(roomCode, pendingEliminations, tiedCandidates) {
  const room = rooms[roomCode];
  room.pendingEliminations = pendingEliminations;
  room.tiedPlayerIds = tiedCandidates;
  room.tiebreakerCount = (room.tiebreakerCount || 0) + 1;
  room.votes = {};
  room.submissions = {};
  room.phase = "tiebreaker_answering";
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
  room.phase = "tiebreaker_revealing";
  room.timerEndsAt = null;
  broadcastRoom(roomCode);
}

function finalizeEliminations(roomCode, eliminatedIds, voteCounts, voteMap) {
  const room = rooms[roomCode];
  eliminatedIds.forEach((id) => {
    if (room.players[id]) room.players[id].isEliminated = true;
  });

  const surviving = Object.values(room.players).filter((p) => !p.isEliminated);
  const survivingImpostors = surviving.filter((p) => room.roles[p.id] === "impostor");
  const survivingCrew = surviving.filter((p) => room.roles[p.id] === "normal");

  let winner = null;
  if (survivingImpostors.length === 0) winner = "crew";
  else if (survivingCrew.length === 0) winner = "impostors";

  room.roundResults = {
    voteMap: { ...voteMap },
    voteCounts: { ...voteCounts },
    eliminatedIds,
    eliminatedNames: eliminatedIds.map((id) => room.players[id]?.name),
    impostorIds: Object.keys(room.roles).filter((id) => room.roles[id] === "impostor"),
    impostorNames: Object.keys(room.roles)
      .filter((id) => room.roles[id] === "impostor")
      .map((id) => room.players[id]?.name),
    word: room.currentWord,
    category: room.currentCategory,
    winner,
  };

  room.phase = "round_results";
  room.timerEndsAt = null;
  broadcastRoom(roomCode);
}

function tallyVotesAndFinish(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;

  const isRegular = room.phase === "voting";
  const isTiebreaker = room.phase === "tiebreaker_voting";
  if (!isRegular && !isTiebreaker) return;

  const candidates = isRegular
    ? getActivePlayers(room).map((p) => p.id)
    : room.tiedPlayerIds || [];

  // Count votes (only votes for candidates count)
  const voteCounts = {};
  candidates.forEach((id) => { voteCounts[id] = 0; });
  Object.entries(room.votes).forEach(([, targetId]) => {
    if (voteCounts[targetId] !== undefined) voteCounts[targetId]++;
  });

  if (isRegular) {
    const N = Math.min(room.settings.impostorCount, candidates.length - 1);
    if (N === 0) {
      finalizeEliminations(roomCode, [], voteCounts, room.votes);
      return;
    }

    const sorted = [...candidates].sort((a, b) => voteCounts[b] - voteCounts[a]);
    const nthVotes = voteCounts[sorted[N - 1]];
    const clearlyAbove = sorted.filter((id) => voteCounts[id] > nthVotes);
    const atBoundary = sorted.filter((id) => voteCounts[id] === nthVotes);

    if (clearlyAbove.length === N) {
      // Clean result, no tie
      finalizeEliminations(roomCode, clearlyAbove, voteCounts, room.votes);
    } else {
      // Tie at the boundary
      startTiebreaker(roomCode, clearlyAbove, atBoundary);
    }
  } else {
    // Tiebreaker voting — pick 1 from tiedPlayerIds
    const sorted = [...candidates].sort((a, b) => voteCounts[b] - voteCounts[a]);
    const maxVotes = voteCounts[sorted[0]];
    const topTied = sorted.filter((id) => voteCounts[id] === maxVotes);

    if (topTied.length > 1) {
      // Still tied — another tiebreaker
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

  socket.on("room:create", ({ playerName }, callback) => {
    if (!playerName?.trim()) return callback({ error: "Name required" });
    const code = generateRoomCode();
    rooms[code] = {
      code, hostId: socket.id, phase: "lobby", answeringRound: 1,
      settings: { impostorCount: 1, roundDurationSecs: 60, totalRounds: 2 },
      players: {
        [socket.id]: { id: socket.id, name: playerName.trim().slice(0, 20), isConnected: true, isEliminated: false },
      },
      roles: {}, submissions: {}, votes: {}, allSubmissions: {},
      currentWord: null, currentCategory: null,
      timerEndsAt: null, roundResults: null, tiedPlayerIds: [],
      pendingEliminations: [], tiebreakerCount: 0, createdAt: Date.now(),
    };
    socketToRoom[socket.id] = code;
    socket.join(code);
    callback({ code });
    broadcastRoom(code);
  });

  socket.on("room:join", ({ code, playerName }, callback) => {
    const upperCode = code?.toUpperCase();
    const room = rooms[upperCode];
    if (!room) return callback({ error: "Room not found" });
    if (room.phase !== "lobby") return callback({ error: "Game already in progress" });
    if (Object.keys(room.players).length >= 12) return callback({ error: "Room is full" });
    if (!playerName?.trim()) return callback({ error: "Name required" });
    const nameExists = Object.values(room.players).some(
      (p) => p.name.toLowerCase() === playerName.trim().toLowerCase()
    );
    if (nameExists) return callback({ error: "Name already taken in this room" });

    room.players[socket.id] = {
      id: socket.id, name: playerName.trim().slice(0, 20),
      isConnected: true, isEliminated: false,
    };
    socketToRoom[socket.id] = upperCode;
    socket.join(upperCode);
    callback({ code: upperCode });
    broadcastRoom(upperCode);
  });

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

  socket.on("host:kick_player", ({ playerId }) => {
    const code = socketToRoom[socket.id];
    const room = rooms[code];
    if (!room || room.hostId !== socket.id || room.phase !== "lobby") return;
    if (playerId === socket.id) return;
    if (!room.players[playerId]) return;
    io.to(playerId).emit("kicked");
    delete room.players[playerId];
    if (socketToRoom[playerId] === code) delete socketToRoom[playerId];
    broadcastRoom(code);
  });

  // Host manually advances between answering rounds
  socket.on("host:advance_round", () => {
    const code = socketToRoom[socket.id];
    const room = rooms[code];
    if (!room || room.hostId !== socket.id || room.phase !== "round_complete") return;
    if (room.answeringRound >= room.settings.totalRounds) {
      room.phase = "revealing";
      broadcastRoom(code);
    } else {
      room.answeringRound++;
      startAnsweringPhase(code);
    }
  });

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
      // Tiebreaker: can only vote for tiedPlayerIds
      if (!room.tiedPlayerIds.includes(targetId)) return;
    }

    room.votes[socket.id] = targetId;
    broadcastRoom(code);
    checkAllVoted(code);
  });

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
    room.roles = {};
    room.submissions = {};
    room.votes = {};
    room.allSubmissions = {};
    room.roundResults = null;
    room.timerEndsAt = null;
    room.tiedPlayerIds = [];
    room.pendingEliminations = [];
    room.tiebreakerCount = 0;
    room.answeringRound = 1;
    clearTimer(code);
    broadcastRoom(code);
  });

  socket.on("disconnect", () => {
    console.log(`[-] ${socket.id} disconnected`);
    const code = socketToRoom[socket.id];
    if (!code || !rooms[code]) return;
    const room = rooms[code];
    const player = room.players[socket.id];
    if (!player) return;

    player.isConnected = false;
    delete socketToRoom[socket.id];

    const stillConnected = getConnectedPlayers(room);
    if (stillConnected.length === 0) {
      clearTimer(code);
      delete rooms[code];
      return;
    }
    if (room.hostId === socket.id) {
      const nextHost = stillConnected.find((p) => !p.isEliminated) || stillConnected[0];
      room.hostId = nextHost.id;
    }
    broadcastRoom(code);
    if (room.phase === "answering" || room.phase === "tiebreaker_answering") checkAllSubmitted(code);
    if (room.phase === "voting" || room.phase === "tiebreaker_voting") checkAllVoted(code);
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
