import React from "react";
import { socket } from "../socket";

export default function TiebreakerRevealScreen({ room, myId }) {
  const isHost = room.hostId === myId;
  const players = room.players || [];
  const activePlayers = players.filter((p) => !p.isEliminated);
  const allSubmissions = room.allSubmissions || {};
  const tbKey = `tb_${room.tiebreakerCount}`;
  const tbData = allSubmissions[tbKey] || {};

  return (
    <div className="container">
      <div className="card wide">
        <div className="center-text mb">
          <h2>Tiebreaker #{room.tiebreakerCount} Answers</h2>
          <p className="muted">Review before voting on the tied players.</p>
        </div>

        <div style={{
          padding: "0.65rem 1rem", borderRadius: "var(--radius-sm)", marginBottom: "1rem",
          background: "rgba(212,168,71,0.08)", border: "1px solid rgba(212,168,71,0.3)",
          fontSize: "0.875rem", color: "var(--yellow)",
        }}>
          Tied players: {(room.tiedPlayerIds || []).map(id => players.find(p => p.id === id)?.name).join(", ")}
        </div>

        <div className="mb">
          <div className="label">Tiebreaker Answers</div>
          <div className="answer-grid">
            {activePlayers.map((p) => (
              <div className="answer-card" key={p.id}>
                <div className="answer-name">{p.name}{p.id === myId ? " (you)" : ""}</div>
                <div className="answer-text">
                  {tbData[p.id] || <span style={{ color: "var(--muted)", fontStyle: "italic" }}>No answer</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {isHost ? (
          <button className="btn-primary" onClick={() => socket.emit("host:advance_to_voting")}>
            Vote on Tied Players
          </button>
        ) : (
          <p className="muted center-text">Waiting for host to proceed...</p>
        )}
      </div>
    </div>
  );
}
