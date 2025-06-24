// src/components/MatchmakingUI.jsx
import React from 'react';
import { useMatchmaking } from './MatchmakingLogic';

/**
 * UI Component for the matchmaking screen
 * This shows the user interface for finding and joining multiplayer matches
 */
const MatchmakingUI = ({ userSession, onMatchFound, onMatchmakingError }) => {
  // Get all the matchmaking logic and state from our custom hook
  const {
    isSearching,
    matchTicket,
    playersInMatch,
    elapsedTime,
    getTicketDisplay,
    startMatchmaking,
    cancelMatchmaking
  } = useMatchmaking(userSession, onMatchFound, onMatchmakingError);

  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      background: 'rgba(0, 0, 0, 0.9)',
      color: 'white',
      padding: '30px',
      borderRadius: '10px',
      textAlign: 'center',
      zIndex: 1000,
      minWidth: '350px',
      maxWidth: '500px'
    }}>
      <h2 style={{ marginBottom: '20px' }}>Multiplayer Matchmaking</h2>
      
      {/* Show different content based on whether we're searching or not */}
      {!isSearching ? (
        // Not searching - show the "Find Match" button
        <div>
          <p style={{ marginBottom: '20px' }}>Ready to find other players?</p>
          <button 
            onClick={startMatchmaking}
            style={{
              background: '#4CAF50',
              color: 'white',
              border: 'none',
              padding: '15px 30px',
              fontSize: '16px',
              borderRadius: '5px',
              cursor: 'pointer',
              margin: '10px'
            }}
          >
            Find Match
          </button>
        </div>
      ) : (
        // Currently searching - show search progress
        <div>
          <p style={{ marginBottom: '10px' }}>Searching for players...</p>
          
          {/* Show search details */}
          <div style={{
            margin: '10px 0',
            fontSize: '14px',
            opacity: 0.8
          }}>
            <p>Time elapsed: {elapsedTime}s</p>
            {matchTicket && <p>Ticket: {getTicketDisplay(matchTicket)}</p>}
          </div>
          
          {/* Progress bar and status */}
          <div style={{
            background: 'rgba(255,255,255,0.1)',
            padding: '10px',
            borderRadius: '5px',
            margin: '15px 0'
          }}>
            {/* Animated progress bar */}
            <div style={{
              width: '100%',
              height: '4px',
              background: 'rgba(255,255,255,0.2)',
              borderRadius: '2px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${Math.min(100, (elapsedTime / 30) * 100)}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #4CAF50, #2196F3)',
                transition: 'width 1s ease'
              }}></div>
            </div>
            
            {/* Status message that changes based on how long we've been searching */}
            <p style={{ fontSize: '12px', marginTop: '5px', opacity: 0.7 }}>
              {elapsedTime < 10 ? 'Looking for exact matches...' : 
               elapsedTime < 20 ? 'Expanding search criteria...' : 
               'Searching globally...'}
            </p>
          </div>
          
          {/* Cancel button */}
          <button 
            onClick={cancelMatchmaking}
            style={{
              background: '#f44336',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              fontSize: '14px',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Cancel Search
          </button>
        </div>
      )}

      {/* Show players in match once we find one */}
      {playersInMatch.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h3>Players in Match:</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {playersInMatch.map((player, index) => (
              <li key={index} style={{ 
                margin: '5px 0',
                padding: '5px',
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '3px'
              }}>
                {player.presence?.username || player.username || `Player ${index + 1}`}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Help text explaining how matchmaking works */}
      <div style={{
        marginTop: '20px',
        fontSize: '12px',
        opacity: 0.6,
        lineHeight: '1.4'
      }}>
        <p>• Looking for 2-4 players</p>
        <p>• Using global matchmaking</p>
        <p>• Game will start when match is found</p>
        <p>• Make sure your connection is stable</p>
      </div>
    </div>
  );
};

export default MatchmakingUI;