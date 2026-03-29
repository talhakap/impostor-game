import React from "react";
import { socket } from "../socket";

export default function RoundCompleteScreen({ room, myId }) {
  const isHost = room.hostId === myId;
  const { answeringRound, settings } = room;
  const isLastRound = answeringRound >= settings.totalRounds;

  return (
    <div className="container">
      <div className="card center-text">
        <h2>Round {answeringRound} Complete</h2>
        <p className="muted" style={{ marginTop: "0.5rem" }}>
          {isLastRound
            ? "All rounds are done. Time to see everyone's answers and vote."
            : `${settings.totalRounds - answeringRound} round${settings.totalRounds - answeringRound > 1 ? "s" : ""} remaining.`}
        </p>

        {isHost ? (
          <button
            className="btn-primary"
            style={{ marginTop: "1.5rem" }}
            onClick={() => socket.emit("host:advance_round")}
          >
            {isLastRound ? "Reveal All Answers" : `Start Round ${answeringRound + 1}`}
          </button>
        ) : (
          <p className="muted" style={{ marginTop: "1.25rem" }}>Waiting for host...</p>
        )}
      </div>
    </div>
  );
}
