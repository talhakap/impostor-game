const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const cors = require("cors");
const { getRandomWord } = require("./words");

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));
app.get("*splat", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// ─── In-memory state ──────────────────────────────────────────────────────────

const rooms = {};
const socketToRoom = {};
const activeTimers = {};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateRoomCode() {
  let code;
  do {
    code = Math.random().toString(36).substring(2, 8).toUpperCase();
  } while (rooms[code]);
  return code;
}

function getConnectedPlayers(room) {
  return Object.values(room.players).filter((p) => p.isConnected);
}

// Active = connected AND not eliminated (participates in the game)
function getActivePlayers(room) {
  return Object.values(room.players).filter((p) => p.isConnected && !p.isEliminated);
}

function buildRoomView(room) {
  const showFullSubmissions =
    room.phase === "revealing" ||
    room.phase === "voting" ||
    room.phase === "round_results";

  return {
    code: room.code,
    hostId: room.hostId,
    phase: room.phase,
    settings: room.settings,
    roundNumber: room.roundNumber,
    timerEndsAt: room.timerEndsAt,
    players: Object.values(room.players).map((p) => ({
      id: p.id,
      name: p.name,
      isHost: p.id === room.hostId,
      isConnected: p.isConnected,
      isEliminated: p.isEliminated,
      hasSubmitted: room.submissions ? p.id in room.submissions : false,
      hasVoted: room.votes ? p.id in room.votes : false,
    })),
    submissions: showFullSubmissions
      ? room.submissions
      : room.submissions
        ? Object.fromEntries(Object.keys(room.submissions).map((id) => [id, true]))
        : {},
    roundResults: room.roundResults || null,
  };
}

function broadcastRoom(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;
  io.to(roomCode).emit("room:updated", buildRoomView(room));
}

function clearTimer(roomCode) {
  if (activeTimers[roomCode]) {
    clearTimeout(activeTimers[roomCode]);
    delete activeTimers[roomCode];
  }
}

// ─── Game Logic ───────────────────────────────────────────────────────────────

function assignRoles(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;

  const wordEntry = getRandomWord();
  room.currentWord = wordEntry.word;
  room.currentCategory = wordEntry.category;
  room.currentHint = wordEntry.hint;
  room.submissions = {};
  room.votes = {};
  room.roundResults = null;

  // Only assign roles to active (non-eliminated, connected) players
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
      hint: wordEntry.hint,
      category: wordEntry.category,
    });
  });
}

function startAnsweringPhase(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;

  room.phase = "answering";
  room.timerEndsAt = Date.now() + room.settings.roundDurationSecs * 1000;
  broadcastRoom(roomCode);

  clearTimer(roomCode);
  activeTimers[roomCode] = setTimeout(() => {
    advanceToRevealing(roomCode);
  }, room.settings.roundDurationSecs * 1000);
}

function advanceToRevealing(roomCode) {
  const room = rooms[roomCode];
  if (!room || room.phase !== "answering") return;
  clearTimer(roomCode);
  room.phase = "revealing";
  room.timerEndsAt = null;
  broadcastRoom(roomCode);
}

function advanceToVoting(roomCode) {
  const room = rooms[roomCode];
  if (!room || room.phase !== "revealing") return;
  room.phase = "voting";
  broadcastRoom(roomCode);
}

