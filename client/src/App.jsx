import React, {useState, useCallback, useMemo} from 'react';
import './styling/index.css';
import GameCanvas from './objects/world/GameCanvas';
import LoginPage from './ui/LoginPage';
import { MenuUI, MatchmakingUIWrapper } from './ui/mainMenu';
import { usePlayerState } from './logic/PlayerState';

const SHOWCASE_CHARACTERS = [
  { name: 'Voxy', model: 'dino_display', path: '/displayObjects/dino_display.glb', component: 'dino' },
  { name: 'Right To Bear Arms', model: 'teddy_display', path: '/displayObjects/teddy_display.glb', component: 'bear' },
  { name: 'RaveVoxy', model: 'dino_ket', path: '/displayObjects/dino_display.glb', component: 'dino' }
];

function PortfolioShowcaseApp() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedCharacterIndex, setSelectedCharacterIndex] = useState(0);
  const { reset: resetPlayerState } = usePlayerState();

  const selectedCharacter = SHOWCASE_CHARACTERS[selectedCharacterIndex];

  const startShowcase = () => {
    resetPlayerState();
    setIsPlaying(true);
  };

  const backToShowcase = () => {
    resetPlayerState();
    setIsPlaying(false);
  };

  if (isPlaying) {
    return (
      <GameCanvas
        userSession={null}
        currentMatch={null}
        connectedPlayers={[]}
        otherPlayersData={{}}
        setConnectedPlayers={() => {}}
        setOtherPlayersData={() => {}}
        backToMenu={backToShowcase}
        selectedCharacter={selectedCharacter}
      />
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '1rem',
      padding: '2rem',
      textAlign: 'center',
      background: 'radial-gradient(circle at top, #18345a 0%, #0b1627 70%)',
      color: '#f2f6fc'
    }}>
      <h1 style={{ margin: 0 }}>Rot Royale - 3D Showcase</h1>
      <p style={{ maxWidth: '680px', opacity: 0.9, margin: 0 }}>
        Portfolio demo mode: movement, camera rig, physics, animation blending, and world interaction.
        This mode runs without login or multiplayer services.
      </p>

      <label htmlFor="showcase-character" style={{ fontWeight: 600 }}>Character</label>
      <select
        id="showcase-character"
        value={selectedCharacterIndex}
        onChange={(e) => setSelectedCharacterIndex(Number(e.target.value))}
        style={{
          minWidth: '280px',
          padding: '0.6rem 0.75rem',
          borderRadius: '8px',
          border: '1px solid #3a5a84',
          background: '#0f223b',
          color: '#f2f6fc'
        }}
      >
        {SHOWCASE_CHARACTERS.map((character, index) => (
          <option key={character.name} value={index}>
            {character.name}
          </option>
        ))}
      </select>

      <button
        onClick={startShowcase}
        style={{
          marginTop: '0.25rem',
          padding: '0.75rem 1.4rem',
          border: 'none',
          borderRadius: '8px',
          fontWeight: 700,
          cursor: 'pointer',
          background: '#23b828',
          color: '#081411'
        }}
      >
        Launch 3D Demo
      </button>

      <p style={{ opacity: 0.8, marginTop: '0.5rem' }}>
        Controls: WASD move, Shift sprint, Space jump, mouse to look.
      </p>
    </div>
  );
}

export default function App() { 
  const showcaseMode = useMemo(() => {
    const fromEnv = import.meta.env.VITE_PORTFOLIO_MODE === 'true';
    const fromQuery = new URLSearchParams(window.location.search).get('showcase') === '1';
    return fromEnv || fromQuery;
  }, []);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userSession, setUserSession] = useState(null);
  const [gameState, setGameState] = useState('menu');
  const [currentMatch, setCurrentMatch] = useState(null);
  const [connectedPlayers, setConnectedPlayers] = useState([]);
  const [otherPlayersData, setOtherPlayersData] = useState({});
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  
  // Get reset function from PlayerState
  const { reset: resetPlayerState } = usePlayerState();

  if (showcaseMode) {
    return <PortfolioShowcaseApp />;
  }
  
  const onCharacterSelect = useCallback((character) => {
    setSelectedCharacter(character);
  }, []);

  const handleLogin = (sessionData) => {
    // console.log("Login successful, session data:", sessionData);
    setUserSession(sessionData);
    setIsLoggedIn(true);
  };

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
    setSelectedCharacter(characterData);
    // Reset player state when starting a new game
    resetPlayerState();
    setGameState('playing');
  };

  const startMultiplayer = (characterData) => {
    setSelectedCharacter(characterData);
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

  // If not logged in, show the LoginPage
  if (!isLoggedIn) {
    return <LoginPage onLoginSuccess={handleLogin} />;
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