import React, { useState } from "react";
import { socket } from "../socket";

export default function VotingScreen({ room, myId, isTiebreaker }) {
  const [selectedId, setSelectedId] = useState(null);
  const [voted, setVoted] = useState(false);

  const players = room.players || [];
  const me = players.find((p) => p.id === myId);
  const hasVoted = voted || !!me?.hasVoted;
  const isEliminated = me?.isEliminated;
  const allSubmissions = room.allSubmissions || {};

  const voteTargets = isTiebreaker
    ? players.filter((p) => (room.tiedPlayerIds || []).includes(p.id))
    : players.filter((p) => !p.isEliminated && p.isConnected);

  const activePlayers = players.filter((p) => !p.isEliminated);
  const votedCount = players.filter((p) => p.hasVoted && !p.isEliminated).length;
  const activeCount = players.filter((p) => !p.isEliminated && p.isConnected).length;

  // Round keys to display (regular rounds, or tiebreaker round)
  const roundKeys = isTiebreaker
    ? [`tb_${room.tiebreakerCount}`]
    : Object.keys(allSubmissions)
        .filter((k) => k.startsWith("round_"))
        .sort((a, b) => Number(a.split("_")[1]) - Number(b.split("_")[1]));

  const roundLabel = (key) =>
    key.startsWith("tb_") ? `Tiebreaker #${key.split("_")[1]}` : `Round ${key.split("_")[1]}`;

  const handleVote = () => {
    if (!selectedId || hasVoted || isEliminated) return;
    socket.emit("player:submit_vote", { targetId: selectedId });
    setVoted(true);
  };

  return (
    <div className="container">
      <div className="card wide">
        <div className="center-text mb">
          <h2>{isTiebreaker ? "Tiebreaker Vote" : "Who is the Impostor?"}</h2>
          <p className="muted">
            {isEliminated
              ? "You were eliminated — watching the vote."
              : hasVoted
                ? `Vote submitted. Waiting for others... (${votedCount}/${activeCount})`
                : isTiebreaker
                  ? "Vote for one of the tied players."
                  : `Vote for who you think is faking it.${room.settings?.impostorCount > 1 ? ` Top ${room.settings.impostorCount} most-voted will be eliminated.` : ""}`}
          </p>
        </div>

        {/* All answers for reference */}
        {roundKeys.map((key) => {
          const roundData = allSubmissions[key] || {};
          return (
            <div key={key} className="mb">
              <div className="label">{roundLabel(key)} Answers</div>
              <div className="answer-grid">
                {activePlayers.map((p) => (
                  <div className="answer-card" key={p.id}>
                    <div className="answer-name">{p.name}{p.id === myId ? " (you)" : ""}</div>
                    <div className="answer-text">
                      {roundData[p.id] || <span style={{ color: "var(--muted)", fontStyle: "italic" }}>No answer</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        <hr className="divider" />

        {isTiebreaker && (
          <div style={{
            padding: "0.65rem 1rem", borderRadius: "var(--radius-sm)", marginBottom: "1rem",
            background: "rgba(212,168,71,0.08)", border: "1px solid rgba(212,168,71,0.3)",
            fontSize: "0.875rem", color: "var(--yellow)", textAlign: "center",
          }}>
            These players were tied — vote to break the tie.
          </div>
        )}

        <div className="vote-grid mb">
          {voteTargets.map((p) => {
            const isSelf = p.id === myId;
            const isSelected = selectedId === p.id;
            return (
              <div
                key={p.id}
                className={`vote-card ${isSelf ? "self" : ""} ${isSelected ? "selected" : ""} ${hasVoted || isEliminated ? "voted" : ""}`}
                onClick={() => {
                  if (isSelf || hasVoted || isEliminated) return;
                  setSelectedId(p.id);
                }}
              >
                <div className="vote-name">{p.name}</div>
                {isSelf && <div className="vote-sub">You</div>}
                {p.hasVoted && !isSelf && <div className="vote-sub" style={{ color: "var(--green)" }}>Voted</div>}
              </div>
            );
          })}
        </div>

        {!hasVoted && !isEliminated && (
          <button className="btn-primary" onClick={handleVote} disabled={!selectedId}>
            {selectedId
              ? `Vote for ${players.find((p) => p.id === selectedId)?.name}`
              : "Select a player"}
          </button>
        )}
      </div>
    </div>
  );
}
