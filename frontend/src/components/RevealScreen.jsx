import React from "react";
import { socket } from "../socket";

export default function RevealScreen({ room, myId }) {
  const isHost = room.hostId === myId;
  const players = room.players || [];
  const submissions = room.submissions || {};

  // Map id -> name for display
  const nameMap = Object.fromEntries(players.map((p) => [p.id, p.name]));

  return (
    <div className="container">
      <div className="card wide">
        <div className="center-text mb">
          <h2>Answers Revealed</h2>
          <p className="muted">Round {room.roundNumber} — read everyone's answers</p>
        </div>

        <div className="answer-grid mb">
          {Object.entries(submissions).map(([playerId, answer]) => (
            <div className="answer-card" key={playerId}>
              <div className="answer-name">
                {nameMap[playerId] || "Unknown"}
                {playerId === myId && " (you)"}
              </div>
              <div className="answer-text">{answer}</div>
            </div>
          ))}
        </div>

        {isHost ? (
          <button
            className="btn-primary"
            onClick={() => socket.emit("host:advance_to_voting")}
          >
            Proceed to Voting
          </button>
        ) : (
          <p className="muted center-text">Waiting for host to proceed...</p>
        )}
      </div>
    </div>
  );
}
