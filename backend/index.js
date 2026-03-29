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

const rooms = {}; // roomCode -> Room
const socketToRoom = {}; // socketId -> roomCode (fast lookup on disconnect)
const activeTimers = {}; // roomCode -> NodeJS.Timeout

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

// Build the safe room view sent to all clients (no roles, no word)
function buildRoomView(room) {
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
      score: p.score,
      hasSubmitted: room.submissions ? p.id in room.submissions : false,
      hasVoted: room.votes ? p.id in room.votes : false,
    })),
    submissions: room.phase === "revealing" || room.phase === "voting" || room.phase === "round_results"
      ? room.submissions
      : room.submissions
        ? Object.fromEntries(Object.keys(room.submissions).map((id) => [id, true]))
        : {},
    votes: room.phase === "round_results" ? room.votes : {},
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

  const playerIds = Object.keys(room.players).filter(
    (id) => room.players[id].isConnected
  );

  // Shuffle player IDs
  const shuffled = [...playerIds].sort(() => Math.random() - 0.5);

  // Clamp impostorCount to connected player count
  const impostorCount = Math.min(room.settings.impostorCount, playerIds.length);
  const impostors = new Set(shuffled.slice(0, impostorCount));

  room.roles = {};
  playerIds.forEach((id) => {
    room.roles[id] = impostors.has(id) ? "impostor" : "normal";
  });

  // Send private role data to each player
  playerIds.forEach((id) => {
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

  const playerIds = Object.keys(room.players).filter(
    (id) => room.players[id].isConnected
  );

  // Count votes
  const voteCounts = {};
  playerIds.forEach((id) => {
    const target = room.votes[id];
    if (target) voteCounts[target] = (voteCounts[target] || 0) + 1;
  });

  // Find most-voted player (tiebreak: random among tied)
  let maxVotes = 0;
  Object.values(voteCounts).forEach((c) => { if (c > maxVotes) maxVotes = c; });
  const topCandidates = Object.keys(voteCounts).filter((id) => voteCounts[id] === maxVotes);
  const votedOutId = topCandidates[Math.floor(Math.random() * topCandidates.length)] || null;

  // Identify all impostors
  const impostorIds = playerIds.filter((id) => room.roles[id] === "impostor");
  const impostorCount = impostorIds.length;

  // Scoring:
  // Normal players: +2 if an impostor was voted out
  // Impostors: +3 if they were NOT voted out
  // Bonus: +1 to each normal player who voted for the voted-out impostor
  const votedOutIsImpostor = votedOutId && room.roles[votedOutId] === "impostor";
  const pointsAwarded = {};

  playerIds.forEach((id) => {
    pointsAwarded[id] = 0;
  });

  if (impostorCount === 0) {
    // No impostors — everyone gets 1 point for participating
    playerIds.forEach((id) => { pointsAwarded[id] = 1; });
  } else if (votedOutIsImpostor) {
    // Normal players all get 2 pts
    playerIds.forEach((id) => {
      if (room.roles[id] === "normal") pointsAwarded[id] += 2;
    });
    // Bonus for voters who got it right
    playerIds.forEach((id) => {
      if (room.votes[id] === votedOutId && room.roles[id] === "normal") {
        pointsAwarded[id] += 1;
      }
    });
  } else {
    // Impostors evaded — they get 3 pts each
    impostorIds.forEach((id) => { pointsAwarded[id] += 3; });
  }

  // Apply points to scores
  playerIds.forEach((id) => {
    room.players[id].score += pointsAwarded[id];
  });

  room.roundResults = {
    votedOutId,
    votedOutName: votedOutId ? room.players[votedOutId]?.name : null,
    votedOutIsImpostor: !!votedOutIsImpostor,
    impostorIds,
    impostorNames: impostorIds.map((id) => room.players[id]?.name),
    pointsAwarded,
    scores: Object.fromEntries(playerIds.map((id) => [id, room.players[id].score])),
    word: room.currentWord,
    category: room.currentCategory,
  };

  room.phase = "round_results";
  room.timerEndsAt = null;
  broadcastRoom(roomCode);
}

function checkAllSubmitted(roomCode) {
  const room = rooms[roomCode];
  if (!room || room.phase !== "answering") return;
  const connected = Object.keys(room.players).filter((id) => room.players[id].isConnected);
  const allIn = connected.every((id) => id in room.submissions);
  if (allIn) advanceToRevealing(roomCode);
}

function checkAllVoted(roomCode) {
  const room = rooms[roomCode];
  if (!room || room.phase !== "voting") return;
  const connected = Object.keys(room.players).filter((id) => room.players[id].isConnected);
  const allIn = connected.every((id) => id in room.votes);
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
      score: 0,
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
    const room = rooms[code?.toUpperCase()];
    if (!room) return callback({ error: "Room not found" });
    if (room.phase !== "lobby") return callback({ error: "Game already in progress" });
    if (Object.keys(room.players).length >= 12) return callback({ error: "Room is full" });
    if (!playerName?.trim()) return callback({ error: "Name required" });

    const upperCode = code.toUpperCase();
    const nameExists = Object.values(room.players).some(
      (p) => p.name.toLowerCase() === playerName.trim().toLowerCase()
    );
    if (nameExists) return callback({ error: "Name already taken in this room" });

    room.players[socket.id] = {
      id: socket.id,
      name: playerName.trim().slice(0, 20),
      isConnected: true,
      score: 0,
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
      room.settings.impostorCount = Math.max(0, Math.min(Number(impostorCount), playerCount));
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

    // Brief delay so clients see the transition, then assign roles and start
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
    if (socket.id in room.submissions) return; // already submitted

    const trimmed = (answer || "").trim().slice(0, 200);
    if (!trimmed) return;

    room.submissions[socket.id] = trimmed;
    broadcastRoom(code); // updates hasSubmitted flags
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
    if (socket.id in room.votes) return; // already voted
    if (socket.id === targetId) return; // can't vote for yourself
    if (!room.players[targetId]) return; // target must exist

    room.votes[socket.id] = targetId;
    broadcastRoom(code);
    checkAllVoted(code);
  });

  // ── host:next_round ──────────────────────────────────────────────────────
  socket.on("host:next_round", () => {
    const code = socketToRoom[socket.id];
    const room = rooms[code];
    if (!room || room.hostId !== socket.id || room.phase !== "round_results") return;

    if (room.roundNumber >= room.settings.totalRounds) {
      room.phase = "game_over";
      broadcastRoom(code);
      return;
    }

    room.roundNumber += 1;
    room.phase = "assigning_roles";
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

    // Reset scores and round data
    Object.values(room.players).forEach((p) => { p.score = 0; });
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

    // Empty room — clean up
    if (stillConnected.length === 0) {
      clearTimer(code);
      delete rooms[code];
      console.log(`Room ${code} deleted (empty)`);
      return;
    }

    // Host left — promote next connected player
    if (room.hostId === socket.id) {
      room.hostId = stillConnected[0].id;
      console.log(`Host transferred to ${room.hostId} in room ${code}`);
    }

    broadcastRoom(code);

    // If everyone remaining has submitted/voted, auto-advance
    if (room.phase === "answering") checkAllSubmitted(code);
    if (room.phase === "voting") checkAllVoted(code);
  });
});

// ─── Stale room cleanup (every 10 minutes) ───────────────────────────────────
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000; // 30 min
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
