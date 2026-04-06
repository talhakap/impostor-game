import React, { useState, useEffect, useRef } from "react";
import { socket } from "../socket";

export default function UnoLobby({ room, myId, error, onLeave, chatMessages }) {
  const [copied, setCopied] = useState(false);
  const [draft,  setDraft]  = useState("");
  const bottomRef           = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const sendChat = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    socket.emit("uno:chat", { message: trimmed });
    setDraft("");
  };

  const handleChatKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); }
  };

  const isHost    = room.hostId === myId;
  const players   = room.players ?? [];
  const connected = players.filter((p) => p.isConnected);

  const copyCode = () => {
    navigator.clipboard?.writeText(room.code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sortedScores = Object.entries(room.scores ?? {})
    .map(([id, score]) => ({
      id,
      name: players.find((p) => p.id === id)?.name ?? "Unknown",
      score,
    }))
    .sort((a, b) => b.score - a.score);

  const hasAnyWins       = sortedScores.some((e) => e.score > 0);
  const lastWinner       = players.find((p) => p.id === room.lastRoundWinnerId);
  const lastWinnerIsMe   = room.lastRoundWinnerId === myId;

  return (
    <div className="container">
      <div className="card wide">

        {/* Header */}
        <div className="row-between mb">
          <h2 style={{ marginBottom: 0 }}>UNO</h2>
          <button className="btn-ghost" style={{ width: "auto" }} onClick={onLeave}>
            Leave
          </button>
        </div>

        {/* Last round result banner */}
        {room.lastRoundWinnerId && (
          <div style={{
            padding: "0.6rem 1rem",
            borderRadius: "var(--radius-sm)",
            background: lastWinnerIsMe ? "var(--yellow-glow)" : "var(--surface2)",
            border: `1px solid ${lastWinnerIsMe ? "rgba(212,168,71,0.4)" : "var(--border)"}`,
            marginBottom: "0.85rem",
            textAlign: "center",
            fontSize: "0.88rem",
            fontWeight: 600,
            color: lastWinnerIsMe ? "var(--yellow)" : "var(--text)",
          }}>
            {lastWinnerIsMe
              ? "You won the last round!"
              : `${lastWinner?.name ?? "Someone"} won the last round`}
          </div>
        )}

        {/* Room code */}
        <div className="mb">
          <div className="label">Room Code — tap to copy</div>
          <div className="room-code" onClick={copyCode}>
            {room.code}
            {copied && (
              <span style={{ fontSize: "0.8rem", color: "var(--green)", marginLeft: "0.75rem" }}>
                Copied!
              </span>
            )}
          </div>
        </div>

        <hr className="divider" />

        {/* Players + wins combined */}
        <div className="mb">
          <div className="label">Players ({connected.length} / 20)</div>
          <div className="stack-sm">
            {players.map((p) => {
              const wins = room.scores?.[p.id] ?? 0;
              return (
                <div className="player-item" key={p.id}>
                  <span className="name">{p.name}</span>
                  <span className="row" style={{ gap: "0.4rem" }}>
                    {hasAnyWins && (
                      <span style={{
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        color: wins > 0 ? "var(--yellow)" : "var(--muted)",
                      }}>
                        {wins} {wins === 1 ? "win" : "wins"}
                      </span>
                    )}
                    {p.id === room.hostId && <span className="badge badge-host">Host</span>}
                    {p.id === myId        && <span className="badge badge-you">You</span>}
                    {!p.isConnected && (
                      <span className="badge" style={{
                        background: "var(--surface3)",
                        color: "var(--red)",
                        border: "1px solid rgba(224,96,96,0.3)",
                      }}>
                        Offline
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {error && <p className="error-text mt-sm">{error}</p>}

        {isHost ? (
          <button
            className="btn-primary"
            onClick={() => socket.emit("uno:start_game")}
            disabled={connected.length < 2}
            style={{ marginTop: "0.5rem" }}
          >
            {connected.length < 2 ? "Waiting for players..." : "Start Game"}
          </button>
        ) : (
          <p className="muted center-text mt">Waiting for the host to start...</p>
        )}

        <hr className="divider" style={{ marginTop: "1rem" }} />

        {/* Chat */}
        <div>
          <div className="label" style={{ marginBottom: "0.5rem" }}>Chat</div>
          <div style={{
            height: "160px", overflowY: "auto",
            display: "flex", flexDirection: "column", gap: "0.4rem",
            marginBottom: "0.6rem",
            scrollbarWidth: "thin", scrollbarColor: "var(--border) transparent",
          }}>
            {chatMessages.length === 0 && (
              <p style={{ color: "var(--muted)", fontSize: "0.8rem" }}>No messages yet</p>
            )}
            {chatMessages.map((m, i) => {
              const isMe = m.playerId === myId;
              return (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
                  {!isMe && <span style={{ fontSize: "0.68rem", color: "var(--muted)", marginBottom: "0.1rem" }}>{m.playerName}</span>}
                  <div style={{
                    maxWidth: "80%", padding: "0.35rem 0.6rem",
                    borderRadius: isMe ? "10px 10px 3px 10px" : "10px 10px 10px 3px",
                    background: isMe ? "rgba(212,168,71,0.18)" : "var(--surface2)",
                    border: `1px solid ${isMe ? "rgba(212,168,71,0.3)" : "var(--border)"}`,
                    fontSize: "0.85rem", color: isMe ? "var(--yellow)" : "var(--text)",
                    wordBreak: "break-word", lineHeight: 1.4,
                  }}>
                    {m.message}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
          <div style={{ display: "flex", gap: "0.4rem" }}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleChatKey}
              placeholder="Say something..."
              maxLength={120}
              style={{
                flex: 1, background: "var(--surface2)",
                border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
                color: "var(--text)", fontFamily: "'Exo', sans-serif",
                fontSize: "0.85rem", padding: "0.4rem 0.65rem", outline: "none",
              }}
            />
            <button
              onClick={sendChat}
              disabled={!draft.trim()}
              style={{
                padding: "0.4rem 0.75rem",
                background: draft.trim() ? "var(--yellow)" : "var(--surface3)",
                color: draft.trim() ? "#1a1600" : "var(--muted)",
                border: "none", borderRadius: "var(--radius-sm)",
                fontFamily: "'Exo', sans-serif", fontWeight: 700, fontSize: "0.8rem",
                cursor: draft.trim() ? "pointer" : "default",
                transition: "background 0.15s, color 0.15s", flexShrink: 0,
              }}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
