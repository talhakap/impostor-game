import React from "react";
import { socket } from "../socket";

export default function AllAnswersScreen({ room, myId }) {
  const isHost = room.hostId === myId;
  const revealedAnswers = room.revealedAnswers || {};

  return (
    <div className="container">
      <div className="card wide">
        <div className="center-text mb">
          <h2>All Answers</h2>
          <p className="muted">Everyone has answered — who's faking it?</p>
        </div>

        <div className="stack-sm" style={{ marginBottom: "1.25rem" }}>
          {room.playerAnswerOrder
            .filter((id) => room.players.find((p) => p.id === id))
            .map((id) => {
              const p = room.players.find((pl) => pl.id === id);
              const ans = revealedAnswers[id];
              return (
                <div className="player-item" key={id} style={{
                  background: "var(--surface2)",
                  borderRadius: "var(--radius-sm)",
                  padding: "0.65rem 0.9rem",
                  border: "1px solid var(--border)",
                }}>
                  <span className="name">{p?.name ?? "Unknown"}</span>
                  <span style={{
                    fontSize: "0.92rem",
                    color: ans ? "var(--text)" : "var(--muted)",
                    fontStyle: ans ? "normal" : "italic",
                    fontWeight: ans ? 600 : 400,
                  }}>
                    {ans || "no answer"}
                  </span>
                </div>
              );
            })}
        </div>

        {isHost ? (
          <button
            className="btn-primary"
            onClick={() => socket.emit("host:proceed_to_vote")}
          >
            Proceed to Vote
          </button>
        ) : (
          <p className="muted center-text">Waiting for host to start the vote...</p>
        )}
      </div>
    </div>
  );
}
