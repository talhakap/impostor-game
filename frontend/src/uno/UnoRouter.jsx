import React from "react";
import UnoLobby from "./UnoLobby";
import UnoGame  from "./UnoGame";

export default function UnoRouter({ room, myId, error, clearError, onLeave }) {
  const { phase } = room;

  if (phase === "uno_lobby") {
    return <UnoLobby room={room} myId={myId} error={error} onLeave={onLeave} />;
  }

  if (phase === "uno_playing") {
    return <UnoGame room={room} myId={myId} error={error} clearError={clearError} />;
  }

  // Fallback spinner for any transient phase
  return (
    <div className="container">
      <div className="card center-text">
        <div className="spinner" />
      </div>
    </div>
  );
}
