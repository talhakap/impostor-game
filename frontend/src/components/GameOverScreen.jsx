import React from "react";
import { socket } from "../socket";

export default function GameOverScreen({ room, myId }) {
  const isHost = room.hostId === myId;
  const players = room.players || [];

  const sorted = [...players].sort((a, b) => b.score - a.score);
  const winner = sorted[0];

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="container">
      <div className="card wide">
        <div className="center-text mb">
          <h2>Game Over</h2>
          {winner && (
            <p style={{ marginTop: "0.25rem" }}>
              <strong style={{ color: "var(--yellow)" }}>{winner.name}</strong> wins!
            </p>
          )}
        </div>

        <div className="mb">
          <div className="label">Final Standings</div>
          <div className="stack-sm">
            {sorted.map((p, idx) => (
              <div className={`score-row ${idx === 0 ? "top" : ""}`} key={p.id}>
                <span>
                  <span style={{ marginRight: "0.5rem" }}>
                    {medals[idx] || `#${idx + 1}`}
                  </span>
                  <strong>{p.name}</strong>
                  {p.id === myId && <span className="muted"> (you)</span>}
                </span>
                <span style={{ fontWeight: 700 }}>{p.score} pts</span>
              </div>
            ))}
          </div>
        </div>

        {isHost ? (
          <button className="btn-primary" onClick={() => socket.emit("host:play_again")}>
            Play Again
          </button>
        ) : (
          <p className="muted center-text">Waiting for host to start a new game...</p>
        )}
      </div>
    </div>
  );
}
