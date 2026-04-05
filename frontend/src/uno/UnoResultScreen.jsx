import React from "react";
import { socket } from "../socket";

export default function UnoResultScreen({ room, myId }) {
  const isHost = room.hostId === myId;
  const winner = room.players.find((p) => p.id === room.roundWinnerId);
  const iWon   = room.roundWinnerId === myId;

  const sortedScores = Object.entries(room.scores || {})
    .map(([id, score]) => ({
      id,
      name:  room.players.find((p) => p.id === id)?.name ?? "Unknown",
      score,
    }))
    .sort((a, b) => b.score - a.score);

  return (
    <div className="container">
      <div className="card wide">

        {/* Result header */}
        <div className="center-text mb">
          <h2>
            {iWon ? "You win!" : `${winner?.name ?? "Someone"} wins!`}
          </h2>
          <p className="muted" style={{ marginTop: "0.3rem", fontSize: "0.85rem" }}>
            {iWon ? "You played your last card!" : `${winner?.name ?? "They"} played their last card.`}
          </p>
        </div>

        <hr className="divider" />

        {/* Wins table */}
        <div className="mb">
          <div className="label">Wins</div>
          <div className="stack-sm">
            {sortedScores.map((entry, i) => (
              <div key={entry.id} className={`score-row${i === 0 ? " top" : ""}`}>
                <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  {i === 0 && entry.score > 0 && <span>🏆</span>}
                  <span style={{ fontWeight: entry.id === myId ? 700 : 400 }}>
                    {entry.name}
                    {entry.id === myId && (
                      <span className="muted" style={{ fontSize: "0.75rem", marginLeft: "0.4rem" }}>(You)</span>
                    )}
                  </span>
                </span>
                <span style={{ fontWeight: 700, color: "var(--yellow)" }}>
                  {entry.score} {entry.score === 1 ? "win" : "wins"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {isHost ? (
          <button className="btn-primary" onClick={() => socket.emit("uno:next_round")}>
            Back to Lobby
          </button>
        ) : (
          <p className="muted center-text mt">Waiting for the host...</p>
        )}
      </div>
    </div>
  );
}
