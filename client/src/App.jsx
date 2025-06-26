import React, {useState} from 'react';
import './index.css';
import GameCanvas from './objects/GameCanvas';
import LoginPage from './LandingPage/LoginPage';
import { MenuUI, MatchmakingUIWrapper } from './objects/GameUI';

export default function App() { 
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userSession, setUserSession] = useState(null);
  const [gameState, setGameState] = useState('menu');
  const [currentMatch, setCurrentMatch] = useState(null);
  const [connectedPlayers, setConnectedPlayers] = useState([]);
  const [otherPlayersData, setOtherPlayersData] = useState({});
  
  const handleLogin = (sessionData) => {
    console.log("Login successful, session data:", sessionData);
    setUserSession(sessionData);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    // Close socket connection if it exists
    if (userSession?.socket) {
      userSession.socket.disconnect();
    }
    setUserSession(null);
    setIsLoggedIn(false);
    setGameState('menu');
    setCurrentMatch(null);
    setConnectedPlayers([]);
    setOtherPlayersData({});
  };

  const handleMatchFound = async (matchData) => {
    console.log("Match found, setting up game:", matchData);

    setCurrentMatch(matchData);

    if (matchData.users && matchData.users.length > 0) {
      setConnectedPlayers(matchData.users);
      console.log("Initial players in match:", matchData.users);
    }

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
    setOtherPlayersData({});
  };

  // If not logged in, show the LoginPage
  if (!isLoggedIn) {
    return <LoginPage onLoginSuccess={handleLogin} />;
  }

  // Menu UI
  if (gameState === 'menu') {
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
        <MenuUI
          startSinglePlayer={startSinglePlayer}
          startMultiplayer={startMultiplayer}
        />
      </>
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
      />
    </div>
  );
}