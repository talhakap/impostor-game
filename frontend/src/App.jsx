import React, { useState, useEffect } from "react";
import { socket } from "./socket";
import LandingScreen from "./components/LandingScreen";
import LobbyScreen from "./components/LobbyScreen";
import AnsweringScreen from "./components/AnsweringScreen";
import RevealScreen from "./components/RevealScreen";
import VotingScreen from "./components/VotingScreen";
import RoundResultsScreen from "./components/RoundResultsScreen";
import GameOverScreen from "./components/GameOverScreen";

export default function App() {
  const [myId, setMyId] = useState(null);
  const [room, setRoom] = useState(null);
  const [privateData, setPrivateData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    socket.on("connect", () => setMyId(socket.id));
    socket.on("disconnect", () => setMyId(null));

    socket.on("room:updated", (roomView) => {
      setRoom(roomView);
      setError(null);
    });

    socket.on("player:role_assigned", (data) => {
      setPrivateData(data);
    });

    socket.on("error", ({ message }) => {
      setError(message);
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("room:updated");
      socket.off("player:role_assigned");
      socket.off("error");
    };
  }, []);

  const handleLeave = () => {
    socket.emit("room:leave");
    setRoom(null);
    setPrivateData(null);
    setError(null);
  };

  if (!room) {
    return (
      <LandingScreen
        myId={myId}
        error={error}
        clearError={() => setError(null)}
      />
    );
  }

  const phase = room.phase;

  if (phase === "lobby") {
    return (
      <LobbyScreen
        room={room}
        myId={myId}
        error={error}
        clearError={() => setError(null)}
        onLeave={handleLeave}
      />
    );
  }

  if (phase === "assigning_roles") {
    return (
      <div className="container">
        <div className="card center-text">
          <h2>Round {room.roundNumber}</h2>
          <p className="muted">Assigning roles...</p>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  if (phase === "answering") {
    return <AnsweringScreen room={room} myId={myId} privateData={privateData} />;
  }

  if (phase === "revealing") {
    return <RevealScreen room={room} myId={myId} />;
  }

  if (phase === "voting") {
    return <VotingScreen room={room} myId={myId} />;
  }

  if (phase === "round_results") {
    return <RoundResultsScreen room={room} myId={myId} />;
  }

  if (phase === "game_over") {
    return <GameOverScreen room={room} myId={myId} />;
  }

  return null;
}
