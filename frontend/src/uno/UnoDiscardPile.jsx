import React from "react";
import UnoCard from "./UnoCard";

const COLOR_HEX = {
  red:    "#DC2626",
  green:  "#16A34A",
  blue:   "#2563EB",
  yellow: "#CA8A04",
};

export default function UnoDiscardPile({ topCard, currentColor }) {
  // After a wild is played the active colour is tracked separately
  const showColorDot = topCard?.color === "wild" && currentColor && COLOR_HEX[currentColor];

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
        Discard
      </div>

      {topCard ? (
        <UnoCard card={topCard} />
      ) : (
        <div style={{
          width: 64, height: 96, borderRadius: 10,
          border: "2px dashed var(--border)",
          background: "var(--surface2)",
        }} />
      )}

      {/* Coloured dot shows the active colour after a wild is played */}
      {showColorDot && (
        <div style={{
          width: 16, height: 16,
          borderRadius: "50%",
          background: COLOR_HEX[currentColor],
          border: "2px solid rgba(255,255,255,0.3)",
          boxShadow: `0 0 8px ${COLOR_HEX[currentColor]}`,
        }} title={`Active colour: ${currentColor}`} />
      )}
    </div>
  );
}
