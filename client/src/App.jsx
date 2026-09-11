import React, {useState, useCallback, useEffect} from 'react';
import './styling/index.css';
import GameCanvas from './objects/world/GameCanvas';
import { MenuUI, MatchmakingUIWrapper } from './ui/mainMenu';
import { STOCK_VOXY } from './logic/characters';
import { usePlayerState } from './logic/PlayerState';
import { createGuestSession } from './logic/session';

const GuestLobbyLoading = ({ error, onRetry }) => (
  <div className="guest-lobby-loading">
    <p>{error ? 'Guest lobby is unavailable.' : 'Entering guest lobby...'}</p>
    {error && (
      <div className="guest-lobby-loading-actions">
        <button onClick={onRetry}>Retry</button>
      </div>
    )}
  </div>
);

export default function App() { 
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [guestSessionError, setGuestSessionError] = useState(null);
  const [guestSessionAttempt, setGuestSessionAttempt] = useState(0);
  const [userSession, setUserSession] = useState(null);
  const [gameState, setGameState] = useState('menu');
  const [currentMatch, setCurrentMatch] = useState(null);
  const [connectedPlayers, setConnectedPlayers] = useState([]);
  const [otherPlayersData, setOtherPlayersData] = useState({});
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  
  // Get reset function from PlayerState
  const { reset: resetPlayerState } = usePlayerState();

  useEffect(() => {
    if (isLoggedIn) return undefined;

    let cancelled = false;
    const startGuestSession = async () => {
      setGuestSessionError(null);
      try {
        const sessionData = await createGuestSession();
        if (cancelled) {
          sessionData.socket.disconnect();
          return;
        }
        setUserSession(sessionData);
        setIsLoggedIn(true);
      } catch (error) {
        if (!cancelled) {
          console.error('Guest lobby authentication failed:', error);
          setGuestSessionError(error);
        }
      }
    };

    startGuestSession();
    return () => {
      cancelled = true;
    };
  }, [guestSessionAttempt, isLoggedIn]);
  
  const onCharacterSelect = useCallback((character) => {
    setSelectedCharacter(userSession?.isGuest ? STOCK_VOXY : character);
  }, [userSession?.isGuest]);

  const handleLogout = () => {
    // Close socket connection if it exists
    if (userSession?.socket) {
      userSession.socket.disconnect();
    }
    
    // Reset player state on logout
    resetPlayerState();
    setUserSession(null);
    setIsLoggedIn(false);
    setGameState('menu');
    setCurrentMatch(null);
    setConnectedPlayers([]);
    setOtherPlayersData({});
  };

  const handleMatchFound = async (matchData) => {
    // console.log("Match found, setting up game:", matchData);

    setCurrentMatch(matchData);

    if (matchData.users && matchData.users.length > 0) {
      setConnectedPlayers(matchData.users);
      console.log("Initial players in match:", matchData.users);
    }

    // Reset player state when starting a new game
    resetPlayerState();
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
        console.log("Updated match data after join:", joinResult);
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

  const startSinglePlayer = (characterData) => {
    setSelectedCharacter(userSession?.isGuest ? STOCK_VOXY : characterData);
    // Reset player state when starting a new game
    resetPlayerState();
    setGameState('playing');
  };

  const startMultiplayer = (characterData) => {
    setSelectedCharacter(userSession?.isGuest ? STOCK_VOXY : characterData);
    setGameState('matchmaking');
  };

  const backToMenu = useCallback(() => {
    if (currentMatch && userSession?.socket) {
      try {
        userSession.socket.leaveMatch(currentMatch.match_id);
      } catch (error) {
        console.error("Error leaving match:", error);
      }
    }

    // Reset player state when returning to lobby
    resetPlayerState();
    setGameState('menu');
    setCurrentMatch(null);
    setConnectedPlayers([]);
    setOtherPlayersData({});
  }, [currentMatch, userSession, resetPlayerState]);

  // The guest lobby is the only available entry path for now.
  if (!isLoggedIn) {
    return (
      <GuestLobbyLoading
        error={guestSessionError}
        onRetry={() => setGuestSessionAttempt((attempt) => attempt + 1)}
      />
    );
  }

  // Menu UI
  if (gameState === 'menu') {
    return (
      <MenuUI
        startSinglePlayer={startSinglePlayer}
        startMultiplayer={startMultiplayer}
        onLogout={handleLogout}
        userSession={userSession}
        onMatchFound={handleMatchFound}
        onMatchmakingError={handleMatchmakingError}
        onCharacterSelect={onCharacterSelect}
      />
    );
  }

  // Matchmaking UI
  if (gameState === 'matchmaking') {
    return (
      <>
        <div style={{
          position: 'absolute', 
          top: '10px', 
          right: '10px', 
          zIndex: 1000,
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '10px',
          borderRadius: '5px'
        }}>
          <p>Welcome, {userSession?.username || 'Player'}!</p>
          <button onClick={handleLogout} style={{
            background: '#ff4444',
            color: 'white',
            border: 'none',
            padding: '5px 10px',
            borderRadius: '3px',
            cursor: 'pointer'
          }}>
            Logout
          </button>
        </div>
        <MatchmakingUIWrapper
          userSession={userSession}
          backToMenu={backToMenu}
          handleMatchFound={handleMatchFound}
          handleMatchmakingError={handleMatchmakingError}
          selectedCharacter={selectedCharacter}
        />
      </>
    );
  }

  // Game screen
  return (
    <div>
      <div style={{
        position: 'absolute', 
        top: '10px', 
        right: '10px', 
        zIndex: 1000,
        background: 'rgba(0,0,0,0.7)',
        color: 'white',
        padding: '10px',
        borderRadius: '5px'
      }}>
        <p>Welcome, {userSession?.username || 'Player'}!</p>
        <button onClick={handleLogout} style={{
          background: '#ff4444',
          color: 'white',
          border: 'none',
          padding: '5px 10px',
          borderRadius: '3px',
          cursor: 'pointer'
        }}>
          Logout
        </button>
      </div>
      <GameCanvas 
        userSession={userSession}
        currentMatch={currentMatch}
        connectedPlayers={connectedPlayers}
        otherPlayersData={otherPlayersData}
        setConnectedPlayers={setConnectedPlayers}
        setOtherPlayersData={setOtherPlayersData}
        backToMenu={backToMenu}
        selectedCharacter={selectedCharacter}
      />
    </div>
  );
}