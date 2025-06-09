// src/objects/MatchmakingSystem.jsx
import React, { useState, useEffect } from 'react';

const MatchmakingSystem = ({ userSession, onMatchFound, onMatchmakingError }) => {
  const [isSearching, setIsSearching] = useState(false);
  const [matchTicket, setMatchTicket] = useState(null);
  const [playersInMatch, setPlayersInMatch] = useState([]);

  useEffect(() => {
    if (!userSession?.socket) return;

    const socket = userSession.socket;

    // Listen for matchmaker events
    socket.onmatchmakermatched = (matched) => {
      console.log("Match found:", matched);
      setIsSearching(false);
      setPlayersInMatch(matched.users);
      onMatchFound(matched);
    };

    socket.onmatchmakerticker = (ticket) => {
      console.log("Matchmaking ticket:", ticket);
      setMatchTicket(ticket);
    };

    // Cleanup listeners
    return () => {
      socket.onmatchmakermatched = null;
      socket.onmatchmakerticker = null;
    };
  }, [userSession, onMatchFound]);

  const startMatchmaking = async () => {
    if (!userSession?.socket) {
      onMatchmakingError?.("Not connected to server");
      return;
    }

    setIsSearching(true);
    
    try {
      // Basic matchmaking query - you can customize this
      const matchmakingQuery = "*"; // Match with anyone
      const minPlayers = 2;
      const maxPlayers = 4;

      const ticket = await userSession.socket.addMatchmaker(
        matchmakingQuery,
        minPlayers,
        maxPlayers
      );
      
      console.log("Matchmaking started with ticket:", ticket);
      setMatchTicket(ticket);
    } catch (error) {
      console.error("Matchmaking error:", error);
      setIsSearching(false);
      onMatchmakingError?.(error.message);
    }
  };

  const cancelMatchmaking = async () => {
    if (!userSession?.socket || !matchTicket) return;

    try {
      await userSession.socket.removeMatchmaker(matchTicket);
      setIsSearching(false);
      setMatchTicket(null);
      console.log("Matchmaking cancelled");
    } catch (error) {
      console.error("Error cancelling matchmaking:", error);
    }
  };

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
      minWidth: '300px'
    }}>
      <h2>Multiplayer Matchmaking</h2>
      
      {!isSearching ? (
        <div>
          <p>Ready to find other players?</p>
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
        <div>
          <p>Searching for players...</p>
          <div style={{
            margin: '20px 0',
            fontSize: '14px',
            opacity: 0.8
          }}>
            {matchTicket && `Ticket: ${matchTicket}`}
          </div>
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

      {playersInMatch.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h3>Players in Match:</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {playersInMatch.map((player, index) => (
              <li key={index} style={{ margin: '5px 0' }}>
                {player.presence.username}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default MatchmakingSystem;