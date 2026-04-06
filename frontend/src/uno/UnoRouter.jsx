import React, { useState, useEffect } from "react";
import { socket } from "../socket";
import UnoLobby from "./UnoLobby";
import UnoGame  from "./UnoGame";

export default function UnoRouter({ room, myId, error, clearError, onLeave }) {
  const [chatMessages, setChatMessages] = useState([]);

  useEffect(() => {
    const handler = (msg) => setChatMessages((prev) => [...prev.slice(-299), msg]);
    socket.on("uno:chat", handler);
    return () => socket.off("uno:chat", handler);
  }, []);

  const { phase } = room;

  if (phase === "uno_lobby") {
    return <UnoLobby room={room} myId={myId} error={error} onLeave={onLeave} chatMessages={chatMessages} />;
  }

  if (phase === "uno_playing") {
    return <UnoGame room={room} myId={myId} error={error} clearError={clearError} chatMessages={chatMessages} />;
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
