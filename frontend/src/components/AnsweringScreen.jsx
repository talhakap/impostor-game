import React, { useState, useEffect, useRef } from "react";
import { socket } from "../socket";

export default function AnsweringScreen({ room, myId, privateData }) {
  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const intervalRef = useRef(null);

  const mySubmission = room.submissions?.[myId];
  const hasSubmitted = submitted || mySubmission === true || typeof mySubmission === "string";

  // Countdown timer
  useEffect(() => {
    if (!room.timerEndsAt) return;

    const tick = () => {
      const left = Math.max(0, Math.ceil((room.timerEndsAt - Date.now()) / 1000));
      setTimeLeft(left);
    };

    tick();
    intervalRef.current = setInterval(tick, 500);
    return () => clearInterval(intervalRef.current);
  }, [room.timerEndsAt]);

  const handleSubmit = () => {
    const trimmed = answer.trim();
    if (!trimmed || hasSubmitted) return;
    socket.emit("player:submit_answer", { answer: trimmed });
    setSubmitted(true);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const timerClass =
    timeLeft === null ? "ok"
    : timeLeft <= 10 ? "urgent"
    : timeLeft <= 20 ? "warning"
    : "ok";

  const players = room.players || [];
  const submittedCount = players.filter((p) => p.hasSubmitted).length;

  return (
    <div className="container">
      <div className="card wide">
        <div className="row-between mb">
          <span className="muted">Round {room.roundNumber} / {room.settings?.totalRounds}</span>
          {timeLeft !== null && (
            <span className={`timer ${timerClass}`}>{timeLeft}s</span>
          )}
        </div>

        {privateData && (
          <div className={`role-card ${privateData.role}`}>
            <div className={`role-label ${privateData.role}`}>
              {privateData.role === "impostor" ? "You are the Impostor" : "You are a Normal Player"}
            </div>
            {privateData.role === "normal" ? (
              <>
                <div className="role-word">{privateData.word}</div>
                <div className="role-hint">Category: {privateData.category}</div>
              </>
            ) : (
              <div className="role-word" style={{ fontSize: "1.2rem" }}>Category: {privateData.category}</div>
            )}
          </div>
        )}

        {!hasSubmitted ? (
          <div className="stack">
            <div>
              <div className="label">
                {privateData?.role === "impostor"
                  ? "Bluff your answer — don't reveal you're the impostor"
                  : "Give a clue — don't say the word directly"}
              </div>
              <textarea
                placeholder="Your answer..."
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={handleKeyDown}
                maxLength={200}
                autoFocus
              />
            </div>
            <button
              className="btn-primary"
              onClick={handleSubmit}
              disabled={!answer.trim()}
            >
              Submit Answer
            </button>
          </div>
        ) : (
          <div className="center-text mt" style={{ padding: "1rem 0" }}>
            <p style={{ color: "var(--green)", fontWeight: 700, marginBottom: "0.5rem" }}>
              Answer submitted!
            </p>
            <p className="muted">Waiting for others... ({submittedCount}/{players.length})</p>
          </div>
        )}

        <hr className="divider" />

        <div className="stack-sm">
          <div className="label">Players</div>
          {players.map((p) => (
            <div className="player-item" key={p.id}>
              <span className="name">{p.name}{p.id === myId ? " (you)" : ""}</span>
              <span className={`badge ${p.hasSubmitted ? "badge-submitted" : "badge-pending"}`}>
                {p.hasSubmitted ? "Ready" : "Thinking..."}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
