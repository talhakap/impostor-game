import React from "react";

export default function UnoPlayerList({ players, myId, currentTurnPlayerId }) {
  return (
    <div style={{
      display: "flex",
      gap: "0.4rem",
      padding: "0.5rem 0.75rem",
      overflowX: "auto",
      justifyContent: "center",
      flexWrap: "wrap",
      scrollbarWidth: "none",
    }}>
      {players.map((p) => {
        const isCurrentTurn = p.id === currentTurnPlayerId;
        const isMe          = p.id === myId;

        return (
          <div key={p.id} style={{
            display: "flex", flexDirection: "column",
            alignItems: "center", gap: "3px",
            padding: "0.35rem 0.6rem",
            borderRadius: "var(--radius-sm)",
            background: isCurrentTurn ? "rgba(238,230,193,0.1)" : "var(--surface2)",
            border: isCurrentTurn
              ? "1px solid rgba(238,230,193,0.45)"
              : "1px solid var(--border)",
            minWidth: 56,
            transition: "border-color 0.2s, background 0.2s",
            flexShrink: 0,
          }}>
            {/* Name */}
            <span style={{
              fontSize: "0.72rem",
              fontWeight: 700,
              color: isCurrentTurn ? "var(--text)" : "var(--muted)",
              maxWidth: 72,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {isMe ? "You" : p.name}
            </span>

            {/* Card count */}
            <span style={{
              fontSize: "1rem",
              fontWeight: 800,
              color: isCurrentTurn ? "var(--yellow)" : "var(--text)",
              lineHeight: 1,
            }}>
              {p.cardCount}
            </span>

            {/* UNO badge */}
            {p.saidUno && (
              <span style={{
                fontSize: "0.52rem", fontWeight: 800,
                color: "#DC2626",
                background: "rgba(220,38,38,0.15)",
                border: "1px solid rgba(220,38,38,0.4)",
                padding: "1px 4px",
                borderRadius: 4,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}>
                UNO!
              </span>
            )}

            {/* Offline indicator */}
            {!p.isConnected && (
              <span style={{
                fontSize: "0.5rem", color: "var(--red)",
                letterSpacing: "0.06em", textTransform: "uppercase",
              }}>
                offline
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
