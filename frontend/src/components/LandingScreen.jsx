import React, { useState } from "react";
import { socket } from "../socket";

// ─── Game definitions ─────────────────────────────────────────────────────────

const GAMES = [
  {
    key:         "impostor",
    title:       "Impostor",
    desc:        "Social deduction word game",
    borderColor: "rgba(224, 96, 96, 0.4)",
    glowColor:   "rgba(224, 96, 96, 0.07)",
    titleColor:  "var(--red)",
  },
  {
    key:         "uno",
    title:       "UNO",
    desc:        "Classic multiplayer card game",
    borderColor: "rgba(37, 99, 235, 0.4)",
    glowColor:   "rgba(37, 99, 235, 0.07)",
    titleColor:  "#60a5fa",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function LandingScreen({ error, kicked, clearError }) {
  // "select" → game hub, "create" → create flow, "join" → join flow
  const [view, setView]             = useState("select");
  const [selectedGame, setSelectedGame] = useState(null);
  const [name, setName]             = useState("");
  const [joinCode, setJoinCode]     = useState("");
  const [localError, setLocalError] = useState(null);
  const [loading, setLoading]       = useState(false);

  const err  = localError || error;
  const game = GAMES.find((g) => g.key === selectedGame);

  const reset = () => {
    setView("select");
    setSelectedGame(null);
    setLocalError(null);
    clearError();
  };

  const handleCreate = () => {
    const n = name.trim();
    if (!n) return setLocalError("Enter your name first.");
    setLoading(true); setLocalError(null); clearError();
    socket.emit("room:create", { playerName: n, gameType: selectedGame }, (res) => {
      setLoading(false);
      if (res.error) { setLocalError(res.error); return; }
      localStorage.setItem("aeth_room_code",   res.code);
      localStorage.setItem("aeth_player_name", n);
    });
  };

  const handleJoin = () => {
    const n = name.trim();
    const c = joinCode.trim().toUpperCase();
    if (!n) return setLocalError("Enter your name first.");
    if (!c) return setLocalError("Enter a room code.");
    setLoading(true); setLocalError(null); clearError();
    socket.emit("room:join", { code: c, playerName: n }, (res) => {
      setLoading(false);
      if (res.error) { setLocalError(res.error); return; }
      localStorage.setItem("aeth_room_code",   res.code);
      localStorage.setItem("aeth_player_name", n);
    });
  };

  const onKey = (e, action) => { if (e.key === "Enter") action(); };

  // ── Screen: game selection hub ─────────────────────────────────────────────

  if (view === "select") {
    return (
      <div className="container">
        <div className="card" style={{ maxWidth: 460 }}>

          {/* Brand header */}
          <div className="center-text mb">
            <h1 style={{ fontSize: "2.4rem", letterSpacing: "0.04em" }}>Aeth</h1>
            <p className="muted" style={{ marginTop: "0.3rem", fontSize: "0.9rem" }}>
              Choose a game to play
            </p>
          </div>

          {/* Kicked notice */}
          {kicked && (
            <div style={{
              padding: "0.65rem 1rem",
              borderRadius: "var(--radius-sm)",
              background: "var(--red-glow)",
              border: "1px solid rgba(224,96,96,0.35)",
              marginBottom: "0.75rem",
              textAlign: "center",
              fontSize: "0.875rem",
              color: "var(--red)",
            }}>
              You were removed from the room.
            </div>
          )}

          {/* Game cards */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0.75rem",
            marginBottom: "0.75rem",
          }}>
            {GAMES.map((g) => (
              <GameCard
                key={g.key}
                game={g}
                onClick={() => { setSelectedGame(g.key); setView("create"); }}
              />
            ))}
          </div>

          {/* Join existing room (no game type needed — server determines it) */}
          <button
            className="btn-ghost"
            style={{ width: "100%" }}
            onClick={() => setView("join")}
          >
            Join a Room
          </button>
        </div>
      </div>
    );
  }

  // ── Screen: create room ────────────────────────────────────────────────────

  if (view === "create") {
    return (
      <div className="container">
        <div className="card">
          <div className="center-text mb">
            <div className="label" style={{ marginBottom: "0.45rem", color: game?.titleColor }}>
              Aeth · {game?.title}
            </div>
            <h2 style={{ marginBottom: 0 }}>Create a Room</h2>
          </div>

          <div className="stack">
            <div>
              <div className="label">Your Name</div>
              <input
                placeholder="e.g. Alex"
                value={name}
                maxLength={20}
                autoFocus
                onChange={(e) => { setName(e.target.value); setLocalError(null); }}
                onKeyDown={(e) => onKey(e, handleCreate)}
              />
            </div>

            <button className="btn-primary" onClick={handleCreate} disabled={loading}>
              {loading ? "Creating..." : "Create Room"}
            </button>
            <button className="btn-ghost" onClick={reset}>Back</button>

            {err && <p className="error-text center-text">{err}</p>}
          </div>
        </div>
      </div>
    );
  }

  // ── Screen: join room ──────────────────────────────────────────────────────

  return (
    <div className="container">
      <div className="card">
        <div className="center-text mb">
          <div className="label" style={{ marginBottom: "0.45rem" }}>Aeth</div>
          <h2 style={{ marginBottom: 0 }}>Join a Room</h2>
        </div>

        <div className="stack">
          <div>
            <div className="label">Your Name</div>
            <input
              placeholder="e.g. Alex"
              value={name}
              maxLength={20}
              autoFocus
              onChange={(e) => { setName(e.target.value); setLocalError(null); }}
              onKeyDown={(e) => onKey(e, handleJoin)}
            />
          </div>

          <div>
            <div className="label">Room Code</div>
            <input
              placeholder="e.g. ABC123"
              value={joinCode}
              maxLength={6}
              onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setLocalError(null); }}
              onKeyDown={(e) => onKey(e, handleJoin)}
            />
          </div>

          <button className="btn-success" onClick={handleJoin} disabled={loading}>
            {loading ? "Joining..." : "Join Room"}
          </button>
          <button className="btn-ghost" onClick={reset}>Back</button>

          {err && <p className="error-text center-text">{err}</p>}
        </div>
      </div>
    </div>
  );
}

// ─── GameCard sub-component ───────────────────────────────────────────────────

function GameCard({ game, onClick }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "1.35rem 1rem",
        borderRadius: "var(--radius)",
        background: hovered ? "var(--surface3)" : "var(--surface2)",
        border: `1px solid ${hovered ? game.borderColor.replace("0.4", "0.7") : game.borderColor}`,
        boxShadow: `0 0 ${hovered ? "32px" : "18px"} ${game.glowColor}`,
        cursor: "pointer",
        textAlign: "center",
        transition: "border-color 0.15s, background 0.15s, box-shadow 0.15s",
        userSelect: "none",
      }}
    >
      <div style={{
        fontFamily: "'Krona One', sans-serif",
        fontSize: "1.05rem",
        color: game.titleColor,
        marginBottom: "0.4rem",
        letterSpacing: "0.02em",
      }}>
        {game.title}
      </div>
      <div style={{
        fontSize: "0.72rem",
        color: "var(--muted)",
        lineHeight: 1.5,
      }}>
        {game.desc}
      </div>
    </div>
  );
}
