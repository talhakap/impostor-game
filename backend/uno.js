"use strict";
// backend/uno.js — Server-authoritative UNO game engine.
// Pure functions only: no I/O, no socket references. All side-effects live in index.js.

const COLORS = ["red", "green", "blue", "yellow"];

// ─── Deck factory ─────────────────────────────────────────────────────────────

function createUnoDeck() {
  const cards = [];
  let n = 0;

  for (const color of COLORS) {
    // One zero per color
    cards.push({ id: `${color}_0_${n++}`, color, type: "number", value: 0 });
    // Two of each 1–9
    for (let v = 1; v <= 9; v++) {
      cards.push({ id: `${color}_${v}_a_${n++}`, color, type: "number", value: v });
      cards.push({ id: `${color}_${v}_b_${n++}`, color, type: "number", value: v });
    }
    // Two of each action card
    for (let i = 0; i < 2; i++) {
      cards.push({ id: `${color}_skip_${n++}`,    color, type: "skip",     value: null });
      cards.push({ id: `${color}_rev_${n++}`,     color, type: "reverse",  value: null });
      cards.push({ id: `${color}_d2_${n++}`,      color, type: "draw_two", value: null });
    }
  }

  // Four wilds, four wild-draw-fours
  for (let i = 0; i < 4; i++) {
    cards.push({ id: `wild_${n++}`,  color: "wild", type: "wild",           value: null });
    cards.push({ id: `wd4_${n++}`,   color: "wild", type: "wild_draw_four", value: null });
  }

  return cards; // exactly 108 cards
}

