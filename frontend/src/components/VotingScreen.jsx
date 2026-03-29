import React, { useState } from "react";
import { socket } from "../socket";

export default function VotingScreen({ room, myId }) {
  const [selectedId, setSelectedId] = useState(null);
  const [voted, setVoted] = useState(false);

  const players = room.players || [];
  const myVote = room.votes?.[myId];
  const hasVoted = voted || !!myVote;
  const votedCount = players.filter((p) => p.hasVoted).length;

  const handleVote = () => {
    if (!selectedId || hasVoted) return;
    socket.emit("player:submit_vote", { targetId: selectedId });
    setVoted(true);
  };

  return (
    <div className="container">
      <div className="card wide">
        <div className="center-text mb">
          <h2>Who is the Impostor?</h2>
          <p className="muted">
            {hasVoted
              ? `Vote submitted. Waiting for others... (${votedCount}/${players.length})`
              : "Vote for who you think is faking it."}
          </p>
        </div>

        <div className="vote-grid mb">
          {players.map((p) => {
            const isSelf = p.id === myId;
            const isSelected = selectedId === p.id;

            return (
              <div
                key={p.id}
                className={`vote-card ${isSelf ? "self" : ""} ${isSelected ? "selected" : ""} ${hasVoted ? "voted" : ""}`}
                onClick={() => {
                  if (isSelf || hasVoted) return;
                  setSelectedId(p.id);
                }}
              >
                <div className="vote-name">{p.name}</div>
                {isSelf && <div className="vote-sub">That's you</div>}
                {p.hasVoted && !isSelf && <div className="vote-sub" style={{ color: "var(--green)" }}>Voted</div>}
              </div>
            );
          })}
        </div>

        {!hasVoted && (
          <button
            className="btn-primary"
            onClick={handleVote}
            disabled={!selectedId}
          >
            {selectedId
              ? `Vote for ${players.find((p) => p.id === selectedId)?.name}`
              : "Select a player"}
          </button>
        )}
      </div>
    </div>
  );
}
