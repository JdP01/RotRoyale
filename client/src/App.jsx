import React, { useState } from 'react';
import './index.css';
import './objects/styling/App.css';
import GameCanvas from './objects/GameCanvas';
import LoginPage from './LandingPage/LoginPage';
import { MenuUI, MatchmakingUIWrapper, GameInfoOverlay } from './objects/GameUI';

export default function App() {
  // Authentication state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userSession, setUserSession] = useState(null);
  
  // Game state management
  const [gameState, setGameState] = useState('menu');
  const [currentMatch, setCurrentMatch] = useState(null);
  const [connectedPlayers, setConnectedPlayers] = useState([]);
  const [otherPlayersData, setOtherPlayersData] = useState({});

  // Authentication handlers
  const handleLogin = (sessionData) => {
    console.log("Login successful, session data:", sessionData);
    setUserSession(sessionData);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
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

  // Game state handlers
  const startSinglePlayer = () => {
    setGameState('playing');
  };

  const startMultiplayer = () => {
    setGameState('matchmaking');
  };

  const backToMenu = () => {
    if (currentMatch && userSession?.socket) {
      userSession.socket.leaveMatch(currentMatch.match_id);
    }
    setGameState('menu');
    setCurrentMatch(null);
    setConnectedPlayers([]);
    setOtherPlayersData({});
  };

  // Matchmaking handlers
  const handleMatchFound = async (matchData) => {
    console.log("Match found, setting up game:", matchData);
    setCurrentMatch(matchData);

    if (matchData.users && matchData.users.length > 0) {
      setConnectedPlayers(matchData.users);
    }

    setGameState('playing');

    try {
      let joinResult;
      if (matchData.match_id) {
        try {
          joinResult = await userSession.socket.joinMatch(matchData.match_id);
        } catch (idError) {
          if (matchData.token) {
            joinResult = await userSession.socket.joinMatch(null, matchData.token);
          } else {
            throw idError;
          }
        }
      } else if (matchData.token) {
        joinResult = await userSession.socket.joinMatch(null, matchData.token);
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

  const handleRespawn = () => {
    // Call the respawn function exposed by GameCanvas
    if (window.gameActions?.respawn) {
      window.gameActions.respawn();
      
      // If in multiplayer, notify other players about the respawn
      if (currentMatch && userSession?.socket) {
        try {
          userSession.socket.sendMatchState(currentMatch.match_id, {
            data: {
              type: 'player_respawn',
              playerId: userSession.account.user.id,
              username: userSession.username || 'Unknown Player',
              timestamp: Date.now()
            }
          });
        } catch (error) {
          console.error("Error sending respawn event:", error);
        }
      }
    }
  };

  // Socket event handlers for multiplayer
  React.useEffect(() => {
    if (!userSession?.socket) return;

    const socket = userSession.socket;

    socket.onmatchdata = (matchData) => {
      try {
        if (matchData.data instanceof Uint8Array) {
          // Handle binary data if needed
          return;
        }

        const gameUpdate = matchData.data;
        
        if (gameUpdate.type === 'player_update' && 
            gameUpdate.playerId && 
            gameUpdate.playerId !== userSession.account.user.id) {
          setOtherPlayersData(prev => ({
            ...prev,
            [gameUpdate.playerId]: {
              ...gameUpdate,
              lastUpdate: Date.now()
            }
          }));
        }
      } catch (error) {
        console.error("Error processing match data:", error);
      }
    };

    socket.onmatchpresence = (matchPresence) => {
      const joinedPlayers = matchPresence.joins || [];
      const leftPlayers = matchPresence.leaves || [];

      setConnectedPlayers(prev => {
        let updated = [...prev];
        joinedPlayers.forEach(player => {
          if (!updated.find(p => p.user_id === player.user_id)) {
            updated.push(player);
          }
        });

        leftPlayers.forEach(player => {
          updated = updated.filter(p => p.user_id !== player.user_id);
          setOtherPlayersData(prev => {
            const newData = { ...prev };
            delete newData[player.user_id];
            return newData;
          });
        });

        return updated;
      });
    };

    return () => {
      socket.onmatchdata = null;
      socket.onmatchpresence = null;
    };
  }, [userSession]);

  // Render login page if not logged in
  if (!isLoggedIn) {
    return <LoginPage onLoginSuccess={handleLogin} />;
  }

  return (
    <div className="game-container">
      {/* User info and logout button */}
      <div className="user-info">
        <p>Welcome, {userSession?.username || 'Player'}!</p>
        <button onClick={handleLogout}>Logout</button>
      </div>

      {/* Game state dependent UI */}
      {gameState === 'menu' && (
        <MenuUI
          startSinglePlayer={startSinglePlayer}
          startMultiplayer={startMultiplayer}
        />
      )}

      {gameState === 'matchmaking' && (
        <MatchmakingUIWrapper
          userSession={userSession}
          backToMenu={backToMenu}
          handleMatchFound={handleMatchFound}
          handleMatchmakingError={handleMatchmakingError}
        />
      )}

      {gameState === 'playing' && (
        <>
          <GameInfoOverlay
            currentMatch={currentMatch}
            connectedPlayers={connectedPlayers}
            otherPlayersData={otherPlayersData}
            userSession={userSession}
            onRespawn={handleRespawn}
            onBackToMenu={backToMenu}
          />
          <GameCanvas
            userSession={userSession}
            currentMatch={currentMatch}
            otherPlayersData={otherPlayersData}
            setOtherPlayersData={setOtherPlayersData}
          />
        </>
      )}
    </div>
  );
}