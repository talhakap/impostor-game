import React from "react";
import { socket } from "../socket";

export default function RoundResultsScreen({ room, myId }) {
  const isHost = room.hostId === myId;
  const results = room.roundResults;
  const players = room.players || [];
  if (!results) return null;

  const nameMap = Object.fromEntries(players.map((p) => [p.id, p.name]));
  const { voteMap, voteCounts, eliminatedIds, eliminatedNames } = results;

  // Build per-player voter list
  const votesReceived = {};
  players.forEach((p) => { votesReceived[p.id] = []; });
  Object.entries(voteMap || {}).forEach(([voterId, targetId]) => {
    if (votesReceived[targetId]) votesReceived[targetId].push(voterId);
  });

  // Sort by votes descending (only players who were voted for)
  const votedPlayers = players.filter((p) => p.id in (voteCounts || {}));
  const sorted = [...votedPlayers].sort((a, b) => (voteCounts[b.id] || 0) - (voteCounts[a.id] || 0));

  return (
    <div className="container">
      <div className="card wide">
        <div className="center-text mb">
          <h2>Vote Results</h2>
          <p className="muted">Category: {results.category}</p>
        </div>

        {/* Eliminated */}
        <div style={{
          padding: "1rem 1.25rem", borderRadius: "var(--radius)", marginBottom: "1rem",
          border: "1px solid rgba(224,96,96,0.3)", background: "var(--red-glow)",
        }}>
          <div className="label" style={{ color: "var(--red)", marginBottom: "0.5rem" }}>Eliminated</div>
          {eliminatedIds?.length === 0 ? (
            <p className="muted">No one was eliminated.</p>
          ) : (
            <div style={{ fontWeight: 700 }}>{eliminatedNames?.join(", ")}</div>
          )}
        </div>

        {/* Vote breakdown */}
        <div className="mb">
          <div className="label">Vote Breakdown</div>
          <div className="stack-sm">
            {sorted.map((p) => {
              const count = voteCounts?.[p.id] || 0;
              const voters = votesReceived[p.id] || [];
              const isOut = eliminatedIds?.includes(p.id);

              return (
                <div key={p.id} style={{
                  background: "var(--surface2)",
                  border: `1px solid ${isOut ? "rgba(224,96,96,0.35)" : "var(--border)"}`,
                  borderRadius: "var(--radius-sm)",
                  padding: "0.65rem 0.9rem",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: voters.length > 0 ? "0.35rem" : 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontWeight: 700 }}>{p.name}</span>
                      {p.id === myId && <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>(you)</span>}
                      {isOut && (
                        <span style={{
                          fontSize: "0.65rem", fontWeight: 700, padding: "0.15rem 0.45rem",
                          borderRadius: "999px", background: "rgba(224,96,96,0.15)",
                          color: "var(--red)", border: "1px solid rgba(224,96,96,0.3)",
                          textTransform: "uppercase", letterSpacing: "0.06em",
                        }}>Out</span>
                      )}
                    </div>
                    <span style={{ fontWeight: 700, color: count > 0 ? "var(--text)" : "var(--muted)" }}>
                      {count} {count === 1 ? "vote" : "votes"}
                    </span>
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

        {isHost ? (
          <button className="btn-primary" onClick={() => socket.emit("host:next_round")}>
            {results.winner ? "See Final Results" : "Continue"}
          </button>
        ) : (
          <p className="muted center-text">Waiting for host...</p>
        )}
      </div>
    </div>
  );
}
