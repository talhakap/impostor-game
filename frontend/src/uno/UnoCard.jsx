import React from "react";

// ─── Card colour palette ──────────────────────────────────────────────────────

const BG = {
  red:    "#CC1F1F",
  green:  "#1A8C3E",
  blue:   "#1A5FB4",
  yellow: "#D4A017",
  wild:   "#111318",
};

// Slightly lighter shade used for the inner oval text (matches card bg)
const BG_DARK = {
  red:    "#AA1515",
  green:  "#146830",
  blue:   "#144A96",
  yellow: "#A87A0A",
  wild:   "#111318",
};

// Thin edge highlight on the card border
const EDGE = {
  red:    "rgba(255,100,100,0.55)",
  green:  "rgba(80,220,110,0.45)",
  blue:   "rgba(80,140,255,0.5)",
  yellow: "rgba(255,220,50,0.55)",
  wild:   "rgba(160,140,255,0.35)",
};

// ─── Label helpers ────────────────────────────────────────────────────────────

function getCornerLabel(card) {
  if (card.type === "number")         return String(card.value);
  if (card.type === "skip")           return "⊘";
  if (card.type === "reverse")        return "↺";
  if (card.type === "draw_two")       return "+2";
  if (card.type === "wild")           return "W";
  if (card.type === "wild_draw_four") return "+4";
  return "?";
}

function getCenterLabel(card) {
  if (card.type === "number")         return String(card.value);
  if (card.type === "skip")           return "⊘";
  if (card.type === "reverse")        return "↺";
  if (card.type === "draw_two")       return "+2";
  if (card.type === "wild")           return "WILD";
  if (card.type === "wild_draw_four") return "+4";
  return "?";
}

// ─── Wild oval (quartered in the four UNO colours) ────────────────────────────

