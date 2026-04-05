import React from "react";
import UnoCard from "./UnoCard";

// Dummy card object — only used to render the face-down back
const BACK_CARD = { id: "__back__", color: "wild", type: "wild", value: null };

export default function UnoDrawPile({ count, onDraw, isMyTurn, pendingDrawCount }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", gap: "0.5rem",
    }}>
      <div style={{
        fontSize: "0.6rem", fontWeight: 700,
        letterSpacing: "0.1em", color: "var(--muted)",
        textTransform: "uppercase",
      }}>
        Draw Pile
      </div>

      {/* Wrapper adds the lift / glow when it's your turn */}
      <div
        onClick={isMyTurn ? onDraw : undefined}
        style={{
          cursor: isMyTurn ? "pointer" : "default",
          transform: isMyTurn ? "translateY(-10px)" : "none",
          transition: "transform 0.12s",
          position: "relative",
        }}
      >
        <UnoCard card={BACK_CARD} faceDown />
        {/* Card count badge */}
        <div style={{
          position: "absolute",
          bottom: -8, left: "50%",
          transform: "translateX(-50%)",
          background: "var(--surface3)",
          border: "1px solid var(--border)",
          borderRadius: 999,
          fontSize: "0.6rem",
          fontWeight: 700,
          fontFamily: "'Exo', sans-serif",
          color: "var(--muted)",
          padding: "1px 7px",
          whiteSpace: "nowrap",
        }}>
          {count}
        </div>
      </div>

      {isMyTurn && (
        <div style={{
          marginTop: "0.6rem",
          fontSize: "0.58rem",
          color: pendingDrawCount > 0 ? "var(--red)" : "var(--muted)",
          textAlign: "center", letterSpacing: "0.07em",
          textTransform: "uppercase",
          fontWeight: pendingDrawCount > 0 ? 700 : 400,
        }}>
          {pendingDrawCount > 0 ? `Tap to draw ${pendingDrawCount}` : "Tap to draw"}
        </div>
      )}
    </div>
  );
}
