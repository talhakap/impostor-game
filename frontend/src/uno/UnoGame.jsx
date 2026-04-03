import React, { useState, useEffect, useCallback } from "react";
import { socket } from "../socket";
import UnoHand         from "./UnoHand";
import UnoColorPicker  from "./UnoColorPicker";
import UnoPlayerList   from "./UnoPlayerList";
import UnoDiscardPile  from "./UnoDiscardPile";
import UnoDrawPile     from "./UnoDrawPile";

export default function UnoGame({ room, myId, error, clearError }) {
  // Card waiting for a colour selection before it can be played
  const [pendingWild, setPendingWild] = useState(null);
  // Local transient error (e.g. "not your turn" from clicking too fast)
  const [localError, setLocalError]   = useState(null);

  const isMyTurn       = room.currentTurnPlayerId === myId;
  const myPlayer       = room.players.find((p) => p.id === myId);
  const currentPlayer  = room.players.find((p) => p.id === room.currentTurnPlayerId);
  const hand           = room.hand ?? [];

  // ── Auto-clear errors ─────────────────────────────────────────────────────

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

  // ── Actions ───────────────────────────────────────────────────────────────

  const handlePlayCard = useCallback((card) => {
    if (!isMyTurn) {
      setLocalError("It's not your turn");
      return;
    }
    if (card.type === "wild" || card.type === "wild_draw_four") {
      // Show colour picker before emitting
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

  const handleSayUno = () => socket.emit("uno:say_uno");

  const handleChallengeUno = (targetId) =>
    socket.emit("uno:challenge_uno", { targetId });

  // ── Derived values ────────────────────────────────────────────────────────

  const displayError    = localError || error;
  const directionArrow  = room.direction === 1 ? "▶" : "◀";
  const turnLabel       = isMyTurn
    ? "Your turn!"
    : `${currentPlayer?.name ?? "..."}'s turn`;

  // Players with 1 card who haven't said UNO — challengeable by others
  const challengeable = room.players.filter(
    (p) => p.id !== myId && p.cardCount === 1 && !p.saidUno
  );

  const canSayUno = hand.length === 1 && !myPlayer?.saidUno;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{
      height: "100dvh",
      display: "flex",
      flexDirection: "column",
      background: "var(--bg)",
      overflow: "hidden",
      position: "relative",
    }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "0.45rem 1rem",
        borderBottom: "1px solid var(--border)",
        background: "var(--surface)",
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: "0.7rem", fontWeight: 700,
          color: "var(--muted)", letterSpacing: "0.1em",
          fontFamily: "'Exo', sans-serif",
        }}>
          {room.code}
        </span>
        <span style={{
          fontSize: "0.85rem", fontWeight: 400,
          color: "var(--text)",
          fontFamily: "'Krona One', sans-serif",
        }}>
          UNO
        </span>
        <span style={{
          fontSize: "0.7rem", color: "var(--muted)",
          fontFamily: "'Exo', sans-serif",
        }}>
          R{room.roundNumber} {directionArrow}
        </span>
      </div>

      {/* ── Player list ────────────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0,
        borderBottom: "1px solid var(--border)",
        background: "var(--surface)",
      }}>
        <UnoPlayerList
          players={room.players}
          myId={myId}
          currentTurnPlayerId={room.currentTurnPlayerId}
        />
      </div>

      {/* ── Game centre: draw pile + discard pile ──────────────────────────── */}
      <div style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "2rem",
        padding: "1rem",
        minHeight: 0,
      }}>
        <UnoDrawPile
          count={room.drawPileCount}
          onDraw={handleDraw}
          isMyTurn={isMyTurn}
        />
        <UnoDiscardPile
          topCard={room.topCard}
          currentColor={room.currentColor}
        />
      </div>

      {/* ── Turn indicator + UNO / challenge buttons ───────────────────────── */}
      <div style={{
        flexShrink: 0,
        padding: "0.35rem 0.75rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.5rem",
        flexWrap: "wrap",
      }}>
        <span style={{
          fontSize: "0.875rem",
          fontWeight: 700,
          color: isMyTurn ? "var(--yellow)" : "var(--muted)",
          fontFamily: "'Exo', sans-serif",
          letterSpacing: "0.03em",
        }}>
          {turnLabel}
        </span>

        {/* "Say UNO!" button appears when you have exactly 1 card */}
        {canSayUno && (
          <button
            onClick={handleSayUno}
            className="uno-call-btn"
          >
            UNO!
          </button>
        )}

        {/* Challenge buttons for opponents who forgot to say UNO */}
        {challengeable.map((p) => (
          <button
            key={p.id}
            onClick={() => handleChallengeUno(p.id)}
            className="uno-challenge-btn"
          >
            Catch {p.name}!
          </button>
        ))}
      </div>

      {/* ── Error toast ────────────────────────────────────────────────────── */}
      {displayError && (
        <div style={{
          position: "absolute",
          top: 60,
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(224,96,96,0.95)",
          color: "#fff",
          padding: "0.45rem 1.1rem",
          borderRadius: "var(--radius-sm)",
          fontSize: "0.85rem",
          fontWeight: 600,
          zIndex: 50,
          pointerEvents: "none",
          whiteSpace: "nowrap",
          boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
        }}>
          {displayError}
        </div>
      )}

      {/* ── Player hand ────────────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0,
        borderTop: "1px solid var(--border)",
        background: "var(--surface)",
      }}>
        <UnoHand
          hand={hand}
          isMyTurn={isMyTurn}
          topCard={room.topCard}
          currentColor={room.currentColor}
          pendingDrawCount={room.pendingDrawCount}
          onPlayCard={handlePlayCard}
        />
      </div>

      {/* ── Wild colour picker modal ────────────────────────────────────────── */}
      {pendingWild && (
        <UnoColorPicker
          onSelect={handleColorSelect}
          onCancel={() => setPendingWild(null)}
        />
      )}
    </div>
  );
}
