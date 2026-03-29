import React from "react";
import { socket } from "../socket";

export default function GameOverScreen({ room, myId }) {
  const isHost = room.hostId === myId;
  const players = room.players || [];
  const results = room.roundResults;
  const winner = results?.winner;
  const impostorIds = results?.impostorIds || [];

  return (
    <div className="container">
      <div className="card wide">

        {/* Winner banner */}
        <div style={{
          textAlign: "center", padding: "1.5rem",
          borderRadius: "var(--radius)", marginBottom: "1.5rem",
          border: `1px solid ${winner === "crew" ? "rgba(106,191,122,0.4)" : "rgba(224,96,96,0.4)"}`,
          background: winner === "crew" ? "var(--green-glow)" : "var(--red-glow)",
        }}>
          <h2 style={{ marginBottom: "0.4rem" }}>
            {winner === "crew" ? "Crew Wins!" : winner === "impostors" ? "Impostors Win!" : "Game Over"}
          </h2>
          <p className="muted">
            {winner === "crew"
              ? "The crew successfully identified all impostors."
              : winner === "impostors"
                ? "The impostors blended in and outlasted the crew."
                : "The game has ended."}
          </p>
        </div>

        {/* The word */}
        {results?.word && (
          <div style={{
            textAlign: "center", padding: "1rem", borderRadius: "var(--radius)",
            background: "var(--surface2)", border: "1px solid var(--border)", marginBottom: "1rem",
          }}>
            <div className="label" style={{ marginBottom: "0.4rem" }}>The Secret Word Was</div>
            <div style={{ fontFamily: "'Krona One', sans-serif", fontSize: "1.6rem" }}>{results.word}</div>
            <div className="muted" style={{ marginTop: "0.25rem" }}>Category: {results.category}</div>
          </div>
        )}

        {/* Players with roles revealed */}
        <div className="mb">
          <div className="label">Players</div>
          <div className="stack-sm">
            {players.map((p) => {
              const isImpostor = impostorIds.includes(p.id);
              return (
                <div key={p.id} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "0.6rem 0.9rem", borderRadius: "var(--radius-sm)",
                  background: "var(--surface2)",
                  border: `1px solid ${p.isEliminated ? "rgba(224,96,96,0.25)" : "var(--border)"}`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontWeight: 700 }}>{p.name}</span>
                    {p.id === myId && <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>(you)</span>}
                  </div>
                  <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                    <span style={{
                      fontSize: "0.65rem", fontWeight: 700, padding: "0.15rem 0.5rem",
                      borderRadius: "999px", textTransform: "uppercase", letterSpacing: "0.06em",
                      background: isImpostor ? "var(--red)" : "var(--surface3)",
                      color: isImpostor ? "#fff" : "var(--muted)",
                      border: isImpostor ? "none" : "1px solid var(--border-bright)",
                    }}>
                      {isImpostor ? "Impostor" : "Crew"}
                    </span>
                    <span style={{
                      fontSize: "0.65rem", fontWeight: 700, padding: "0.15rem 0.5rem",
                      borderRadius: "999px", textTransform: "uppercase", letterSpacing: "0.06em",
                      background: p.isEliminated ? "rgba(224,96,96,0.1)" : "rgba(106,191,122,0.1)",
                      color: p.isEliminated ? "var(--red)" : "var(--green)",
                      border: `1px solid ${p.isEliminated ? "rgba(224,96,96,0.25)" : "rgba(106,191,122,0.25)"}`,
                    }}>
                      {p.isEliminated ? "Eliminated" : "Survived"}
                    </span>
                  </div>
                </div>
              );
            })}
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
