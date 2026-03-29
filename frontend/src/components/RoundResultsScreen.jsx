import React from "react";
import { socket } from "../socket";

export default function RoundResultsScreen({ room, myId }) {
  const isHost = room.hostId === myId;
  const results = room.roundResults;
  const players = room.players || [];

  if (!results) return null;

  const nameMap = Object.fromEntries(players.map((p) => [p.id, p.name]));
  const { voteMap, voteCounts, eliminatedIds, eliminatedRoles, impostorIds, winner } = results;

  // Build per-player vote breakdown: targetId → [voterIds]
  const votesReceived = {};
  players.forEach((p) => { votesReceived[p.id] = []; });
  Object.entries(voteMap || {}).forEach(([voterId, targetId]) => {
    if (votesReceived[targetId]) votesReceived[targetId].push(voterId);
  });

  // Sort active players by votes descending
  const activePlayers = players.filter((p) => p.id in (voteCounts || {}));
  const sorted = [...activePlayers].sort(
    (a, b) => (voteCounts[b.id] || 0) - (voteCounts[a.id] || 0)
  );

  const isEliminated = (id) => eliminatedIds?.includes(id);
  const isImpostor = (id) => impostorIds?.includes(id);

  return (
    <div className="container">
      <div className="card wide">
        <div className="center-text mb">
          <h2>Round {room.roundNumber} Results</h2>
          <p className="muted">Category: {results.category} — The word was <strong style={{ color: "var(--text)" }}>{results.word}</strong></p>
        </div>

        {/* Winner banner */}
        {winner && (
          <div style={{
            textAlign: "center",
            padding: "1rem 1.5rem",
            borderRadius: "var(--radius)",
            marginBottom: "1rem",
            border: `1px solid ${winner === "crew" ? "rgba(106,191,122,0.4)" : "rgba(224,96,96,0.4)"}`,
            background: winner === "crew" ? "var(--green-glow)" : "var(--red-glow)",
          }}>
            <div style={{ fontFamily: "'Krona One', sans-serif", fontSize: "1.1rem", marginBottom: "0.3rem" }}>
              {winner === "crew" ? "Crew Wins!" : "Impostors Win!"}
            </div>
            <p className="muted" style={{ fontSize: "0.85rem" }}>
              {winner === "crew"
                ? "All impostors have been eliminated."
                : "The crew couldn't find the impostors in time."}
            </p>
          </div>
        )}

        {/* Eliminated players */}
        <div style={{
          padding: "1rem 1.25rem",
          borderRadius: "var(--radius)",
          marginBottom: "1rem",
          border: "1px solid rgba(224,96,96,0.3)",
          background: "var(--red-glow)",
        }}>
          <div className="label" style={{ color: "var(--red)", marginBottom: "0.5rem" }}>Eliminated</div>
          {eliminatedIds?.length === 0 ? (
            <p className="muted">No one was eliminated.</p>
          ) : (
            <div className="stack-sm">
              {eliminatedIds.map((id, i) => (
                <div key={id} style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <span style={{ fontWeight: 700 }}>{nameMap[id] || "Unknown"}</span>
                  <span style={{
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    padding: "0.15rem 0.5rem",
                    borderRadius: "999px",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    background: eliminatedRoles?.[i] === "impostor" ? "var(--red)" : "var(--surface3)",
                    color: eliminatedRoles?.[i] === "impostor" ? "#fff" : "var(--muted)",
                    border: eliminatedRoles?.[i] === "impostor" ? "none" : "1px solid var(--border-bright)",
                  }}>
                    {eliminatedRoles?.[i] === "impostor" ? "Impostor" : "Crew"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Vote breakdown */}
        <div className="mb">
          <div className="label">Vote Breakdown</div>
          <div className="stack-sm">
            {sorted.map((p) => {
              const count = voteCounts?.[p.id] || 0;
              const voters = votesReceived[p.id] || [];
              const eliminated = isEliminated(p.id);
              const impostor = isImpostor(p.id);

              return (
                <div key={p.id} style={{
                  background: "var(--surface2)",
                  border: `1px solid ${eliminated ? "rgba(224,96,96,0.4)" : "var(--border)"}`,
                  borderRadius: "var(--radius-sm)",
                  padding: "0.65rem 0.9rem",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: voters.length > 0 ? "0.4rem" : 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontWeight: 700 }}>{p.name}</span>
                      {p.id === myId && <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>(you)</span>}
                      {impostor && (
                        <span style={{
                          fontSize: "0.65rem", fontWeight: 700, padding: "0.15rem 0.45rem",
                          borderRadius: "999px", background: "var(--red)", color: "#fff",
                          textTransform: "uppercase", letterSpacing: "0.06em",
                        }}>Impostor</span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      {eliminated && (
                        <span style={{
                          fontSize: "0.65rem", fontWeight: 700, padding: "0.15rem 0.45rem",
                          borderRadius: "999px", background: "rgba(224,96,96,0.15)",
                          color: "var(--red)", border: "1px solid rgba(224,96,96,0.3)",
                          textTransform: "uppercase", letterSpacing: "0.06em",
                        }}>Out</span>
                      )}
                      <span style={{ fontWeight: 700, color: count > 0 ? "var(--text)" : "var(--muted)" }}>
                        {count} {count === 1 ? "vote" : "votes"}
                      </span>
                    </div>
                  </div>
                  {voters.length > 0 && (
                    <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                      Voted by: {voters.map((id) => nameMap[id] || "?").join(", ")}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Impostors reveal */}
        <div style={{
          padding: "0.75rem 1.25rem",
          borderRadius: "var(--radius-sm)",
          marginBottom: "1rem",
          border: "1px solid var(--border)",
          background: "var(--surface2)",
        }}>
          <div className="label" style={{ marginBottom: "0.4rem" }}>The Impostors Were</div>
          <div style={{ fontWeight: 600 }}>
            {results.impostorNames?.length > 0
              ? results.impostorNames.join(", ")
              : "None"}
          </div>
        </div>

        {isHost ? (
          <button className="btn-primary" onClick={() => socket.emit("host:next_round")}>
            {winner ? "See Final Results" : `Start Round ${room.roundNumber + 1}`}
          </button>
        ) : (
          <p className="muted center-text">Waiting for host...</p>
        )}
      </div>
    </div>
  );
}
