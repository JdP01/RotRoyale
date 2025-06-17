// src/objects/MatchmakingSystem.jsx
import React, { useState, useEffect } from 'react';

const MatchmakingSystem = ({ userSession, onMatchFound, onMatchmakingError }) => {
  const [isSearching, setIsSearching] = useState(false);
  const [matchTicket, setMatchTicket] = useState(null);
  const [playersInMatch, setPlayersInMatch] = useState([]);
  const [searchStartTime, setSearchStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (!userSession?.socket) return;

    const socket = userSession.socket;

    // Listen for matchmaker events
    socket.onmatchmakermatched = (matched) => {
      console.log("Match found:", matched);
      setIsSearching(false);
      setPlayersInMatch(matched.users || []);
      
      // Enhanced match data processing
      const matchData = {
        match_id: matched.match_id,
        token: matched.token,
        users: matched.users || [],
        // Add more debugging info
        self: matched.self,
        presences: matched.presences || []
      };
      
      console.log("Processed match data:", matchData);
      console.log("Match ID:", matched.match_id);
      console.log("Token:", matched.token);
      console.log("Users in match:", matched.users);
      
      onMatchFound(matchData);
    };

    socket.onmatchmakerticker = (ticket) => {
      console.log("Matchmaking ticket received:", ticket);
      setMatchTicket(ticket);
    };

    // Also listen for any errors
    socket.onmatchmakererror = (error) => {
      console.error("Matchmaker error:", error);
      setIsSearching(false);
      onMatchmakingError?.(error.message || "Matchmaking failed");
    };

    // Cleanup listeners
    return () => {
      socket.onmatchmakermatched = null;
      socket.onmatchmakerticker = null;
      socket.onmatchmakererror = null;
    };
  }, [userSession, onMatchFound, onMatchmakingError]);

  // Update elapsed time
  useEffect(() => {
    let interval;
    if (isSearching && searchStartTime) {
      interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - searchStartTime) / 1000));
      }, 1000);
    } else {
      setElapsedTime(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isSearching, searchStartTime]);

  // Helper function to safely get ticket display string
  const getTicketDisplay = (ticket) => {
    if (!ticket) return '';
    
    // If ticket is a string, use it directly
    if (typeof ticket === 'string') {
      return ticket.length > 8 ? ticket.substring(0, 8) + '...' : ticket;
    }
    
    // If ticket is an object, try to get ticket property or convert to string
    if (typeof ticket === 'object') {
      if (ticket.ticket && typeof ticket.ticket === 'string') {
        return ticket.ticket.length > 8 ? ticket.ticket.substring(0, 8) + '...' : ticket.ticket;
      }
      
      // Convert object to string and truncate
      const ticketStr = JSON.stringify(ticket);
      return ticketStr.length > 8 ? ticketStr.substring(0, 8) + '...' : ticketStr;
    }
    
    // Fallback: convert to string
    const ticketStr = String(ticket);
    return ticketStr.length > 8 ? ticketStr.substring(0, 8) + '...' : ticketStr;
  };

  const startMatchmaking = async () => {
    if (!userSession?.socket) {
      onMatchmakingError?.("Not connected to server");
      return;
    }

    setIsSearching(true);
    setSearchStartTime(Date.now());
    setElapsedTime(0);
    
    try {
      // More specific matchmaking query to ensure players end up in same match
      const matchmakingQuery = "+properties.region:*"; // Match anyone in any region
      const minPlayers = 2;
      const maxPlayers = 4;
      
      // Add consistent properties to help with matching
      const stringProperties = {
        "region": "global", // Everyone uses same region
        "game_mode": "dino_battle" // Specific game mode
      };
      const numericProperties = {
        "skill": 1000, // Same skill level for all players
        "version": 1 // Game version
      };

      console.log("Starting matchmaking with parameters:", {
        query: matchmakingQuery,
        minPlayers,
        maxPlayers,
        stringProperties,
        numericProperties
      });

      const ticket = await userSession.socket.addMatchmaker(
        matchmakingQuery,
        minPlayers,
        maxPlayers,
        stringProperties,
        numericProperties
      );
      
      console.log("Matchmaking started with ticket:", ticket);
      setMatchTicket(ticket);
    } catch (error) {
      console.error("Matchmaking error:", error);
      setIsSearching(false);
      setSearchStartTime(null);
      onMatchmakingError?.(error.message || "Failed to start matchmaking");
    }
  };

  const cancelMatchmaking = async () => {
    if (!userSession?.socket || !matchTicket) return;

    try {
      await userSession.socket.removeMatchmaker(matchTicket);
      setIsSearching(false);
      setSearchStartTime(null);
      setMatchTicket(null);
      setElapsedTime(0);
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
      minWidth: '350px',
      maxWidth: '500px'
    }}>
      <h2 style={{ marginBottom: '20px' }}>Multiplayer Matchmaking</h2>
      
      {!isSearching ? (
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
        <div>
          <p style={{ marginBottom: '10px' }}>Searching for players...</p>
          <div style={{
            margin: '10px 0',
            fontSize: '14px',
            opacity: 0.8
          }}>
            <p>Time elapsed: {elapsedTime}s</p>
            {matchTicket && <p>Ticket: {getTicketDisplay(matchTicket)}</p>}
          </div>
          
          <div style={{
            background: 'rgba(255,255,255,0.1)',
            padding: '10px',
            borderRadius: '5px',
            margin: '15px 0'
          }}>
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
            <p style={{ fontSize: '12px', marginTop: '5px', opacity: 0.7 }}>
              {elapsedTime < 10 ? 'Looking for exact matches...' : 
               elapsedTime < 20 ? 'Expanding search criteria...' : 
               'Searching globally...'}
            </p>
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

export default MatchmakingSystem;