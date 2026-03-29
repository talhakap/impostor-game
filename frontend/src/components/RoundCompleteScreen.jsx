import React from "react";
import { socket } from "../socket";

export default function RoundCompleteScreen({ room, myId }) {
  const isHost = room.hostId === myId;
  const { answeringRound, settings } = room;
  const isLastRound = answeringRound >= settings.totalRounds;
  const players = room.players || [];
  const activePlayers = players.filter((p) => !p.isEliminated);
  const allSubmissions = room.allSubmissions || {};

  const roundKeys = Object.keys(allSubmissions)
    .filter((k) => k.startsWith("round_"))
    .sort((a, b) => Number(a.split("_")[1]) - Number(b.split("_")[1]));

  return (
    <div className="container">
      <div className="card wide">
        <div className="center-text mb">
          <h2>Round {answeringRound} Complete</h2>
          <p className="muted">
            {isLastRound
              ? "All rounds done — review the answers below, then proceed to vote."
              : `${settings.totalRounds - answeringRound} round${settings.totalRounds - answeringRound > 1 ? "s" : ""} remaining.`}
          </p>
        </div>

        {/* Answers so far */}
        {roundKeys.map((key) => {
          const roundNum = key.split("_")[1];
          const roundData = allSubmissions[key] || {};
          return (
            <div key={key} className="mb">
              <div className="label">Round {roundNum} Answers</div>
              <div className="answer-grid">
                {activePlayers.map((p) => (
                  <div className="answer-card" key={p.id}>
                    <div className="answer-name">
                      {p.name}{p.id === myId ? " (you)" : ""}
                    </div>
                    <div className="answer-text">
                      {roundData[p.id] || (
                        <span style={{ color: "var(--muted)", fontStyle: "italic" }}>No answer</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {isHost ? (
          <button
            className="btn-primary"
            onClick={() => socket.emit("host:advance_round")}
          >
            {isLastRound ? "Proceed to Vote" : `Start Round ${answeringRound + 1}`}
          </button>
        ) : (
          <p className="muted center-text">Waiting for host...</p>
        )}
      </div>
    </div>
  );
}
