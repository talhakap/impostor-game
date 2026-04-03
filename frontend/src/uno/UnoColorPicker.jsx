import React from "react";

const COLORS = [
  { key: "red",    label: "Red",    bg: "#DC2626", text: "#fff" },
  { key: "green",  label: "Green",  bg: "#16A34A", text: "#fff" },
  { key: "blue",   label: "Blue",   bg: "#2563EB", text: "#fff" },
  { key: "yellow", label: "Yellow", bg: "#CA8A04", text: "#000" },
];

export default function UnoColorPicker({ onSelect, onCancel }) {
  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.85)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      zIndex: 200,
      gap: "1.25rem",
      padding: "2rem 1.5rem",
    }}>
      <h2 style={{
        fontFamily: "'Krona One', sans-serif",
        fontSize: "1.1rem",
        color: "var(--text)",
        textAlign: "center",
        letterSpacing: "0.02em",
      }}>
        Choose a Color
      </h2>

      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "0.75rem",
        width: "100%",
        maxWidth: "280px",
      }}>
        {COLORS.map((c) => (
          <button
            key={c.key}
            onClick={() => onSelect(c.key)}
            style={{
              padding: "1.5rem 1rem",
              borderRadius: 12,
              background: c.bg,
              color: c.text,
              border: "3px solid rgba(255,255,255,0.25)",
              fontSize: "0.95rem",
              fontWeight: 700,
              fontFamily: "'Exo', sans-serif",
              cursor: "pointer",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              transition: "transform 0.1s, box-shadow 0.15s",
              width: "100%",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.04)";
              e.currentTarget.style.boxShadow = `0 4px 20px ${c.bg}88`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "none";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      <button
        onClick={onCancel}
        style={{
          background: "transparent",
          color: "var(--muted)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)",
          padding: "0.55rem 1.5rem",
          cursor: "pointer",
          fontFamily: "'Exo', sans-serif",
          fontSize: "0.8rem",
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        Cancel
      </button>
    </div>
  );
}
