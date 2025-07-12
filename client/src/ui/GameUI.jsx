import React from 'react';
import MatchmakingUI from './MatchmakingUI';
import '../styling/GameUI.css';

// Main menu UI component
export function MenuUI({ startSinglePlayer, startMultiplayer }) {
  return (
    <div className="game-menu">
      <h1 className="game-title">Dino Game</h1>
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

// Matchmaking wrapper component
export function MatchmakingUIWrapper({ userSession, backToMenu, handleMatchFound, handleMatchmakingError }) {
  return (
    <div className="matchmaking-container">
      <button onClick={backToMenu} className="back-button">
        Back to Menu
      </button>
      <MatchmakingUI
        userSession={userSession}
        onMatchFound={handleMatchFound}
        onMatchmakingError={handleMatchmakingError}
      />
    </div>
  );
}

// In-game information overlay component
export function GameInfoOverlay({ 
  currentMatch, 
  connectedPlayers, 
  otherPlayersData, 
  userSession,
  onRespawn,
  onBackToMenu 
}) {
  return (
    <div className="game-info-overlay">
      <p><strong>Game Mode:</strong> {currentMatch ? 'Multiplayer' : 'Single Player'}</p>
      {currentMatch && (
        <>
          <p><strong>Match ID:</strong> {currentMatch.match_id?.substring(0, 8)}...</p>
          <p><strong>Players Connected:</strong> {connectedPlayers.length}</p>
          <p>
            <strong>Other Players Visible:</strong> 
            <span style={{ color: Object.keys(otherPlayersData).length > 0 ? '#4CAF50' : '#f44336' }}>
              {Object.keys(otherPlayersData).length}
            </span>
          </p>
          <p><strong>My Player ID:</strong> {userSession?.account?.user?.id?.substring(0, 8)}...</p>

          {Object.keys(otherPlayersData).length > 0 && (
            <div className="other-players-summary">
              <p><strong>Other Players:</strong></p>
              {Object.entries(otherPlayersData).map(([playerId, data]) => (
                <div key={playerId} className="other-player-item">
                  • {data.username || playerId.substring(0, 8)}...
                  <br />
                  &nbsp;&nbsp;Pos: ({data.position?.x?.toFixed(1)}, 
                         {data.position?.y?.toFixed(1)}, 
                         {data.position?.z?.toFixed(1)})
                  <br />
                  &nbsp;&nbsp;Last: {Math.floor((Date.now() - data.lastUpdate) / 1000)}s ago
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div className="button-group">
        <button onClick={onRespawn} className="info-respawn-button">
          Respawn
        </button>
        <button onClick={onBackToMenu} className="info-back-button">
          Back to Menu
        </button>
      </div>
    </div>
  );
}