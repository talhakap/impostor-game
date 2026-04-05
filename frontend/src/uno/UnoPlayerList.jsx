import React from "react";

export default function UnoPlayerList({ players, myId, currentTurnPlayerId, direction, isHost, onKick }) {
  // players array arrives already sorted in turn order from the server (buildUnoView)
  // Filter to only connected/active players for the turn-order display
  const activePlayers = players.filter((p) => p.isConnected);
  // Offline players shown at the end in a dimmed row
  const offlinePlayers = players.filter((p) => !p.isConnected);

  const arrow = direction === -1 ? "◀" : "▶";

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: "0.2rem",
      padding: "0.4rem 0.6rem",
    }}>
      {/* Turn-order row */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "0",
        overflowX: "auto",
        scrollbarWidth: "none",
        WebkitOverflowScrolling: "touch",
        justifyContent: activePlayers.length <= 5 ? "center" : "flex-start",
      }}>
        {activePlayers.map((p, i) => {
          const isCurrentTurn = p.id === currentTurnPlayerId;
          const isMe          = p.id === myId;

          return (
            <React.Fragment key={p.id}>
              {/* Player chip */}
              <div style={{
                display: "flex", flexDirection: "column",
                alignItems: "center", gap: "2px",
                padding: "0.3rem 0.55rem",
                borderRadius: "var(--radius-sm)",
                background: isCurrentTurn && isMe
                  ? "rgba(212,168,71,0.22)"
                  : isCurrentTurn
                    ? "rgba(238,230,193,0.1)"
                    : isMe
                      ? "rgba(238,230,193,0.06)"
                      : "var(--surface2)",
                border: isCurrentTurn && isMe
                  ? "2px solid var(--yellow)"
                  : isCurrentTurn
                    ? "1.5px solid rgba(212,168,71,0.55)"
                    : isMe
                      ? "1px solid rgba(238,230,193,0.25)"
                      : "1px solid var(--border)",
                boxShadow: isCurrentTurn && isMe
                  ? "0 0 12px rgba(212,168,71,0.35), inset 0 0 8px rgba(212,168,71,0.08)"
                  : isCurrentTurn
                    ? "0 0 8px rgba(212,168,71,0.2)"
                    : "none",
                minWidth: 48,
                flexShrink: 0,
                transition: "border-color 0.2s, background 0.2s, box-shadow 0.2s",
                position: "relative",
              }}>
                {/* Current turn indicator — pulsing dot */}
                {isCurrentTurn && (
                  <div style={{
                    position: "absolute",
                    top: -5, left: "50%",
                    transform: "translateX(-50%)",
                    width: isMe ? 8 : 6,
                    height: isMe ? 8 : 6,
                    borderRadius: "50%",
                    background: "var(--yellow)",
                    boxShadow: isMe
                      ? "0 0 10px var(--yellow), 0 0 20px rgba(212,168,71,0.5)"
                      : "0 0 6px var(--yellow)",
                  }} />
                )}

                <span style={{
                  fontSize: "0.68rem",
                  fontWeight: isCurrentTurn || isMe ? 800 : 700,
                  color: isCurrentTurn
                    ? isMe ? "var(--yellow)" : "var(--text)"
                    : isMe ? "var(--muted-bright)" : "var(--muted)",
                  maxWidth: 64,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {isMe ? "You" : p.name}
                </span>

                <span style={{
                  fontSize: "0.95rem",
                  fontWeight: 800,
                  color: isCurrentTurn
                    ? isMe ? "var(--yellow)" : "rgba(212,168,71,0.85)"
                    : "var(--text)",
                  lineHeight: 1,
                  textShadow: isCurrentTurn && isMe ? "0 0 10px rgba(212,168,71,0.5)" : "none",
                }}>
                  {p.cardCount}
                </span>

                {p.saidUno && (
                  <span style={{
                    fontSize: "0.48rem", fontWeight: 800,
                    color: "#DC2626",
                    background: "rgba(220,38,38,0.15)",
                    border: "1px solid rgba(220,38,38,0.4)",
                    padding: "1px 4px", borderRadius: 4,
                    letterSpacing: "0.06em", textTransform: "uppercase",
                  }}>
                    UNO!
                  </span>
                )}

                {/* Host kick button — shown on every chip except the host's own */}
                {isHost && !isMe && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onKick(p.id); }}
                    style={{
                      position: "absolute",
                      top: 2, right: 2,
                      width: 14, height: 14,
                      borderRadius: "50%",
                      background: "rgba(224,96,96,0.15)",
                      border: "1px solid rgba(224,96,96,0.35)",
                      color: "var(--red)",
                      fontSize: "0.5rem",
                      lineHeight: 1,
                      cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      padding: 0,
                    }}
                    title={`Kick ${p.name}`}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Direction arrow between chips (not after the last one) */}
              {i < activePlayers.length - 1 && (
                <span style={{
                  fontSize: "0.55rem",
                  color: "var(--border-bright)",
                  padding: "0 3px",
                  flexShrink: 0,
                  lineHeight: 1,
                  alignSelf: "center",
                }}>
                  {arrow}
                </span>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Offline players — small strip below */}
      {offlinePlayers.length > 0 && (
        <div style={{
          display: "flex", gap: "0.35rem", flexWrap: "wrap",
          paddingTop: "0.2rem",
        }}>
          {offlinePlayers.map((p) => (
            <div key={p.id} style={{
              display: "flex", alignItems: "center", gap: "0.3rem",
              padding: "0.15rem 0.45rem",
              borderRadius: "var(--radius-sm)",
              background: "var(--surface2)",
              border: "1px solid rgba(224,96,96,0.2)",
              opacity: 0.55,
            }}>
              <span style={{ fontSize: "0.62rem", color: "var(--muted)" }}>
                {p.id === myId ? "You" : p.name}
              </span>
              <span style={{
                fontSize: "0.48rem", color: "var(--red)",
                letterSpacing: "0.06em", textTransform: "uppercase",
              }}>
                offline
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
