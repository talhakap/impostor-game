import React, { useState, useEffect, useRef } from "react";
import { socket } from "../socket";

function useCountdown(timerEndsAt) {
  const [secsLeft, setSecsLeft] = useState(0);
  useEffect(() => {
    if (!timerEndsAt) { setSecsLeft(0); return; }
    const tick = () => setSecsLeft(Math.max(0, Math.ceil((timerEndsAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [timerEndsAt]);
  return secsLeft;
}

export default function PlayerAnsweringScreen({ room, myId, privateData }) {
  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const inputRef = useRef(null);

  const secsLeft = useCountdown(room.timerEndsAt);
  const currentPlayerId = room.currentAnsweringPlayerId;
  const isMyTurn = currentPlayerId === myId;
  const currentPlayer = room.players.find((p) => p.id === currentPlayerId);
  const revealedAnswers = room.revealedAnswers || {};

  // Reset submission state when it becomes a new player's turn
  useEffect(() => {
    setSubmitted(false);
    setAnswer("");
  }, [currentPlayerId]);

  // Focus input when it's my turn
  useEffect(() => {
    if (isMyTurn && inputRef.current) inputRef.current.focus();
  }, [isMyTurn]);

  const handleSubmit = () => {
    if (!answer.trim() || submitted || !isMyTurn) return;
    socket.emit("player:submit_answer", { answer: answer.trim() });
    setSubmitted(true);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSubmit();
  };

  const totalPlayers = room.playerAnswerOrder?.length ?? 0;
  const doneCount    = Object.keys(revealedAnswers).length;
  const progressPct  = totalPlayers > 0 ? (doneCount / totalPlayers) * 100 : 0;

  const timerColor = secsLeft <= 5 ? "var(--red)" : secsLeft <= 15 ? "var(--yellow)" : "var(--green)";

  return (
    <div className="container">
      <div className="card wide">

        {/* Header */}
        <div className="row-between mb" style={{ alignItems: "flex-start" }}>
          <div>
            <div className="label" style={{ marginBottom: "0.2rem" }}>
              {privateData?.category ?? room.players.find((p) => p.id === myId)?.category ?? ""}
            </div>
            <h2 style={{ marginBottom: 0 }}>
              {privateData?.role === "impostor"
                ? <span style={{ color: "var(--red)" }}>You are the Impostor</span>
                : privateData?.word
                  ? <span>{privateData.word}</span>
                  : "Waiting..."}
            </h2>
          </div>
          {room.timerEndsAt && (
            <div style={{
              fontFamily: "'Krona One', sans-serif",
              fontSize: "1.6rem",
              fontWeight: 900,
              color: timerColor,
              minWidth: "2.5rem",
              textAlign: "right",
              transition: "color 0.3s",
            }}>
              {secsLeft}
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div style={{
          height: 4, borderRadius: 999, background: "var(--surface3)",
          marginBottom: "1rem", overflow: "hidden",
        }}>
          <div style={{
            height: "100%", borderRadius: 999,
            background: "var(--yellow)",
            width: `${progressPct}%`,
            transition: "width 0.4s ease",
          }} />
        </div>

        <hr className="divider" />

        {/* Active turn indicator */}
        <div style={{
          padding: "0.75rem 1rem",
          borderRadius: "var(--radius-sm)",
          background: isMyTurn ? "linear-gradient(90deg,rgba(212,168,71,0.15),rgba(212,168,71,0.06))" : "var(--surface2)",
          border: `1px solid ${isMyTurn ? "rgba(212,168,71,0.35)" : "var(--border)"}`,
          marginBottom: "1rem",
          textAlign: "center",
        }}>
          {isMyTurn ? (
            <span style={{
              fontFamily: "'Krona One', sans-serif",
              fontWeight: 800, fontSize: "0.9rem",
              color: "var(--yellow)",
              letterSpacing: "0.05em",
            }}>
              Your turn — type your answer!
            </span>
          ) : (
            <span style={{ color: "var(--muted)", fontSize: "0.88rem" }}>
              Waiting for <strong style={{ color: "var(--text)" }}>{currentPlayer?.name ?? "..."}</strong> to answer...
            </span>
          )}
        </div>

        {/* Input (only shown on my turn) */}
        {isMyTurn && (
          <div style={{ marginBottom: "1rem" }}>
            <textarea
              ref={inputRef}
              placeholder="Type your answer..."
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={submitted}
              maxLength={200}
              style={{ marginBottom: "0.6rem" }}
            />
            <button
              className="btn-primary"
              onClick={handleSubmit}
              disabled={!answer.trim() || submitted}
            >
              {submitted ? "Submitted!" : "Submit"}
            </button>
          </div>
        )}

        {/* Revealed answers so far */}
        {doneCount > 0 && (
          <>
            <hr className="divider" />
            <div className="label" style={{ marginBottom: "0.5rem" }}>
              Answers so far ({doneCount}/{totalPlayers})
            </div>
            <div className="stack-sm">
              {room.playerAnswerOrder
                .filter((id) => id in revealedAnswers)
                .map((id) => {
                  const p = room.players.find((pl) => pl.id === id);
                  const ans = revealedAnswers[id];
                  return (
                    <div className="player-item" key={id}>
                      <span className="name">{p?.name ?? "Unknown"}</span>
                      <span style={{
                        fontSize: "0.88rem",
                        color: ans ? "var(--text)" : "var(--muted)",
                        fontStyle: ans ? "normal" : "italic",
                      }}>
                        {ans || "no answer"}
                      </span>
                    </div>
                  );
                })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
