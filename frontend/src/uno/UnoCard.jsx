import React from "react";

const BG = {
  red:    "#CC1F1F",
  green:  "#1A8C3E",
  blue:   "#1A5FB4",
  yellow: "#D4A017",
  wild:   "#111318",
};

const BG_DARK = {
  red:    "#AA1515",
  green:  "#146830",
  blue:   "#144A96",
  yellow: "#A87A0A",
  wild:   "#111318",
};

const EDGE = {
  red:    "rgba(255,100,100,0.55)",
  green:  "rgba(80,220,110,0.45)",
  blue:   "rgba(80,140,255,0.5)",
  yellow: "rgba(255,220,50,0.55)",
  wild:   "rgba(160,140,255,0.35)",
};

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
  if (card.type === "number")   return String(card.value);
  if (card.type === "skip")     return "⊘";
  if (card.type === "reverse")  return "↺";
  if (card.type === "draw_two") return "+2";
  return null; // wild handled separately
}

function WildOval({ isWd4, S }) {
  return (
    <div style={{
      position: "absolute",
      width: "78%", height: "56%",
      top: "50%", left: "50%",
      transform: "translate(-50%, -50%) rotate(-20deg)",
      borderRadius: "50%",
      overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: 0,    left: 0,   width: "50%", height: "50%", background: "#CC1F1F" }} />
      <div style={{ position: "absolute", top: 0,    right: 0,  width: "50%", height: "50%", background: "#1A5FB4" }} />
      <div style={{ position: "absolute", bottom: 0, left: 0,   width: "50%", height: "50%", background: "#D4A017" }} />
      <div style={{ position: "absolute", bottom: 0, right: 0,  width: "50%", height: "50%", background: "#1A8C3E" }} />
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{
          fontFamily: "'Krona One', sans-serif",
          fontSize: `${S * (isWd4 ? 13 : 10)}px`,
          fontWeight: 900, color: "#fff",
          textShadow: "0 1px 4px rgba(0,0,0,0.9)",
          transform: "rotate(20deg)",
        }}>
          {isWd4 ? "+4" : "WILD"}
        </span>
      </div>
    </div>
  );
}

export default function UnoCard({ card, onClick, playable, selected, small, faceDown }) {
  const W = small ? 48 : 64;
  const H = small ? 72 : 96;
  const S = small ? 0.75 : 1;

  const isLiftable = playable === true && !!onClick;
  const isDimmed   = playable === false;

  // ── Face-down / card back ──────────────────────────────────────────────────
  if (faceDown) {
    return (
      <div style={{
        width: W, height: H, borderRadius: 10,
        background: "#111318",
        border: "1.5px solid rgba(180,160,255,0.2)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, userSelect: "none",
        position: "relative", overflow: "hidden",
      }}>
        {/* Diagonal rainbow stripe */}
        <div style={{
          position: "absolute",
          width: "160%", height: "38%",
          background: "linear-gradient(90deg, #CC1F1F, #D4A017, #1A8C3E, #1A5FB4)",
          opacity: 0.15,
          transform: "rotate(-25deg)",
          pointerEvents: "none",
        }} />
        {/* Cream transparent logo — shows cleanly on dark background */}
        <img
          src="/logo-cream.png"
          alt=""
          draggable={false}
          style={{
            width: `${S * 34}px`,
            position: "relative",
            zIndex: 1,
            pointerEvents: "none",
          }}
        />
      </div>
    );
  }

  // ── Face-up card ───────────────────────────────────────────────────────────
  const isWild      = card.color === "wild";
  const bg          = BG[card.color]      ?? "#1a1a1a";
  const bgDark      = BG_DARK[card.color] ?? "#0d0d0d";
  const edgeColor   = EDGE[card.color]    ?? "rgba(255,255,255,0.2)";
  const cornerLabel = getCornerLabel(card);
  const centerLabel = getCenterLabel(card);

  const centerFontSize = (() => {
    if (card.type === "number")   return S * 26;
    if (card.type === "skip")     return S * 22;
    if (card.type === "reverse")  return S * 22;
    if (card.type === "draw_two") return S * 18;
    return S * 12;
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
          ? "0 0 20px rgba(255,255,255,0.5), 0 4px 12px rgba(0,0,0,0.5)"
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
      {/* Top-left corner */}
      <div style={{
        position: "absolute", top: S * 4, left: S * 5,
        lineHeight: 1, zIndex: 2,
      }}>
        <span style={{
          fontFamily: "'Krona One', sans-serif",
          fontSize: `${S * 9}px`, fontWeight: 900,
          color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.5)",
        }}>
          {cornerLabel}
        </span>
      </div>

      {/* Centre oval or wild oval */}
      {isWild ? (
        <WildOval isWd4={card.type === "wild_draw_four"} S={S} />
      ) : (
        <div style={{
          position: "absolute",
          width: "78%", height: "57%",
          top: "50%", left: "50%",
          transform: "translate(-50%, -50%) rotate(-20deg)",
          borderRadius: "50%",
          background: "rgba(255,255,255,0.93)",
          display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden",
        }}>
          {/* Number / action symbol */}
          <span style={{
            fontFamily: "'Krona One', sans-serif",
            fontSize: `${centerFontSize}px`,
            fontWeight: 900, color: bgDark,
            transform: "rotate(20deg)",
            lineHeight: 1, position: "relative", zIndex: 1,
          }}>
            {centerLabel}
          </span>
          {/* Black transparent logo watermark on white oval */}
          <img
            src="/logo-black.png"
            alt=""
            draggable={false}
            style={{
              position: "absolute",
              width: `${S * 16}px`,
              bottom: `${S * 6}px`,
              right: `${S * 8}px`,
              opacity: 0.1,
              transform: "rotate(20deg)",
              pointerEvents: "none",
              zIndex: 0,
            }}
          />
        </div>
      )}

      {/* Cream transparent logo — bottom centre over solid card colour */}
      <img
        src="/logo-cream.png"
        alt=""
        draggable={false}
        style={{
          position: "absolute",
          bottom: S * 4,
          left: "50%",
          transform: "translateX(-50%)",
          width: `${S * 18}px`,
          opacity: 0.28,
          pointerEvents: "none",
          zIndex: 3,
        }}
      />

      {/* Bottom-right corner (rotated 180°) */}
      <div style={{
        position: "absolute", bottom: S * 4, right: S * 5,
        transform: "rotate(180deg)",
        lineHeight: 1, zIndex: 2,
      }}>
        <span style={{
          fontFamily: "'Krona One', sans-serif",
          fontSize: `${S * 9}px`, fontWeight: 900,
          color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.5)",
        }}>
          {cornerLabel}
        </span>
      </div>
    </div>
  );
}
