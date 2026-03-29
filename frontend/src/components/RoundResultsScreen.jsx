import React from "react";
import { socket } from "../socket";

export default function RoundResultsScreen({ room, myId }) {
  const isHost = room.hostId === myId;
  const results = room.roundResults;
  const players = room.players || [];
  const isLastRound = room.roundNumber >= room.settings?.totalRounds;

  if (!results) return null;

  // Sort players by score descending
  const sorted = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="container">
      <div className="card wide">
        <div className="center-text mb">
          <h2>Round {room.roundNumber} Results</h2>
        </div>

        {/* Word reveal */}
        <div style={{
          textAlign: "center",
          padding: "1rem",
          background: "var(--surface2)",
          borderRadius: "var(--radius)",
          marginBottom: "1rem",
          border: "1px solid var(--border)"
        }}>
          <div className="label">The Secret Word Was</div>
          <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--accent)" }}>
            {results.word}
          </div>
          <div className="muted" style={{ marginTop: "0.25rem" }}>Category: {results.category}</div>
        </div>

        {/* Impostor reveal */}
        <div className="result-impostor-reveal mb">
          <div className="label" style={{ color: "var(--red)", marginBottom: "0.5rem" }}>
            {results.impostorIds.length === 0 ? "No Impostors This Round" : "The Impostor(s)"}
          </div>
          {results.impostorIds.length === 0 ? (
            <p className="muted">Everyone was a normal player!</p>
          ) : (
            <div className="stack-sm">
              {results.impostorNames.map((name, i) => (
                <div key={i} style={{ fontWeight: 700, fontSize: "1.1rem" }}>{name}</div>
              ))}
            </div>
          )}
        </div>

        {/* Vote outcome */}
        <div style={{
          padding: "0.75rem 1rem",
          background: results.votedOutIsImpostor ? "rgba(34,197,94,0.08)" : "rgba(245,158,11,0.08)",
          border: `1px solid ${results.votedOutIsImpostor ? "var(--green)" : "var(--yellow)"}`,
          borderRadius: "var(--radius)",
          marginBottom: "1rem",
          textAlign: "center",
        }}>
          {results.votedOutId ? (
            <>
              <div style={{ fontWeight: 700, color: results.votedOutIsImpostor ? "var(--green)" : "var(--yellow)" }}>
                {results.votedOutIsImpostor ? "Impostor Caught!" : "Wrong Guess!"}
              </div>
              <div className="muted" style={{ fontSize: "0.9rem", marginTop: "0.2rem" }}>
                {results.votedOutName} was voted out —{" "}
                {results.votedOutIsImpostor ? "they were an impostor" : "they were innocent"}
              </div>
            </>
          ) : (
            <div className="muted">No one was voted out</div>
          )}
        </div>

        {/* Scoreboard */}
        <div className="mb">
          <div className="label">Scoreboard</div>
          <div className="stack-sm">
            {sorted.map((p, idx) => {
              const delta = results.pointsAwarded?.[p.id];
              return (
                <div className={`score-row ${idx === 0 ? "top" : ""}`} key={p.id}>
                  <span>
                    <span style={{ color: "var(--muted)", marginRight: "0.5rem" }}>#{idx + 1}</span>
                    <strong>{p.name}</strong>
                    {p.id === myId && <span className="muted"> (you)</span>}
                  </span>
                  <span className="row" style={{ gap: "0.75rem" }}>
                    {delta > 0 && <span className="score-delta">+{delta}</span>}
                    <span style={{ fontWeight: 700 }}>{p.score} pts</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {isHost ? (
          <button className="btn-primary" onClick={() => socket.emit("host:next_round")}>
            {isLastRound ? "See Final Results" : `Start Round ${room.roundNumber + 1}`}
          </button>
        ) : (
          <p className="muted center-text">Waiting for host...</p>
        )}
      </div>
    </div>
  );
}
