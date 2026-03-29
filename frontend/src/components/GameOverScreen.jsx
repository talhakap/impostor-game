import React from "react";
import { socket } from "../socket";

export default function GameOverScreen({ room, myId }) {
  const isHost = room.hostId === myId;
  const players = room.players || [];
  const results = room.roundResults;
  const winner = results?.winner;

  const crew = players.filter((p) => !results?.impostorIds?.includes(p.id));
  const impostors = players.filter((p) => results?.impostorIds?.includes(p.id));

  const medals = ["1st", "2nd", "3rd"];

  return (
    <div className="container">
      <div className="card wide">

        {/* Winner banner */}
        <div style={{
          textAlign: "center",
          padding: "1.5rem",
          borderRadius: "var(--radius)",
          marginBottom: "1.5rem",
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

        {/* Impostors revealed */}
        <div style={{
          padding: "0.9rem 1.25rem",
          borderRadius: "var(--radius-sm)",
          marginBottom: "1rem",
          border: "1px solid rgba(224,96,96,0.3)",
          background: "var(--red-glow)",
        }}>
          <div className="label" style={{ color: "var(--red)", marginBottom: "0.4rem" }}>Impostors</div>
          <div style={{ fontWeight: 700, fontSize: "1rem" }}>
            {impostors.length > 0 ? impostors.map((p) => p.name).join(", ") : "None"}
          </div>
        </div>

        {/* All players — survival status */}
        <div className="mb">
          <div className="label">Players</div>
          <div className="stack-sm">
            {players.map((p, idx) => {
              const isImpostor = results?.impostorIds?.includes(p.id);
              return (
                <div key={p.id} style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.6rem 0.9rem",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--surface2)",
                  border: `1px solid ${p.isEliminated ? "rgba(224,96,96,0.3)" : "var(--border)"}`,
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
                      background: p.isEliminated ? "rgba(224,96,96,0.12)" : "rgba(106,191,122,0.12)",
                      color: p.isEliminated ? "var(--red)" : "var(--green)",
                      border: `1px solid ${p.isEliminated ? "rgba(224,96,96,0.3)" : "rgba(106,191,122,0.3)"}`,
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
