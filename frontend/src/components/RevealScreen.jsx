import React from "react";
import { socket } from "../socket";

export default function RevealScreen({ room, myId, isTiebreaker }) {
  const isHost = room.hostId === myId;
  const players = room.players || [];
  const allSubmissions = room.allSubmissions || {};

  // For regular reveal: show round_1, round_2, ...
  // For tiebreaker reveal: show tb_N (most recent)
  const roundKeys = isTiebreaker
    ? [`tb_${room.tiebreakerCount}`]
    : Object.keys(allSubmissions)
        .filter((k) => k.startsWith("round_"))
        .sort((a, b) => Number(a.split("_")[1]) - Number(b.split("_")[1]));

  const activePlayers = players.filter((p) => !p.isEliminated);

  const roundLabel = (key) => {
    if (key.startsWith("tb_")) return `Tiebreaker #${key.split("_")[1]}`;
    return `Round ${key.split("_")[1]}`;
  };

  return (
    <div className="container">
      <div className="card wide">
        <div className="center-text mb">
          <h2>{isTiebreaker ? `Tiebreaker #${room.tiebreakerCount} Answers` : "All Answers"}</h2>
          <p className="muted">
            {isTiebreaker
              ? "Review these answers before voting on the tied players."
              : "Review all answers before voting."}
          </p>
        </div>

        {/* Per-round answer grids */}
        {roundKeys.map((key) => {
          const roundData = allSubmissions[key] || {};
          return (
            <div key={key} className="mb">
              <div className="label">{roundLabel(key)}</div>
              <div className="answer-grid">
                {activePlayers.map((p) => (
                  <div className="answer-card" key={p.id}>
                    <div className="answer-name">
                      {p.name}{p.id === myId ? " (you)" : ""}
                    </div>
                    <div className="answer-text">
                      {roundData[p.id] || <span style={{ color: "var(--muted)", fontStyle: "italic" }}>No answer</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {isHost ? (
          <button className="btn-primary" onClick={() => socket.emit("host:advance_to_voting")}>
            {isTiebreaker ? "Vote on Tied Players" : "Proceed to Vote"}
          </button>
        ) : (
          <p className="muted center-text">Waiting for host to proceed...</p>
        )}
      </div>
    </div>
  );
}
