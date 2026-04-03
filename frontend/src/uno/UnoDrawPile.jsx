import React from "react";

export default function UnoDrawPile({ count, onDraw, isMyTurn }) {
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

      <div
        onClick={isMyTurn ? onDraw : undefined}
        style={{
          width: 64, height: 96,
          borderRadius: 10,
          background: "linear-gradient(135deg, #1F2937, #111827)",
          border: isMyTurn
            ? "2px solid rgba(238,230,193,0.55)"
            : "2px solid rgba(255,255,255,0.1)",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          cursor: isMyTurn ? "pointer" : "default",
          boxShadow: isMyTurn
            ? "0 0 18px rgba(238,230,193,0.18)"
            : "0 2px 8px rgba(0,0,0,0.45)",
          transform: isMyTurn ? "translateY(-8px)" : "none",
          transition: "transform 0.12s, box-shadow 0.15s, border-color 0.15s",
          userSelect: "none",
          gap: "4px",
        }}
      >
        <span style={{
          color: "rgba(255,255,255,0.85)",
          fontSize: "0.8rem",
          fontWeight: 900,
          fontFamily: "'Krona One', sans-serif",
          letterSpacing: "0.04em",
        }}>
          UNO
        </span>
        <span style={{
          color: "rgba(255,255,255,0.4)",
          fontSize: "0.65rem",
          fontWeight: 700,
          fontFamily: "'Exo', sans-serif",
        }}>
          {count}
        </span>
      </div>

      {isMyTurn && (
        <div style={{
          fontSize: "0.58rem", color: "var(--muted)",
          textAlign: "center", letterSpacing: "0.07em",
          textTransform: "uppercase",
        }}>
          Tap to draw
        </div>
      )}
    </div>
  );
}
