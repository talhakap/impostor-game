import React, { useState } from "react";
import { socket } from "../socket";

export default function VotingScreen({ room, myId }) {
  const [selectedId, setSelectedId] = useState(null);
  const [voted, setVoted] = useState(false);

  const players = room.players || [];
  const me = players.find((p) => p.id === myId);
  const myVote = room.votes?.[myId];
  const hasVoted = voted || !!myVote;
  const isEliminated = me?.isEliminated;
  const votedCount = players.filter((p) => p.hasVoted && !p.isEliminated).length;
  const activeCount = players.filter((p) => !p.isEliminated && p.isConnected).length;

  // Only non-eliminated, connected players can be voted for
  const voteTargets = players.filter((p) => !p.isEliminated && p.isConnected);

  const handleVote = () => {
    if (!selectedId || hasVoted || isEliminated) return;
    socket.emit("player:submit_vote", { targetId: selectedId });
    setVoted(true);
  };

  return (
    <div className="container">
      <div className="card wide">
        <div className="center-text mb">
          <h2>Who is the Impostor?</h2>
          <p className="muted">
            {isEliminated
              ? "You were eliminated — watching the vote."
              : hasVoted
                ? `Vote submitted. Waiting for others... (${votedCount}/${activeCount})`
                : `Vote for who you think is faking it. ${room.settings?.impostorCount > 1 ? `Top ${room.settings.impostorCount} most-voted players will be eliminated.` : "Most-voted player will be eliminated."}`}
          </p>
        </div>

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
