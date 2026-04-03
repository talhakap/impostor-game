import React, { useState } from "react";
import { socket } from "../socket";

export default function UnoLobby({ room, myId, error, onLeave }) {
  const [copied, setCopied] = useState(false);

  const isHost    = room.hostId === myId;
  const players   = room.players ?? [];
  const connected = players.filter((p) => p.isConnected);

  const copyCode = () => {
    navigator.clipboard?.writeText(room.code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sortedScores = Object.entries(room.scores ?? {})
    .map(([id, score]) => ({
      id,
      name:  players.find((p) => p.id === id)?.name ?? "Unknown",
      score,
    }))
    .sort((a, b) => b.score - a.score);

  const showScores = room.roundNumber > 1 && sortedScores.some((e) => e.score > 0);

  return (
    <div className="container">
      <div className="card wide">

        {/* Header */}
        <div className="row-between mb">
          <div>
            <h2 style={{ marginBottom: 0 }}>UNO Lobby</h2>
            {room.roundNumber > 1 && (
              <p className="muted" style={{ fontSize: "0.8rem", marginTop: "0.2rem" }}>
                Completed rounds: {room.roundNumber - 1}
              </p>
            )}
          </div>
          <button
            className="btn-ghost"
            style={{ width: "auto" }}
            onClick={onLeave}
          >
            Leave
          </button>
        </div>

        {/* Room code */}
        <div className="mb">
          <div className="label">Room Code — tap to copy</div>
          <div className="room-code" onClick={copyCode}>
            {room.code}
            {copied && (
              <span style={{
                fontSize: "0.8rem", color: "var(--green)", marginLeft: "0.75rem",
              }}>
                Copied!
              </span>
            )}
          </div>
        </div>

        <hr className="divider" />

        {/* Player list */}
        <div className="mb">
          <div className="label">Players ({connected.length} / 10)</div>
          <div className="stack-sm">
            {players.map((p) => (
              <div className="player-item" key={p.id}>
                <span className="name">{p.name}</span>
                <span className="row" style={{ gap: "0.4rem" }}>
                  {p.id === room.hostId && <span className="badge badge-host">Host</span>}
                  {p.id === myId        && <span className="badge badge-you">You</span>}
                  {!p.isConnected && (
                    <span className="badge" style={{
                      background: "var(--surface3)",
                      color: "var(--red)",
                      border: "1px solid rgba(224,96,96,0.3)",
                    }}>
                      Offline
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Cumulative scores (shown after at least one round) */}
        {showScores && (
          <>
            <hr className="divider" />
            <div className="mb">
              <div className="label">Scores</div>
              <div className="stack-sm">
                {sortedScores.map((entry, i) => (
                  <div className={`score-row${i === 0 ? " top" : ""}`} key={entry.id}>
                    <span>
                      {i === 0 && <span style={{ marginRight: "0.4rem" }}>🏆</span>}
                      {entry.name}
                      {entry.id === myId && (
                        <span className="muted" style={{ fontSize: "0.75rem", marginLeft: "0.4rem" }}>
                          (You)
                        </span>
                      )}
                    </span>
                    <span style={{ fontWeight: 700, color: "var(--yellow)" }}>
                      {entry.score} pts
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {error && <p className="error-text mt-sm">{error}</p>}

        {/* Start / waiting */}
        {isHost ? (
          <button
            className="btn-primary"
            onClick={() => socket.emit("uno:start_game")}
            disabled={connected.length < 2}
            style={{ marginTop: "0.5rem" }}
          >
            {connected.length < 2 ? "Waiting for players..." : "Start UNO"}
          </button>
        ) : (
          <p className="muted center-text mt">Waiting for the host to start...</p>
        )}
      </div>
    </div>
  );
}
