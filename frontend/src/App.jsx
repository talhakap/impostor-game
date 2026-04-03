import React, { useState, useEffect } from "react";
import { socket } from "./socket";
import LandingScreen from "./components/LandingScreen";
import LobbyScreen from "./components/LobbyScreen";
import AnsweringScreen from "./components/AnsweringScreen";
import RoundCompleteScreen from "./components/RoundCompleteScreen";
import TiebreakerRevealScreen from "./components/TiebreakerRevealScreen";
import VotingScreen from "./components/VotingScreen";
import RoundResultsScreen from "./components/RoundResultsScreen";
import GameOverScreen from "./components/GameOverScreen";
import UnoRouter from "./uno/UnoRouter";

export default function App() {
  const [myId, setMyId] = useState(null);
  const [room, setRoom] = useState(null);
  const [privateData, setPrivateData] = useState(null);
  const [error, setError] = useState(null);
  const [kicked, setKicked] = useState(false);

  useEffect(() => {
    socket.on("connect", () => {
      setMyId(socket.id);

      // Attempt silent rejoin if we have a saved session
      const savedCode = localStorage.getItem("aeth_room_code");
      const savedName = localStorage.getItem("aeth_player_name");
      if (savedCode && savedName) {
        socket.emit("room:rejoin", { code: savedCode, playerName: savedName }, (res) => {
          if (res?.error) {
            // Room gone or name not found — clear stale session silently
            localStorage.removeItem("aeth_room_code");
            localStorage.removeItem("aeth_player_name");
          }
        });
      }
    });

    socket.on("disconnect", () => setMyId(null));
    socket.on("room:updated", (roomView) => { setRoom(roomView); setError(null); });
    socket.on("player:role_assigned", (data) => setPrivateData(data));
    socket.on("error", ({ message }) => setError(message));
    socket.on("kicked", () => {
      setRoom(null); setPrivateData(null); setKicked(true);
      localStorage.removeItem("aeth_room_code");
      localStorage.removeItem("aeth_player_name");
    });
    return () => {
      socket.off("connect"); socket.off("disconnect");
      socket.off("room:updated"); socket.off("player:role_assigned");
      socket.off("error"); socket.off("kicked");
    };
  }, []);

  const handleLeave = () => {
    setRoom(null); setPrivateData(null); setError(null);
    localStorage.removeItem("aeth_room_code");
    localStorage.removeItem("aeth_player_name");
  };

  if (!room) {
    return (
      <LandingScreen
        myId={myId}
        error={error}
        kicked={kicked}
        clearError={() => { setError(null); setKicked(false); }}
      />
    );
  }

  // Route all UNO phases to the UNO module — Impostor routing is untouched below
  if (room.gameType === "uno") {
    return (
      <UnoRouter
        room={room}
        myId={myId}
        error={error}
        clearError={() => setError(null)}
        onLeave={handleLeave}
      />
    );
  }

  const { phase } = room;

  if (phase === "lobby") {
    return <LobbyScreen room={room} myId={myId} error={error} clearError={() => setError(null)} onLeave={handleLeave} />;
  }

  if (phase === "assigning_roles") {
    return (
      <div className="container">
        <div className="card center-text">
          <h2>Game Starting</h2>
          <p className="muted" style={{ marginTop: "0.5rem" }}>Assigning roles...</p>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  if (phase === "answering") {
    return <AnsweringScreen room={room} myId={myId} privateData={privateData} />;
  }

  if (phase === "round_complete") {
    return <RoundCompleteScreen room={room} myId={myId} />;
  }

  if (phase === "voting") {
    return <VotingScreen room={room} myId={myId} />;
  }

  if (phase === "tiebreaker_answering") {
    return <AnsweringScreen room={room} myId={myId} privateData={privateData} isTiebreaker />;
  }

  if (phase === "tiebreaker_revealing") {
    return <TiebreakerRevealScreen room={room} myId={myId} />;
  }

  if (phase === "tiebreaker_voting") {
    return <VotingScreen room={room} myId={myId} isTiebreaker />;
  }

  if (phase === "round_results") {
    return <RoundResultsScreen room={room} myId={myId} />;
  }

  if (phase === "game_over") {
    return <GameOverScreen room={room} myId={myId} />;
  }

  return null;
}