function tallyVotesAndFinish(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;

  const active = getActivePlayers(room);
  const activeIds = active.map((p) => p.id);

  // Count votes (only votes targeting active players count)
  const voteCounts = {};
  activeIds.forEach((id) => { voteCounts[id] = 0; });
  Object.entries(room.votes).forEach(([, targetId]) => {
    if (voteCounts[targetId] !== undefined) voteCounts[targetId]++;
  });

  // Determine how many to eliminate (impostorCount, but never eliminate everyone)
  const N = Math.min(room.settings.impostorCount, activeIds.length - 1);

  // Sort by votes descending
  const sorted = [...activeIds].sort((a, b) => voteCounts[b] - voteCounts[a]);

  // Pick top N with random tiebreak at the boundary
  const eliminatedIds = [];
  if (N > 0) {
    const nthVotes = voteCounts[sorted[N - 1]];
    const clearlyAbove = sorted.filter((id) => voteCounts[id] > nthVotes);
    const tied = sorted.filter((id) => voteCounts[id] === nthVotes);
    eliminatedIds.push(...clearlyAbove);
    const needed = N - clearlyAbove.length;
    const shuffledTied = tied.sort(() => Math.random() - 0.5);
    eliminatedIds.push(...shuffledTied.slice(0, needed));
  }

  // Mark eliminated
  eliminatedIds.forEach((id) => {
    if (room.players[id]) room.players[id].isEliminated = true;
  });

  // Check win conditions among all non-eliminated players
  const surviving = Object.values(room.players).filter((p) => !p.isEliminated);
  const survivingImpostors = surviving.filter((p) => room.roles[p.id] === "impostor");
  const survivingCrew = surviving.filter((p) => room.roles[p.id] === "normal");

  let winner = null;
  if (survivingImpostors.length === 0) winner = "crew";
  else if (survivingCrew.length === 0) winner = "impostors";

  room.roundResults = {
    voteMap: { ...room.votes },
    voteCounts,
    eliminatedIds,
    eliminatedNames: eliminatedIds.map((id) => room.players[id]?.name),
    eliminatedRoles: eliminatedIds.map((id) => room.roles[id] || "unknown"),
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

function checkAllSubmitted(roomCode) {
  const room = rooms[roomCode];
  if (!room || room.phase !== "answering") return;
  const active = getActivePlayers(room);
  const allIn = active.every((p) => p.id in room.submissions);
  if (allIn) advanceToRevealing(roomCode);
}

function checkAllVoted(roomCode) {
  const room = rooms[roomCode];
  if (!room || room.phase !== "voting") return;
  const active = getActivePlayers(room);
  const allIn = active.every((p) => p.id in room.votes);
  if (allIn) tallyVotesAndFinish(roomCode);
}

// ─── Socket Handlers ─────────────────────────────────────────────────────────

io.on("connection", (socket) => {
  console.log(`[+] ${socket.id} connected`);

  // ── room:create ──────────────────────────────────────────────────────────
  socket.on("room:create", ({ playerName }, callback) => {
    if (!playerName?.trim()) return callback({ error: "Name required" });

    const code = generateRoomCode();
    const player = {
      id: socket.id,
      name: playerName.trim().slice(0, 20),
      isConnected: true,
      isEliminated: false,
    };

    rooms[code] = {
      code,
      hostId: socket.id,
      phase: "lobby",
      roundNumber: 0,
      settings: {
        impostorCount: 1,
        roundDurationSecs: 60,
        totalRounds: 3,
      },
      players: { [socket.id]: player },
      roles: {},
      submissions: {},
      votes: {},
      currentWord: null,
      currentCategory: null,
      currentHint: null,
      timerEndsAt: null,
      roundResults: null,
      createdAt: Date.now(),
    };

    socketToRoom[socket.id] = code;
    socket.join(code);

    console.log(`Room ${code} created by ${playerName}`);
    callback({ code });
    broadcastRoom(code);
  });

  // ── room:join ────────────────────────────────────────────────────────────
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
      id: socket.id,
      name: playerName.trim().slice(0, 20),
      isConnected: true,
      isEliminated: false,
    };

    socketToRoom[socket.id] = upperCode;
    socket.join(upperCode);

    console.log(`${playerName} joined room ${upperCode}`);
    callback({ code: upperCode });
    broadcastRoom(upperCode);
  });

  // ── host:update_settings ─────────────────────────────────────────────────
  socket.on("host:update_settings", ({ impostorCount, roundDurationSecs, totalRounds }) => {
    const code = socketToRoom[socket.id];
    const room = rooms[code];
    if (!room || room.hostId !== socket.id || room.phase !== "lobby") return;

    const playerCount = Object.keys(room.players).length;

    if (impostorCount !== undefined) {
      room.settings.impostorCount = Math.max(1, Math.min(Number(impostorCount), playerCount - 1));
    }
    if (roundDurationSecs !== undefined) {
      room.settings.roundDurationSecs = Math.max(15, Math.min(300, Number(roundDurationSecs)));
    }
    if (totalRounds !== undefined) {
      room.settings.totalRounds = Math.max(1, Math.min(10, Number(totalRounds)));
    }

    broadcastRoom(code);
  });

  // ── host:start_game ──────────────────────────────────────────────────────
  socket.on("host:start_game", () => {
    const code = socketToRoom[socket.id];
    const room = rooms[code];
    if (!room || room.hostId !== socket.id || room.phase !== "lobby") return;

    const connected = getConnectedPlayers(room);
    if (connected.length < 2) {
      socket.emit("error", { message: "Need at least 2 players to start" });
      return;
    }

    room.roundNumber = 1;
    room.phase = "assigning_roles";
    broadcastRoom(code);

    setTimeout(() => {
      if (!rooms[code]) return;
      assignRoles(code);
      startAnsweringPhase(code);
    }, 1500);
  });

  // ── player:submit_answer ─────────────────────────────────────────────────
  socket.on("player:submit_answer", ({ answer }) => {
    const code = socketToRoom[socket.id];
    const room = rooms[code];
    if (!room || room.phase !== "answering") return;
    if (room.players[socket.id]?.isEliminated) return;
    if (socket.id in room.submissions) return;

    const trimmed = (answer || "").trim().slice(0, 200);
    if (!trimmed) return;

    room.submissions[socket.id] = trimmed;
    broadcastRoom(code);
    checkAllSubmitted(code);
  });

  // ── host:advance_to_voting ───────────────────────────────────────────────
  socket.on("host:advance_to_voting", () => {
    const code = socketToRoom[socket.id];
    const room = rooms[code];
    if (!room || room.hostId !== socket.id || room.phase !== "revealing") return;
    advanceToVoting(code);
  });

  // ── player:submit_vote ───────────────────────────────────────────────────
  socket.on("player:submit_vote", ({ targetId }) => {
    const code = socketToRoom[socket.id];
    const room = rooms[code];
    if (!room || room.phase !== "voting") return;
    if (room.players[socket.id]?.isEliminated) return;
    if (socket.id in room.votes) return;
    if (socket.id === targetId) return;
    if (!room.players[targetId] || room.players[targetId].isEliminated) return;

    room.votes[socket.id] = targetId;
    broadcastRoom(code);
    checkAllVoted(code);
  });

  // ── host:next_round ──────────────────────────────────────────────────────
  socket.on("host:next_round", () => {
    const code = socketToRoom[socket.id];
    const room = rooms[code];
    if (!room || room.hostId !== socket.id || room.phase !== "round_results") return;

    // If there was a winner, go to game_over
    if (room.roundResults?.winner) {
      room.phase = "game_over";
      broadcastRoom(code);
      return;
    }

    room.roundNumber += 1;
    room.phase = "assigning_roles";
    room.submissions = {};
    room.votes = {};
    room.roundResults = null;
    broadcastRoom(code);

    setTimeout(() => {
      if (!rooms[code]) return;
      assignRoles(code);
      startAnsweringPhase(code);
    }, 1500);
  });

  // ── host:play_again ──────────────────────────────────────────────────────
  socket.on("host:play_again", () => {
    const code = socketToRoom[socket.id];
    const room = rooms[code];
    if (!room || room.hostId !== socket.id || room.phase !== "game_over") return;

    Object.values(room.players).forEach((p) => { p.isEliminated = false; });
    room.roundNumber = 0;
    room.phase = "lobby";
    room.roles = {};
    room.submissions = {};
    room.votes = {};
    room.roundResults = null;
    room.timerEndsAt = null;
    clearTimer(code);

    broadcastRoom(code);
  });

  // ── disconnect ───────────────────────────────────────────────────────────
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
      console.log(`Room ${code} deleted (empty)`);
      return;
    }

    if (room.hostId === socket.id) {
      const nextHost = stillConnected.find((p) => !p.isEliminated) || stillConnected[0];
      room.hostId = nextHost.id;
      console.log(`Host transferred to ${room.hostId} in room ${code}`);
    }

    broadcastRoom(code);

    if (room.phase === "answering") checkAllSubmitted(code);
    if (room.phase === "voting") checkAllVoted(code);
  });
});

// ─── Stale room cleanup (every 10 minutes) ───────────────────────────────────
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const code of Object.keys(rooms)) {
    if (rooms[code].createdAt < cutoff) {
      clearTimer(code);
      delete rooms[code];
      console.log(`Room ${code} expired`);
    }
  }
}, 10 * 60 * 1000);

server.listen(3001, () => {
  console.log("Backend running on http://localhost:3001");
});