function shuffleDeck(deck) {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ─── Turn helpers ─────────────────────────────────────────────────────────────

function getNextTurnIndex(room, steps) {
  const len = room.turnOrder.length;
  return ((room.currentTurnIndex + room.direction * steps) % len + len) % len;
}

function advanceTurn(room, steps) {
  room.currentTurnIndex = getNextTurnIndex(room, steps);
}

function getCurrentPlayerId(room) {
  return room.turnOrder[room.currentTurnIndex];
}

// ─── Draw helpers ─────────────────────────────────────────────────────────────

function reshuffleDiscard(room) {
  if (room.discardPile.length <= 1) return;
  const top = room.discardPile[room.discardPile.length - 1];
  room.drawPile = shuffleDeck(room.discardPile.slice(0, -1));
  room.discardPile = [top];
}

function drawCards(room, playerId, count) {
  for (let i = 0; i < count; i++) {
    if (room.drawPile.length === 0) reshuffleDiscard(room);
    if (room.drawPile.length === 0) break; // deck exhausted even after reshuffle
    room.hands[playerId].push(room.drawPile.pop());
  }
}

// ─── Dealing ──────────────────────────────────────────────────────────────────

function dealCards(room) {
  let deck = shuffleDeck(createUnoDeck());

  room.hands = {};
  for (const pid of room.turnOrder) {
    room.hands[pid] = deck.splice(0, 7);
  }

  // First discard card must be a plain number card to keep the start clean
  let startIdx = deck.findIndex((c) => c.type === "number");
  if (startIdx === -1) startIdx = 0;
  const [startCard] = deck.splice(startIdx, 1);

  room.discardPile      = [startCard];
  room.drawPile         = deck;
  room.currentColor     = startCard.color;
  room.direction        = 1;
  room.currentTurnIndex = 0;
  room.pendingDrawCount = 0;
  room.pendingDrawType  = null;
  room.chainType        = null;
  room.chainCount       = 0;
  room.saidUno          = {};
  room.roundWinnerId    = null;
  room.drawnCardId      = null; // id of card drawn this turn (null = no draw yet)
  room.chainValue       = null; // value being chained (null = not chaining)

  for (const pid of room.turnOrder) {
    room.saidUno[pid] = false;
  }
}

// ─── Validation ───────────────────────────────────────────────────────────────

// Returns true if `card` may legally be played given the current game state.
// pendingDrawType is "draw_two" | "wild_draw_four" | null — set when a draw stack is active.
function isValidPlay(card, topCard, currentColor, pendingDrawCount, pendingDrawType) {
  if (pendingDrawCount > 0) {
    // During an active draw stack only the same draw-card type can continue it
    return card.type === pendingDrawType;
  }
  if (card.color === "wild") return true;           // wild always legal
  if (card.color === currentColor) return true;     // matches active color
  // Action card matching action card (skip-on-skip, etc.)
  if (topCard.type !== "number" && card.type === topCard.type) return true;
  // Number matching number
  if (card.type === "number" && topCard.type === "number" && card.value === topCard.value) return true;
  return false;
}

// ─── Card effects ─────────────────────────────────────────────────────────────

// Apply a card's game effect after it has already been pushed onto discardPile.
// `chosenColor` must be provided for wild / wild_draw_four.
function applyCardEffect(room, card, chosenColor) {
  const twoPlayer = room.turnOrder.length === 2;

  switch (card.type) {
    case "number":
      room.currentColor = card.color;
      advanceTurn(room, 1);
      break;

    case "skip":
      room.currentColor = card.color;
      // Advance 2 steps: skips the next player and lands on the one after.
      // In 2-player game this wraps back to the current player (they go again).
      advanceTurn(room, 2);
      break;

    case "reverse":
      room.direction  *= -1;
      room.currentColor = card.color;
      if (twoPlayer) {
        // Reverse in 2-player acts as a skip.
        // With direction flipped, advancing 2 in the new direction wraps back
        // to the same player index.
        advanceTurn(room, 2);
      } else {
        advanceTurn(room, 1);
      }
      break;

    case "draw_two": {
      room.currentColor     = card.color;
      room.pendingDrawCount = (room.pendingDrawCount || 0) + 2;
      room.pendingDrawType  = "draw_two";
      advanceTurn(room, 1); // next player must stack another +2 or draw the total
      break;
    }

    case "wild":
      room.currentColor = chosenColor;
      advanceTurn(room, 1);
      break;

    case "wild_draw_four": {
      room.currentColor     = chosenColor;
      room.pendingDrawCount = (room.pendingDrawCount || 0) + 4;
      room.pendingDrawType  = "wild_draw_four";
      advanceTurn(room, 1); // next player must stack another +4 or draw the total
      break;
    }

    default:
      advanceTurn(room, 1);
  }
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function cardPointValue(card) {
  if (card.type === "number") return card.value;
  if (card.type === "skip" || card.type === "reverse" || card.type === "draw_two") return 20;
  return 50; // wild, wild_draw_four
}

// Sum all cards still held by all players other than the round winner.
function calculateRoundScore(otherPlayersHands) {
  return Object.values(otherPlayersHands).reduce(
    (sum, hand) => sum + hand.reduce((s, c) => s + cardPointValue(c), 0),
    0
  );
}

// ─── View serialization ───────────────────────────────────────────────────────

// Produces a safe, per-player view of the game state.
// Each player only receives their own hand; opponents' hands are card-count only.
function buildUnoView(room, requestingPlayerId) {
  const topCard         = room.discardPile?.[room.discardPile.length - 1] ?? null;
  const currentPlayerId = getCurrentPlayerId(room);

  // Build player list in turn order so the UI can render them correctly.
  // Players not in turnOrder (lobby-only) fall back to insertion order.
  const orderedIds = room.turnOrder?.length
    ? room.turnOrder
    : Object.keys(room.players);
  const orderedPlayers = [
    ...orderedIds.filter((id) => room.players[id]),
    ...Object.keys(room.players).filter((id) => !orderedIds.includes(id)),
  ];

  return {
    code:               room.code,
    hostId:             room.hostId,
    gameType:           "uno",
    phase:              room.phase,
    turnOrder:          room.turnOrder ?? [],
    players: orderedPlayers.map((id) => {
      const p = room.players[id];
      return {
        id:           p.id,
        name:         p.name,
        isHost:       p.id === room.hostId,
        isConnected:  p.isConnected,
        cardCount:    room.hands?.[p.id]?.length ?? 0,
        isCurrentTurn: p.id === currentPlayerId,
        saidUno:      room.saidUno?.[p.id] ?? false,
      };
    }),
    topCard,
    drawPileCount:      room.drawPile?.length ?? 0,
    currentColor:       room.currentColor ?? null,
    currentTurnPlayerId: currentPlayerId ?? null,
    direction:          room.direction ?? 1,
    pendingDrawCount:   room.pendingDrawCount ?? 0,
    pendingDrawType:    room.pendingDrawType  ?? null,
    // Private: only this player's own cards
    hand:               room.hands?.[requestingPlayerId] ?? [],
    roundNumber:        room.roundNumber ?? 1,
    scores:             room.scores ?? {},
    roundWinnerId:      room.roundWinnerId      ?? null,
    lastRoundWinnerId:  room.lastRoundWinnerId  ?? null,
    gameWinnerId:       room.gameWinnerId       ?? null,
    // Draw & chain state — used by the client to restrict playable cards
    drawnCardId:        room.drawnCardId  ?? null,
    chainValue:         room.chainValue   ?? null,
    chainType:          room.chainType    ?? null,
    chainCount:         room.chainCount   ?? 0,
  };
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  dealCards,
  isValidPlay,
  applyCardEffect,
  drawCards,
  advanceTurn,
  getCurrentPlayerId,
  getNextTurnIndex,
  calculateRoundScore,
  buildUnoView,
};
