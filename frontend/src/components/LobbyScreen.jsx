import React, { useState } from "react";
import { socket } from "../socket";

export default function LobbyScreen({ room, myId, error, clearError, onLeave }) {
  const [copied, setCopied] = useState(false);
  const isHost = room.hostId === myId;
  const players = room.players || [];
  const { settings } = room;

  const copyCode = () => {
    navigator.clipboard?.writeText(room.code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const kickPlayer = (playerId) => {
    socket.emit("host:kick_player", { playerId });
  };

  return (
    <div className="container">
      <div className="card wide">
        <div className="row-between mb">
          <h2 style={{ marginBottom: 0 }}>Lobby</h2>
          <button className="btn-ghost" style={{ width: "auto" }} onClick={onLeave}>Leave</button>
        </div>

        <div className="mb">
          <div className="label">Room Code — tap to copy</div>
          <div className="room-code" onClick={copyCode}>
            {room.code}{copied && <span style={{ fontSize: "0.8rem", color: "var(--green)", marginLeft: "0.75rem" }}>Copied!</span>}
          </div>
        </div>

        <hr className="divider" />

        <div className="mb">
          <div className="label">Players ({players.length})</div>
          <div className="stack-sm">
            {players.map((p) => (
              <div className="player-item" key={p.id}>
                <span className="name">{p.name}</span>
                <span className="row" style={{ gap: "0.4rem" }}>
                  {p.id === room.hostId && <span className="badge badge-host">Host</span>}
                  {p.id === myId && <span className="badge badge-you">You</span>}
                  {!p.isConnected && (
                    <span className="badge" style={{ background: "var(--surface3)", color: "var(--red)", border: "1px solid rgba(224,96,96,0.3)" }}>
                      Offline
                    </span>
                  )}
                  {isHost && p.id !== myId && (
                    <button
                      onClick={() => kickPlayer(p.id)}
                      style={{
                        padding: "0.2rem 0.55rem", fontSize: "0.7rem",
                        background: "transparent", border: "1px solid rgba(224,96,96,0.35)",
                        color: "var(--red)", borderRadius: "999px",
                        cursor: "pointer", fontFamily: "inherit",
                        fontWeight: 700, letterSpacing: "0.04em",
                        textTransform: "uppercase", width: "auto",
                      }}
                    >
                      Kick
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>

        <hr className="divider" />

        <div className="mb">
          <div className="label">Settings{!isHost && " (host only)"}</div>
          <div>
            <div className="settings-row">
              <span className="setting-label">Impostors</span>
              {isHost ? (
                <input type="number" min={1} max={players.length - 1} value={settings.impostorCount}
                  onChange={(e) => socket.emit("host:update_settings", { impostorCount: e.target.value })} />
              ) : <strong>{settings.impostorCount}</strong>}
            </div>
            <div className="settings-row">
              <span className="setting-label">Round Duration (sec)</span>
              {isHost ? (
                <input type="number" min={15} max={300} step={15} value={settings.roundDurationSecs}
                  onChange={(e) => socket.emit("host:update_settings", { roundDurationSecs: e.target.value })} />
              ) : <strong>{settings.roundDurationSecs}s</strong>}
            </div>
          </div>
        </div>

        {error && <p className="error-text mt-sm">{error}</p>}

        {isHost ? (
          <button
            className="btn-primary"
            onClick={() => socket.emit("host:start_game")}
            disabled={players.filter((p) => p.isConnected).length < 2}
          >
            {players.filter((p) => p.isConnected).length < 2 ? "Waiting for players..." : "Start Game"}
          </button>
        ) : (
          <p className="muted center-text mt">Waiting for host to start...</p>
        )}
      </div>
    </div>
  );
}
