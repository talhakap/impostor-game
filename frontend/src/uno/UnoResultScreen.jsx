import React from "react";
import { socket } from "../socket";

export default function UnoResultScreen({ room, myId }) {
  const isHost  = room.hostId === myId;
  const winner  = room.players.find((p) => p.id === room.roundWinnerId);
  const iWon    = room.roundWinnerId === myId;

  const sortedScores = Object.entries(room.scores || {})
    .map(([id, score]) => ({
      id,
      name:  room.players.find((p) => p.id === id)?.name ?? "Unknown",
      score,
    }))
    .sort((a, b) => b.score - a.score);

  const topScore = sortedScores[0]?.score ?? 0;

  return (
    <div className="container">
      <div className="card wide">

        {/* Round result header */}
        <div className="center-text mb">
          <div className="label" style={{ marginBottom: "0.5rem" }}>
            Round {room.roundNumber} complete
          </div>
          <h2>
            {iWon ? "You win this round!" : `${winner?.name ?? "Someone"} wins this round!`}
          </h2>
          <p className="muted" style={{ marginTop: "0.3rem", fontSize: "0.85rem" }}>
            {iWon
              ? "You played your last card!"
              : `${winner?.name ?? "They"} played their last card.`}
          </p>
        </div>

        <hr className="divider" />

        {/* Score table */}
        <div className="mb">
          <div className="label">Cumulative Scores</div>
          <div className="stack-sm">
            {sortedScores.map((entry, i) => (
              <div
                key={entry.id}
                className={`score-row${i === 0 ? " top" : ""}`}
              >
                <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  {i === 0 && <span>🏆</span>}
                  <span style={{ fontWeight: entry.id === myId ? 700 : 400 }}>
                    {entry.name}
                    {entry.id === myId && (
                      <span className="muted" style={{ fontSize: "0.75rem", marginLeft: "0.4rem" }}>
                        (You)
                      </span>
                    )}
                  </span>
                </span>
                <span style={{ fontWeight: 700, color: "var(--yellow)" }}>
                  {entry.score} pts
                </span>
              </div>
            ))}
          </div>
          <p className="muted" style={{ fontSize: "0.78rem", marginTop: "0.75rem", textAlign: "center" }}>
            First player to reach 500 points wins the game.
          </p>
          {topScore >= 500 && (
            <div style={{
              marginTop: "0.75rem",
              padding: "0.65rem 1rem",
              borderRadius: "var(--radius-sm)",
              background: "var(--yellow-glow)",
              border: "1px solid rgba(212,168,71,0.4)",
              textAlign: "center",
              fontWeight: 700,
              color: "var(--yellow)",
            }}>
              {sortedScores[0].name} reached 500 points!
            </div>
          )}
        </div>

        {/* Host controls */}
        {isHost ? (
          <div className="stack">
            <button
              className="btn-primary"
              onClick={() => socket.emit("uno:next_round")}
            >
              Next Round
            </button>
            <button
              className="btn-ghost"
              style={{ width: "100%" }}
              onClick={() => socket.emit("uno:play_again")}
            >
              Back to Lobby
            </button>
          </div>
        ) : (
          <p className="muted center-text mt">Waiting for the host...</p>
        )}
      </div>
    </div>
  );
}
