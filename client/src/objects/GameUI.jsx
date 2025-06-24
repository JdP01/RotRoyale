import React from 'react';
import MatchmakingSystem from './MatchmakingSystem';
import './styling/GameCanvas.css'; // Import the CSS fileI  

export function MenuUI({ startSinglePlayer, startMultiplayer }) {
  return (
    <div className="game-menu">
        <h1 className="game-title">
          Dino Game
        </h1>

        <div className="menu-buttons">
          <button
            onClick={startSinglePlayer}
            className="menu-button single-player-button"
          >
            Single Player
          </button>

          <button
            onClick={startMultiplayer}
            className="menu-button multiplayer-button"
          >
            Multiplayer
          </button>
        </div>
      </div>
  );
}

export function MatchmakingUI({ userSession, backToMenu, handleMatchFound, handleMatchmakingError }) {
  return (
    <div className="matchmaking-container">
      <button
        onClick={backToMenu}
        className="back-button"
      >
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