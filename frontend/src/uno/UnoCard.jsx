import React from "react";

// ─── Color maps ───────────────────────────────────────────────────────────────

const CARD_BG = {
  red:    "#DC2626",
  green:  "#16A34A",
  blue:   "#2563EB",
  yellow: "#CA8A04",
  wild:   "#1F2937",
};

const CARD_TEXT = {
  red:    "#fff",
  green:  "#fff",
  blue:   "#fff",
  yellow: "#000",
  wild:   "#fff",
};

// Wild / Wild+4 use a rainbow gradient instead of a flat colour
const WILD_GRADIENT =
  "linear-gradient(135deg, #DC2626 0%, #CA8A04 33%, #16A34A 66%, #2563EB 100%)";

// ─── Label helpers ────────────────────────────────────────────────────────────

function getMainLabel(card) {
  if (card.type === "number")         return String(card.value);
  if (card.type === "skip")           return "⊘";
  if (card.type === "reverse")        return "↺";
  if (card.type === "draw_two")       return "+2";
  if (card.type === "wild")           return "W";
  if (card.type === "wild_draw_four") return "W+4";
  return "?";
}

function getSubLabel(card) {
  if (card.type === "skip")           return "SKIP";
  if (card.type === "reverse")        return "REV";
  if (card.type === "draw_two")       return "DRAW";
  if (card.type === "wild")           return "WILD";
  if (card.type === "wild_draw_four") return "WILD";
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * UnoCard
 *
 * Props:
 *   card      — card object { id, color, type, value }
 *   onClick   — click handler (undefined = non-interactive)
 *   playable  — true → lift card; false → dim card; undefined → neutral
 *   selected  — white glow border
 *   small     — render at 48×72 instead of 64×96
 *   faceDown  — render as a back-of-card (draw pile)
 */
export default function UnoCard({ card, onClick, playable, selected, small, faceDown }) {
  const w = small ? 48 : 64;
  const h = small ? 72 : 96;

  if (faceDown) {
    return (
      <div
        style={{
          width: w, height: h, borderRadius: 10,
          background: "linear-gradient(135deg, #1F2937, #111827)",
          border: "2px solid rgba(255,255,255,0.12)",
          boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, userSelect: "none",
        }}
      >
        <span style={{
          color: "rgba(255,255,255,0.7)",
          fontSize: small ? "0.65rem" : "0.8rem",
          fontWeight: 900,
          fontFamily: "'Krona One', sans-serif",
          letterSpacing: "0.04em",
        }}>
          UNO
        </span>
      </div>
    );
  }

  const isWild   = card.color === "wild";
  const bg       = isWild ? WILD_GRADIENT : CARD_BG[card.color] ?? "#333";
  const textColor = isWild ? "#fff" : (CARD_TEXT[card.color] ?? "#fff");
  const sub      = getSubLabel(card);
  const main     = getMainLabel(card);

  const isLiftable  = playable === true && !!onClick;
  const isDimmed    = playable === false;
  const isWd4Label  = card.type === "wild_draw_four";

  return (
    <div
      onClick={onClick}
      style={{
        width: w, height: h,
        borderRadius: 10,
        background: bg,
        color: textColor,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        cursor: onClick ? "pointer" : "default",
        border: selected
          ? "3px solid #fff"
          : `2px solid rgba(255,255,255,${isLiftable ? "0.55" : "0.18"})`,
        boxShadow: selected
          ? "0 0 18px rgba(255,255,255,0.55)"
          : isLiftable
            ? "0 6px 14px rgba(0,0,0,0.5)"
            : "0 2px 6px rgba(0,0,0,0.4)",
        transform: isLiftable ? "translateY(-8px)" : "none",
        opacity: isDimmed ? 0.4 : 1,
        transition: "transform 0.12s, opacity 0.15s, box-shadow 0.15s, border-color 0.15s",
        userSelect: "none",
        flexShrink: 0,
        position: "relative",
        gap: "2px",
      }}
    >
      {sub && (
        <div style={{
          fontSize: small ? "0.42rem" : "0.55rem",
          fontWeight: 800,
          letterSpacing: "0.08em",
          fontFamily: "'Exo', sans-serif",
          opacity: 0.8,
          lineHeight: 1,
        }}>
          {sub}
        </div>
      )}
      <div style={{
        fontSize: small
          ? "1rem"
          : isWd4Label ? "0.9rem" : "1.5rem",
        fontWeight: 900,
        fontFamily: "'Krona One', sans-serif",
        lineHeight: 1,
      }}>
        {main}
      </div>
    </div>
  );
}
