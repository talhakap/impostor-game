import React from "react";
import UnoLobby       from "./UnoLobby";
import UnoGame        from "./UnoGame";
import UnoResultScreen from "./UnoResultScreen";

export default function UnoRouter({ room, myId, error, clearError, onLeave }) {
  const { phase } = room;

  if (phase === "uno_lobby") {
    return (
      <UnoLobby
        room={room}
        myId={myId}
        error={error}
        onLeave={onLeave}
      />
    );
  }

  if (phase === "uno_playing") {
    return (
      <UnoGame
        room={room}
        myId={myId}
        error={error}
        clearError={clearError}
      />
    );
  }

  if (phase === "uno_round_over") {
    return (
      <UnoResultScreen
        room={room}
        myId={myId}
      />
    );
  }

  // Fallback spinner for any transient/unknown phase
  return (
    <div className="container">
      <div className="card center-text">
        <div className="spinner" />
      </div>
    </div>
  );
}
