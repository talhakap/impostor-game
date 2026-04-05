import React, { useState, useEffect, useRef } from "react";
import { socket } from "../socket";

export default function UnoChatPanel({ myId, players, onClose }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft]       = useState("");
  const bottomRef               = useRef(null);
  const inputRef                = useRef(null);

  useEffect(() => {
    const handler = (msg) => {
      setMessages((prev) => [...prev.slice(-199), msg]);
    };
    socket.on("uno:chat", handler);
    return () => socket.off("uno:chat", handler);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const send = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    socket.emit("uno:chat", { message: trimmed });
    setDraft("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div style={{
      position: "absolute",
      bottom: 0, right: 0,
      width: "min(320px, 100vw)",
      height: "min(420px, 70dvh)",
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius) var(--radius) 0 0",
      display: "flex", flexDirection: "column",
      zIndex: 100,
      boxShadow: "var(--shadow-lg)",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0.6rem 0.9rem",
        borderBottom: "1px solid var(--border)",
        flexShrink: 0,
      }}>
        <span style={{
          fontFamily: "'Krona One', sans-serif",
          fontSize: "0.75rem", fontWeight: 400,
          color: "var(--muted)", letterSpacing: "0.08em",
        }}>
          CHAT
        </span>
        <button onClick={onClose} style={{
          background: "none", border: "none",
          color: "var(--muted)", cursor: "pointer",
          fontSize: "1rem", lineHeight: 1, padding: "0.1rem 0.3rem",
        }}>✕</button>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: "auto", padding: "0.6rem 0.75rem",
        display: "flex", flexDirection: "column", gap: "0.45rem",
        scrollbarWidth: "thin", scrollbarColor: "var(--border) transparent",
      }}>
        {messages.length === 0 && (
          <p style={{ color: "var(--muted)", fontSize: "0.8rem", textAlign: "center", marginTop: "1rem" }}>
            No messages yet
          </p>
        )}
        {messages.map((m, i) => {
          const isMe = m.playerId === myId;
          return (
            <div key={i} style={{
              display: "flex", flexDirection: "column",
              alignItems: isMe ? "flex-end" : "flex-start",
            }}>
              {!isMe && (
                <span style={{ fontSize: "0.68rem", color: "var(--muted)", marginBottom: "0.15rem" }}>
                  {m.playerName}
                </span>
              )}
              <div style={{
                maxWidth: "80%",
                padding: "0.4rem 0.65rem",
                borderRadius: isMe ? "12px 12px 3px 12px" : "12px 12px 12px 3px",
                background: isMe ? "rgba(212,168,71,0.18)" : "var(--surface2)",
                border: `1px solid ${isMe ? "rgba(212,168,71,0.3)" : "var(--border)"}`,
                fontSize: "0.85rem",
                color: isMe ? "var(--yellow)" : "var(--text)",
                wordBreak: "break-word",
                lineHeight: 1.4,
              }}>
                {m.message}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        display: "flex", gap: "0.4rem",
        padding: "0.55rem 0.75rem",
        borderTop: "1px solid var(--border)",
        flexShrink: 0,
      }}>
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Say something..."
          maxLength={120}
          style={{
            flex: 1,
            background: "var(--surface2)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            color: "var(--text)",
            fontFamily: "'Exo', sans-serif",
            fontSize: "0.85rem",
            padding: "0.4rem 0.65rem",
            outline: "none",
          }}
        />
        <button
          onClick={send}
          disabled={!draft.trim()}
          style={{
            padding: "0.4rem 0.75rem",
            background: draft.trim() ? "var(--yellow)" : "var(--surface3)",
            color: draft.trim() ? "#1a1600" : "var(--muted)",
            border: "none", borderRadius: "var(--radius-sm)",
            fontFamily: "'Exo', sans-serif",
            fontWeight: 700, fontSize: "0.8rem",
            cursor: draft.trim() ? "pointer" : "default",
            transition: "background 0.15s, color 0.15s",
            flexShrink: 0,
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