function WildOval({ isWd4, scale }) {
  const label = isWd4 ? "+4" : "WILD";
  return (
    <div style={{
      position: "absolute",
      width: "78%", height: "56%",
      top: "50%", left: "50%",
      transform: "translate(-50%, -50%) rotate(-20deg)",
      borderRadius: "50%",
      overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: "50%", height: "50%", background: "#CC1F1F" }} />
      <div style={{ position: "absolute", top: 0, right: 0, width: "50%", height: "50%", background: "#1A5FB4" }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, width: "50%", height: "50%", background: "#D4A017" }} />
      <div style={{ position: "absolute", bottom: 0, right: 0, width: "50%", height: "50%", background: "#1A8C3E" }} />
      {/* Centre label */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{
          fontFamily: "'Krona One', sans-serif",
          fontSize: `${scale * (isWd4 ? 14 : 10)}px`,
          fontWeight: 900,
          color: "#fff",
          textShadow: "0 1px 4px rgba(0,0,0,0.9)",
          transform: "rotate(20deg)",
          letterSpacing: "0.01em",
        }}>
          {label}
        </span>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * UnoCard
 *
 * Props:
 *   card      — { id, color, type, value }
 *   onClick   — click handler (omit for non-interactive)
 *   playable  — true → lift; false → dim; undefined → neutral
 *   selected  — bright white border glow
 *   small     — 48×72 instead of 64×96
 *   faceDown  — show card back (draw pile)
 */
export default function UnoCard({ card, onClick, playable, selected, small, faceDown }) {
  const W = small ? 48 : 64;
  const H = small ? 72 : 96;
  const S = small ? 0.75 : 1; // scale factor for font sizes

  const isLiftable = playable === true && !!onClick;
  const isDimmed   = playable === false;

  // ── Face-down (draw pile / card back) ──────────────────────────────────────
  if (faceDown) {
    return (
      <div style={{
        width: W, height: H, borderRadius: 10,
        background: "#111318",
        border: "2px solid rgba(180,160,255,0.25)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.6)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: "5px",
        flexShrink: 0, userSelect: "none",
        position: "relative", overflow: "hidden",
      }}>
        {/* Diagonal colour stripe — real UNO back motif */}
        <div style={{
          position: "absolute",
          width: "140%", height: "40%",
          background: "linear-gradient(90deg, #CC1F1F, #D4A017, #1A8C3E, #1A5FB4)",
          opacity: 0.18,
          transform: "rotate(-25deg)",
          pointerEvents: "none",
        }} />
        {/* Logo */}
        <img
          src="/logo.png"
          alt=""
          draggable={false}
          style={{
            width: `${S * 34}px`,
            opacity: 0.9,
            filter: "brightness(0) invert(1)",
            pointerEvents: "none",
          }}
        />
      </div>
    );
  }

  // ── Face-up card ───────────────────────────────────────────────────────────
  const isWild       = card.color === "wild";
  const bg           = BG[card.color]      ?? "#1a1a1a";
  const bgDark       = BG_DARK[card.color] ?? "#0d0d0d";
  const edgeColor    = EDGE[card.color]    ?? "rgba(255,255,255,0.2)";
  const cornerLabel  = getCornerLabel(card);
  const centerLabel  = getCenterLabel(card);

  const centerFontSize = (() => {
    if (card.type === "number")         return S * 24;
    if (card.type === "skip")           return S * 22;
    if (card.type === "reverse")        return S * 22;
    if (card.type === "draw_two")       return S * 18;
    return S * 10; // wild handled separately
  })();

  return (
    <div
      onClick={onClick}
      style={{
        width: W, height: H,
        borderRadius: 10,
        background: bg,
        border: selected
          ? "2.5px solid #fff"
          : `1.5px solid ${isLiftable ? edgeColor : "rgba(255,255,255,0.15)"}`,
        boxShadow: selected
          ? `0 0 20px rgba(255,255,255,0.5), 0 4px 12px rgba(0,0,0,0.5)`
          : isLiftable
            ? `0 8px 18px rgba(0,0,0,0.55), 0 0 0 1px ${edgeColor}`
            : "0 2px 6px rgba(0,0,0,0.45)",
        transform: isLiftable ? "translateY(-10px)" : "none",
        opacity: isDimmed ? 0.38 : 1,
        transition: "transform 0.12s, opacity 0.15s, box-shadow 0.15s",
        cursor: onClick ? "pointer" : "default",
        userSelect: "none",
        flexShrink: 0,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* ── Top-left corner ───────────────────────────────────────────────── */}
      <div style={{
        position: "absolute",
        top: S * 4, left: S * 5,
        display: "flex", flexDirection: "column", alignItems: "center",
        lineHeight: 1,
        zIndex: 2,
      }}>
        <span style={{
          fontFamily: "'Krona One', sans-serif",
          fontSize: `${S * 9}px`,
          fontWeight: 900,
          color: "#fff",
          textShadow: "0 1px 3px rgba(0,0,0,0.5)",
        }}>
          {cornerLabel}
        </span>
      </div>

      {/* ── Centre oval (or wild oval) ────────────────────────────────────── */}
      {isWild ? (
        <WildOval isWd4={card.type === "wild_draw_four"} scale={S} />
      ) : (
        <div style={{
          position: "absolute",
          width: "78%", height: "57%",
          top: "50%", left: "50%",
          transform: "translate(-50%, -50%) rotate(-20deg)",
          borderRadius: "50%",
          background: "rgba(255,255,255,0.93)",
          boxShadow: "0 0 0 1.5px rgba(0,0,0,0.12) inset",
          display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden",
        }}>
          {/* Number / symbol */}
          <span style={{
            fontFamily: "'Krona One', sans-serif",
            fontSize: `${centerFontSize}px`,
            fontWeight: 900,
            color: bgDark,
            transform: "rotate(20deg)",
            lineHeight: 1,
          }}>
            {centerLabel}
          </span>
          {/* Logo watermark inside oval */}
          <img
            src="/logo.png"
            alt=""
            draggable={false}
            style={{
              position: "absolute",
              width: `${S * 18}px`,
              bottom: `${S * 5}px`,
              right: `${S * 7}px`,
              opacity: 0.18,
              filter: `brightness(0) saturate(0)`,
              transform: "rotate(20deg)",
              pointerEvents: "none",
            }}
          />
        </div>
      )}

      {/* ── Bottom-right corner (rotated 180°) ───────────────────────────── */}
      <div style={{
        position: "absolute",
        bottom: S * 4, right: S * 5,
        transform: "rotate(180deg)",
        display: "flex", flexDirection: "column", alignItems: "center",
        lineHeight: 1,
        zIndex: 2,
      }}>
        <span style={{
          fontFamily: "'Krona One', sans-serif",
          fontSize: `${S * 9}px`,
          fontWeight: 900,
          color: "#fff",
          textShadow: "0 1px 3px rgba(0,0,0,0.5)",
        }}>
          {cornerLabel}
        </span>
      </div>
    </div>
  );
}
