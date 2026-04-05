import React from "react";

// Position N players along the top arc of an ellipse.
// Index 0 = leftmost, last = rightmost.
function getArcPositions(count) {
  if (count === 0) return [];

  // Narrower arc for fewer players, wider for more
  const spread = count === 1 ? 0 : count <= 3 ? 90 : count <= 5 ? 120 : 150;
  const cx = 50, cy = 52;
  const rx = 42, ry = 36;
  const toRad = (d) => (d * Math.PI) / 180;

  return Array.from({ length: count }, (_, i) => {
    const t   = count === 1 ? 0 : i / (count - 1);
    // Arc runs from (270 - spread/2)° to (270 + spread/2)°
    // 270° is the top of the ellipse
    const deg = (270 - spread / 2) + t * spread;
    const rad = toRad(deg);
    return {
      x: cx + rx * Math.cos(rad),
      y: cy + ry * Math.sin(rad),
    };
  });
}

export default function UnoPlayerSeats({
  players,
  myId,
  currentTurnPlayerId,
  isHost,
  onKick,
}) {
  const me = players.find((p) => p.id === myId);

  // Rotate `others` so it starts from the player right after me in turn order.
  // `players` arrives from the server already sorted in turnOrder.
  const myIndex = players.findIndex((p) => p.id === myId);
  const others = myIndex === -1
    ? players.filter((p) => p.id !== myId)
    : [
        ...players.slice(myIndex + 1),
        ...players.slice(0, myIndex),
      ];

  const positions = getArcPositions(others.length);

  return (
    <>
      {/* ── Other players along the arc ── */}
      {others.map((p, i) => {
        const pos           = positions[i];
        const isCurrentTurn = p.id === currentTurnPlayerId;
        const isOffline     = !p.isConnected;

        return (
          <div
            key={p.id}
            style={{
              position:  "absolute",
              left:      `${pos.x}%`,
              top:       `${pos.y}%`,
              transform: "translate(-50%, -50%)",
              display:       "flex",
              flexDirection: "column",
              alignItems:    "center",
              gap:           "3px",
              zIndex: 3,
              opacity: isOffline ? 0.45 : 1,
            }}
          >
            {/* Name + card count chip */}
            <div style={{
              display:    "flex",
              alignItems: "center",
              gap:        "0.28rem",
              padding:    "0.26rem 0.5rem",
              borderRadius: 999,
              background: isCurrentTurn
                ? "rgba(212,168,71,0.22)"
                : "rgba(20,21,24,0.9)",
              border: isCurrentTurn
                ? "2px solid var(--yellow)"
                : "1.5px solid var(--border)",
              boxShadow: isCurrentTurn
                ? "0 0 14px rgba(212,168,71,0.45)"
                : "0 2px 10px rgba(0,0,0,0.6)",
              position:            "relative",
              backdropFilter:      "blur(8px)",
              WebkitBackdropFilter:"blur(8px)",
              transition: "border-color 0.2s, background 0.2s, box-shadow 0.2s",
            }}>

              {/* Current-turn dot above chip */}
              {isCurrentTurn && (
                <div style={{
                  position:  "absolute",
                  top: -5, left: "50%",
                  transform: "translateX(-50%)",
                  width: 7, height: 7,
                  borderRadius: "50%",
                  background: "var(--yellow)",
                  boxShadow: "0 0 8px var(--yellow), 0 0 16px rgba(212,168,71,0.5)",
                }} />
              )}

              <span style={{
                fontSize:      "0.72rem",
                fontWeight:    isCurrentTurn ? 800 : 600,
                color:         isCurrentTurn ? "var(--yellow)" : "var(--text)",
                maxWidth:      72,
                overflow:      "hidden",
                textOverflow:  "ellipsis",
                whiteSpace:    "nowrap",
              }}>
                {p.name}
              </span>

              <span style={{
                fontSize:   "0.82rem",
                fontWeight: 800,
                color:      isCurrentTurn ? "var(--yellow)" : "var(--muted-bright)",
                lineHeight: 1,
              }}>
                {p.cardCount}
              </span>

              {/* Host kick button */}
              {isHost && (
                <button
                  onClick={(e) => { e.stopPropagation(); onKick(p.id); }}
                  style={{
                    width: 14, height: 14,
                    borderRadius:   "50%",
                    background:     "rgba(224,96,96,0.15)",
                    border:         "1px solid rgba(224,96,96,0.35)",
                    color:          "var(--red)",
                    fontSize:       "0.45rem",
                    cursor:         "pointer",
                    display:        "flex",
                    alignItems:     "center",
                    justifyContent: "center",
                    padding: 0, flexShrink: 0,
                  }}
                  title={`Kick ${p.name}`}
                >
                  ✕
                </button>
              )}
            </div>

            {/* UNO! badge */}
            {p.saidUno && (
              <span style={{
                fontSize: "0.46rem", fontWeight: 800,
                color:      "#DC2626",
                background: "rgba(220,38,38,0.15)",
                border:     "1px solid rgba(220,38,38,0.4)",
                padding:    "1px 5px", borderRadius: 4,
                letterSpacing: "0.06em", textTransform: "uppercase",
              }}>
                UNO!
              </span>
            )}
          </div>
        );
      })}

      {/* ── "You" chip — bottom centre of table area ── */}
      {me && (
        <div style={{
          position:  "absolute",
          bottom:    "6%",
          left:      "50%",
          transform: "translateX(-50%)",
          display:       "flex",
          flexDirection: "column",
          alignItems:    "center",
          gap:           "3px",
          zIndex: 3,
        }}>
          <div style={{
            display:    "flex",
            alignItems: "center",
            gap:        "0.28rem",
            padding:    "0.22rem 0.48rem",
            borderRadius: 999,
            background: currentTurnPlayerId === myId
              ? "rgba(212,168,71,0.2)"
              : "rgba(20,21,24,0.82)",
            border: currentTurnPlayerId === myId
              ? "2px solid var(--yellow)"
              : "1px solid var(--border-bright)",
            backdropFilter:      "blur(8px)",
            WebkitBackdropFilter:"blur(8px)",
          }}>
            <span style={{
              fontSize:   "0.65rem",
              fontWeight: 700,
              color: currentTurnPlayerId === myId ? "var(--yellow)" : "var(--muted-bright)",
            }}>
              You
            </span>
            <span style={{
              fontSize:   "0.8rem",
              fontWeight: 800,
              color: currentTurnPlayerId === myId ? "var(--yellow)" : "var(--text)",
              lineHeight: 1,
            }}>
              {me.cardCount}
            </span>
          </div>

          {me.saidUno && (
            <span style={{
              fontSize: "0.46rem", fontWeight: 800,
              color:      "#DC2626",
              background: "rgba(220,38,38,0.15)",
              border:     "1px solid rgba(220,38,38,0.4)",
              padding:    "1px 5px", borderRadius: 4,
              letterSpacing: "0.06em", textTransform: "uppercase",
            }}>
              UNO!
            </span>
          )}
        </div>
      )}
    </>
  );
}
