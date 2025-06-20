import React, { useState, useEffect } from 'react';
import './mainGameUI.css';
import GameCanvas from './objects/GameCanvas';

export const MainGameUI = ({ userSession }) => {
  const [gameState, setGameState] = useState('menu');
  const [currentMatch, setCurrentMatch] = useState(null);
  const [connectedPlayers, setConnectedPlayers] = useState([]);

  const handleMatchFound = async (matchData) => {
    console.log("Match found, setting up game:", matchData);
    setCurrentMatch(matchData);
    setGameState('playing');

    try {
      console.log("Attempting to join match with ID:", matchData.match_id);
      let joinResult;

      if (matchData.match_id) {
        try {
          joinResult = await userSession.socket.joinMatch(matchData.match_id);
          console.log("Successfully joined match with ID:", joinResult);
        } catch (idError) {
          console.log("Failed to join with ID, trying token...", idError);
          if (matchData.token) {
            joinResult = await userSession.socket.joinMatch(null, matchData.token);
            console.log("Successfully joined match with token:", joinResult);
          } else {
            throw idError;
          }
        }
      } else if (matchData.token) {
        joinResult = await userSession.socket.joinMatch(null, matchData.token);
        console.log("Successfully joined match with token:", joinResult);
      } else {
        throw new Error("No match ID or token available");
      }

      if (joinResult) {
        setCurrentMatch(prev => ({
          ...prev,
          ...joinResult,
          match_id: joinResult.match_id || prev.match_id
        }));
      }
    } catch (error) {
      console.error("Error joining match:", error);
      alert(`Failed to join match: ${error.message}. Please try again.`);
      setGameState('matchmaking');
    }
  };

  const handleMatchmakingError = (error) => {
    console.error("Matchmaking error:", error);
    alert(`Matchmaking failed: ${error}`);
  };

  const startSinglePlayer = () => {
    setGameState('playing');
  };

  const startMultiplayer = () => {
    setGameState('matchmaking');
  };

  const backToMenu = () => {
    if (currentMatch && userSession?.socket) {
      try {
        userSession.socket.leaveMatch(currentMatch.match_id);
      } catch (error) {
        console.error("Error leaving match:", error);
      }
    }
    setGameState('menu');
    setCurrentMatch(null);
    setConnectedPlayers([]);
  };

  // Menu UI
  if (gameState === 'menu') {
    return (
      <div className="game-menu">
        <h1 className="game-title">Dino Game</h1>
        <div className="menu-buttons">
          <button onClick={startSinglePlayer} className="menu-button single-player-button">
            Single Player
          </button>
          <button onClick={startMultiplayer} className="menu-button multiplayer-button">
            Multiplayer
          </button>
        </div>
      </div>
    );
  }

  // Matchmaking UI
  if (gameState === 'matchmaking') {
    return (
      <div className="matchmaking-container">
        <button onClick={backToMenu} className="back-button">
          Back to Menu
        </button>
        <MatchmakingSystem
          userSession={userSession}
          onMatchFound={handleMatchFound}
          onMatchmakingError={handleMatchmakingError}
        />
      </div>
    );
  }

  // Game UI
  return <GameCanvas userSession={userSession} currentMatch={currentMatch} onBackToMenu={backToMenu} />;
};

// Matchmaking System Component
const MatchmakingSystem = ({ userSession, onMatchFound, onMatchmakingError }) => {
  // ...existing code from MatchmakingSystem.jsx...
};
