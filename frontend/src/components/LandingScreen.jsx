import React, { useState } from "react";
import { socket } from "../socket";

export default function LandingScreen({ error, kicked, clearError }) {
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [localError, setLocalError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState(null);

  const err = localError || error;

  const handleCreate = () => {
    const n = name.trim();
    if (!n) return setLocalError("Enter your name first.");
    setLoading(true); setLocalError(null); clearError();
    socket.emit("room:create", { playerName: n }, (res) => {
      setLoading(false);
      if (res.error) setLocalError(res.error);
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
      if (res.error) setLocalError(res.error);
    });
  };

  const handleKeyDown = (e, action) => { if (e.key === "Enter") action(); };

  return (
    <div className="container">
      <div className="card">
        <div className="center-text mb">
          <h1 style={{ color: "var(--text)" }}>Impostor</h1>
          <p className="muted" style={{ fontSize: "0.95rem", marginTop: "0.25rem" }}>Social deduction word game</p>
        </div>

        {kicked && (
          <div style={{
            padding: "0.65rem 1rem", borderRadius: "var(--radius-sm)",
            background: "var(--red-glow)", border: "1px solid rgba(224,96,96,0.35)",
            marginBottom: "0.75rem", textAlign: "center",
            fontSize: "0.875rem", color: "var(--red)",
          }}>
            You were removed from the room.
          </div>
        )}

        <div className="stack">
          <div>
            <div className="label">Your Name</div>
            <input
              placeholder="e.g. Alex"
              value={name}
              maxLength={20}
              onChange={(e) => { setName(e.target.value); setLocalError(null); }}
              onKeyDown={(e) => handleKeyDown(e, mode === "join" ? handleJoin : handleCreate)}
              autoFocus
            />
          </div>

          {mode === null && (
            <div className="stack mt-sm">
              <button className="btn-primary" onClick={() => setMode("create")}>Create Room</button>
              <button className="btn-ghost" onClick={() => setMode("join")}>Join Room</button>
            </div>
          )}

          {mode === "create" && (
            <>
              <button className="btn-primary" onClick={handleCreate} disabled={loading}>
                {loading ? "Creating..." : "Create Room"}
              </button>
              <button className="btn-ghost" onClick={() => { setMode(null); setLocalError(null); }}>Back</button>
            </>
          )}

          {mode === "join" && (
            <>
              <div>
                <div className="label">Room Code</div>
                <input
                  placeholder="e.g. ABC123"
                  value={joinCode}
                  maxLength={6}
                  onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setLocalError(null); }}
                  onKeyDown={(e) => handleKeyDown(e, handleJoin)}
                />
              </div>
              <button className="btn-success" onClick={handleJoin} disabled={loading}>
                {loading ? "Joining..." : "Join Room"}
              </button>
              <button className="btn-ghost" onClick={() => { setMode(null); setLocalError(null); }}>Back</button>
            </>
          )}

          {err && <p className="error-text center-text">{err}</p>}
        </div>
      </div>
    </div>
  );
}
