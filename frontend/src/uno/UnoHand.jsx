import React from "react";
import UnoCard from "./UnoCard";

// Mirrors the server-side isValidPlay for UI hints only.
// The server always re-validates; this is purely cosmetic (lift / dim cards).
function isCardPlayable(card, topCard, currentColor, pendingDrawCount) {
  if (pendingDrawCount > 0) return false;
  if (card.color === "wild") return true;
  if (card.color === currentColor) return true;
  if (topCard && topCard.type !== "number" && card.type === topCard.type) return true;
  if (card.type === "number" && topCard?.type === "number" && card.value === topCard.value) return true;
  return false;
}

export default function UnoHand({
  hand,
  isMyTurn,
  topCard,
  currentColor,
  pendingDrawCount,
  onPlayCard,
}) {
  if (!hand || hand.length === 0) {
    return (
      <div style={{
        padding: "1rem", textAlign: "center",
        color: "var(--muted)", fontSize: "0.9rem",
      }}>
        No cards in hand
      </div>
    );
  }

  return (
    <div style={{
      overflowX: "auto",
      display: "flex",
      gap: "6px",
      padding: "0.75rem 1rem 1rem",
      scrollbarWidth: "thin",
      scrollbarColor: "var(--border) transparent",
      WebkitOverflowScrolling: "touch",
      alignItems: "flex-end",
    }}>
      {hand.map((card) => {
        const playable = isMyTurn
          ? isCardPlayable(card, topCard, currentColor, pendingDrawCount)
          : false;

        return (
          <UnoCard
            key={card.id}
            card={card}
            playable={isMyTurn ? playable : undefined}
            onClick={isMyTurn ? () => onPlayCard(card) : undefined}
          />
        );
      })}
    </div>
  );
}
