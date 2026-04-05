import React, { useState, useEffect, useCallback } from "react";
import { socket } from "../socket";
import UnoHand         from "./UnoHand";
import UnoColorPicker  from "./UnoColorPicker";
import UnoPlayerSeats  from "./UnoPlayerSeats";
import UnoDiscardPile  from "./UnoDiscardPile";
import UnoDrawPile     from "./UnoDrawPile";
import UnoChatPanel    from "./UnoChatPanel";

export default function UnoGame({ room, myId, error, clearError }) {
  const [pendingWild, setPendingWild] = useState(null);
  const [localError,  setLocalError]  = useState(null);
  const [chatOpen,    setChatOpen]    = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [bubbles,     setBubbles]     = useState({}); // playerId → message
  const bubbleTimers = React.useRef({});

  const isMyTurn      = room.currentTurnPlayerId === myId;
  const myPlayer      = room.players.find((p) => p.id === myId);
  const currentPlayer = room.players.find((p) => p.id === room.currentTurnPlayerId);
  const hand          = room.hand ?? [];

  const drawnCardId      = room.drawnCardId     ?? null;
  const chainValue       = room.chainValue      ?? null;
  const chainType        = room.chainType       ?? null;
  const chainCount       = room.chainCount      ?? 0;
  const pendingDrawCount = room.pendingDrawCount ?? 0;
  const pendingDrawType  = room.pendingDrawType  ?? null;

  const canPass = isMyTurn && (drawnCardId !== null || chainValue !== null || chainType !== null);

  // ── Auto-draw when facing a draw stack with no stackable card ───────────────
  // If it's my turn and there's a pending draw stack, check whether I hold any
  // card that can continue the stack. If not, auto-draw after a short delay so
  // players can see the stack badge before it resolves.
  useEffect(() => {
    if (!isMyTurn || pendingDrawCount === 0 || pendingDrawType === null) return;
    const canStack = hand.some((c) => c.type === pendingDrawType);
    if (!canStack) {
      const t = setTimeout(() => socket.emit("uno:draw_card"), 800);
      return () => clearTimeout(t);
    }
  // hand intentionally included so we re-check when cards change
  }, [isMyTurn, pendingDrawCount, pendingDrawType, hand]); // eslint-disable-line

  // ── Chat bubbles + unread counter ──────────────────────────────────────────

  useEffect(() => {
    const handler = (msg) => {
      if (!chatOpen) setUnreadCount((n) => n + 1);

      // Show bubble beside player chip for 5 seconds
      setBubbles((prev) => ({ ...prev, [msg.playerId]: msg.message }));
      if (bubbleTimers.current[msg.playerId]) clearTimeout(bubbleTimers.current[msg.playerId]);
      bubbleTimers.current[msg.playerId] = setTimeout(() => {
        setBubbles((prev) => {
          const next = { ...prev };
          delete next[msg.playerId];
          return next;
        });
        delete bubbleTimers.current[msg.playerId];
      }, 5000);
    };
    socket.on("uno:chat", handler);
    return () => socket.off("uno:chat", handler);
  }, [chatOpen]);

  // ── Auto-clear errors ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => clearError(), 3000);
    return () => clearTimeout(t);
  }, [error, clearError]);

  useEffect(() => {
    if (!localError) return;
    const t = setTimeout(() => setLocalError(null), 3000);
    return () => clearTimeout(t);
  }, [localError]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handlePlayCard = useCallback((card) => {
    if (!isMyTurn) { setLocalError("It's not your turn"); return; }
    if (card.type === "wild" || card.type === "wild_draw_four") {
      setPendingWild(card);
    } else {
      socket.emit("uno:play_card", { cardId: card.id });
    }
  }, [isMyTurn]);

  const handleColorSelect = useCallback((color) => {
    if (!pendingWild) return;
    socket.emit("uno:play_card", { cardId: pendingWild.id, chosenColor: color });
    setPendingWild(null);
  }, [pendingWild]);

  const handleDraw = useCallback(() => {
    if (!isMyTurn) return;
    socket.emit("uno:draw_card");
  }, [isMyTurn]);

  const handlePass        = () => socket.emit("uno:pass_turn");
  const handleSayUno      = () => socket.emit("uno:say_uno");
  const handleChallengeUno = (targetId) => socket.emit("uno:challenge_uno", { targetId });

  // ── Derived ─────────────────────────────────────────────────────────────────

  const displayError   = localError || error;
  const directionArrow = room.direction === 1 ? "▶" : "◀";
  const stackLabel = pendingDrawType === "draw_two" ? "+2" : "+4";
  const chainTypeLabel = chainType === "skip" ? "Skip" : chainType === "reverse" ? "Reverse" : "";

  let turnLabel;
  if (isMyTurn && pendingDrawCount > 0) {
    turnLabel = `Stack a ${stackLabel} or tap the draw pile to draw ${pendingDrawCount}`;
  } else if (isMyTurn && chainType !== null) {
    turnLabel = `Stack another ${chainTypeLabel} (×${chainCount}) or pass`;
  } else if (isMyTurn && chainValue !== null) {
    turnLabel = `Chain ${chainValue}s or pass`;
  } else if (isMyTurn && drawnCardId) {
    turnLabel = "Play the drawn card or pass";
  } else if (isMyTurn) {
    turnLabel = "Your turn!";
  } else if (pendingDrawCount > 0) {
    turnLabel = `${currentPlayer?.name ?? "..."} must draw ${pendingDrawCount} or stack`;
  } else if (chainType !== null) {
    turnLabel = `${currentPlayer?.name ?? "..."} is stacking ${chainTypeLabel}s (×${chainCount})`;
  } else {
    turnLabel = `${currentPlayer?.name ?? "..."}'s turn`;
  }

  const challengeable = room.players.filter(
    (p) => p.id !== myId && p.cardCount === 1 && !p.saidUno
  );
  const canSayUno = hand.length === 1 && !myPlayer?.saidUno;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{
      height: "100dvh",
      display: "flex", flexDirection: "column",
      background: "var(--bg)",
      overflow: "hidden",
      position: "relative",
    }}>

      {/* ── Header ── */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "0.45rem 1rem",
        borderBottom: "1px solid var(--border)",
        background: "var(--surface)",
        flexShrink: 0,
        zIndex: 10,
      }}>
        <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--muted)", letterSpacing: "0.1em", fontFamily: "'Exo', sans-serif" }}>
          {room.code}
        </span>
        <span style={{ fontSize: "0.85rem", fontWeight: 400, color: "var(--text)", fontFamily: "'Krona One', sans-serif" }}>
          UNO
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <span style={{ fontSize: "0.7rem", color: "var(--muted)", fontFamily: "'Exo', sans-serif" }}>
            R{room.roundNumber} {directionArrow}
          </span>
          <button
            onClick={() => { setChatOpen((o) => !o); setUnreadCount(0); }}
            style={{
              position: "relative",
              background: chatOpen ? "rgba(212,168,71,0.15)" : "transparent",
              border: `1px solid ${chatOpen ? "rgba(212,168,71,0.35)" : "var(--border)"}`,
              borderRadius: "var(--radius-sm)",
              color: chatOpen ? "var(--yellow)" : "var(--muted)",
              cursor: "pointer", padding: "0.2rem 0.5rem",
              fontSize: "0.8rem", lineHeight: 1,
              transition: "all 0.15s",
            }}
          >
            💬
            {unreadCount > 0 && (
              <span style={{
                position: "absolute", top: -5, right: -5,
                background: "var(--red)", color: "#fff",
                borderRadius: 999, fontSize: "0.6rem",
                fontWeight: 700, minWidth: 14, height: 14,
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: "0 3px",
              }}>
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Table area: seats + draw/discard ── */}
      <div style={{
        flex: 1,
        position: "relative",
        minHeight: 0,
        overflow: "hidden",
      }}>
        {/* Player name seats around the arc */}
        <UnoPlayerSeats
          players={room.players}
          myId={myId}
          currentTurnPlayerId={room.currentTurnPlayerId}
          isHost={room.hostId === myId}
          onKick={(playerId) => socket.emit("host:kick_player", { playerId })}
          bubbles={bubbles}
        />

        {/* Draw + discard piles in the centre */}
        <div style={{
          position: "absolute",
          top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          display: "flex", alignItems: "center",
          gap: "2rem",
          zIndex: 1,
        }}>
          <UnoDrawPile
            count={room.drawPileCount}
            onDraw={handleDraw}
            isMyTurn={isMyTurn && !drawnCardId && chainValue === null}
            pendingDrawCount={pendingDrawCount}
          />

          <UnoDiscardPile topCard={room.topCard} currentColor={room.currentColor} />
        </div>

        {/* Draw stack badge — floats above the piles */}
        {pendingDrawCount > 0 && (
          <div style={{
            position: "absolute",
            top: "38%", left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(224,96,96,0.95)",
            border: "2px solid rgba(224,96,96,0.6)",
            borderRadius: 999,
            padding: "0.2rem 0.8rem",
            fontFamily: "'Krona One', sans-serif",
            fontWeight: 900,
            fontSize: "1rem",
            color: "#fff",
            letterSpacing: "0.04em",
            boxShadow: "0 0 18px rgba(224,96,96,0.55)",
            pointerEvents: "none",
            whiteSpace: "nowrap",
            zIndex: 3,
          }}>
            Draw Stack: +{pendingDrawCount}
          </div>
        )}

        {/* Error toast */}
        {displayError && (
          <div style={{
            position: "absolute", top: 12, left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(224,96,96,0.95)", color: "#fff",
            padding: "0.45rem 1.1rem", borderRadius: "var(--radius-sm)",
            fontSize: "0.85rem", fontWeight: 600,
            zIndex: 50, pointerEvents: "none",
            whiteSpace: "nowrap", boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          }}>
            {displayError}
          </div>
        )}
      </div>

      {/* ── YOUR TURN banner ── */}
      {isMyTurn && (
        <div style={{
          flexShrink: 0,
          padding: "0.45rem 1rem",
          background: "linear-gradient(90deg, rgba(212,168,71,0.18) 0%, rgba(212,168,71,0.08) 100%)",
          borderTop: "2px solid var(--yellow)",
          borderBottom: "1px solid rgba(212,168,71,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: "0.55rem",
          zIndex: 10,
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
            background: "var(--yellow)",
            boxShadow: "0 0 8px var(--yellow), 0 0 16px rgba(212,168,71,0.5)",
            display: "inline-block",
          }} />
          <span style={{
            fontSize: "0.88rem", fontWeight: 800,
            color: "var(--yellow)",
            fontFamily: "'Krona One', sans-serif",
            letterSpacing: "0.06em",
            textShadow: "0 0 16px rgba(212,168,71,0.5)",
          }}>
            {pendingDrawCount > 0
              ? `DRAW ${pendingDrawCount} OR STACK`
              : chainType !== null
                ? `${chainTypeLabel.toUpperCase()} ×${chainCount}`
                : chainValue !== null
                  ? `CHAIN ${chainValue}s`
                  : drawnCardId
                    ? "PLAY OR PASS"
                    : "YOUR TURN"}
          </span>
          <span style={{
            width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
            background: "var(--yellow)",
            boxShadow: "0 0 8px var(--yellow), 0 0 16px rgba(212,168,71,0.5)",
            display: "inline-block",
          }} />
        </div>
      )}

      {/* ── Turn label (others' turns) + action buttons ── */}
      <div style={{
        flexShrink: 0, padding: "0.3rem 0.75rem",
        display: "flex", alignItems: "center", justifyContent: "center",
        gap: "0.5rem", flexWrap: "wrap",
        zIndex: 10,
      }}>
        {!isMyTurn && (
          <span style={{
            fontSize: "0.82rem", fontWeight: 600,
            color: pendingDrawCount > 0 ? "var(--red)" : "var(--muted)",
            fontFamily: "'Exo', sans-serif", letterSpacing: "0.02em",
          }}>
            {turnLabel}
          </span>
        )}

        {canPass && (
          <button onClick={handlePass} className="btn-ghost" style={{
            padding: "0.3rem 0.9rem", fontSize: "0.75rem",
            borderRadius: 999, width: "auto",
          }}>
            Pass
          </button>
        )}

        {canSayUno && (
          <button onClick={handleSayUno} className="uno-call-btn">UNO!</button>
        )}

        {challengeable.map((p) => (
          <button key={p.id} onClick={() => handleChallengeUno(p.id)} className="uno-challenge-btn">
            Catch {p.name}!
          </button>
        ))}
      </div>

      {/* ── Hand ── */}
      <div style={{ flexShrink: 0, borderTop: "1px solid var(--border)", background: "var(--surface)", zIndex: 10 }}>
        <UnoHand
          hand={hand}
          isMyTurn={isMyTurn}
          topCard={room.topCard}
          currentColor={room.currentColor}
          pendingDrawCount={pendingDrawCount}
          pendingDrawType={pendingDrawType}
          drawnCardId={drawnCardId}
          chainValue={chainValue}
          chainType={chainType}
          onPlayCard={handlePlayCard}
        />
      </div>

      {/* ── Wild colour picker overlay ── */}
      {pendingWild && (
        <UnoColorPicker
          onSelect={handleColorSelect}
          onCancel={() => setPendingWild(null)}
        />
      )}

      {/* ── Chat panel ── */}
      {chatOpen && (
        <UnoChatPanel
          myId={myId}
          players={room.players}
          onClose={() => setChatOpen(false)}
        />
      )}
    </div>
  );
}
