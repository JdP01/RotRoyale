import React, { useState, useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useSpring, animated } from '@react-spring/three';
import { useGLTF } from '@react-three/drei';
import { useMatchmaking } from '../logic/MatchmakingLogic';
import MatchmakingUI from './MatchmakingUI';
import '../styling/GameUI.css';
import StoreNavigation from './stores';

// Dino Character component using GLB model
function DinoCharacter({ position, rotation, scale = 1, modelPath }) {
  const groupRef = useRef();
  const { scene } = useGLTF(modelPath);
  
  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.3;
    }
  });

  return (
    <animated.group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      <primitive object={scene.clone()} />
    </animated.group>
  );
}

// Move characters array outside component to prevent recreation on every render
const CHARACTERS = [
  { name: 'Voxy', model: 'dino_display', path: '/displayObjects/dino_display.glb', component: 'dino' },
  { name: 'Teddy', model: 'teddy_display', path: '/displayObjects/teddy_display.glb', component: 'bear' },
  { name: 'RaveVoxy', model: 'dino_ket', path: '/displayObjects/dino_display.glb', component: 'dino' }
];

// Character Carousel Component
function CharacterCarousel({ currentCharacterIndex, setCurrentCharacterIndex }) {
  // Use the stable reference
  const characters = CHARACTERS;

  const { position: centerPosition } = useSpring({
    position: [0, -1.9, -1], // Adjusted Y position for better display
    config: { tension: 120, friction: 14 }
  });

  const { position: leftPosition } = useSpring({
    position: [-3.5, -1.9, -1.5],
    config: { tension: 120, friction: 14 }
  });

  const { position: rightPosition } = useSpring({
    position: [3.5, -1.9, -1.5],
    config: { tension: 120, friction: 14 }
  });

  const navigateLeft = () => {
    setCurrentCharacterIndex((prev) => 
      prev === 0 ? characters.length - 1 : prev - 1
    );
  };

  const navigateRight = () => {
    setCurrentCharacterIndex((prev) => 
      (prev + 1) % characters.length
    );
  };

  return (
    <>
      <Canvas className="character-canvas" camera={{ position: [0, 0, 4], fov: 60 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 10, 5]} intensity={1.2} />
        <spotLight position={[0, 5, 0]} intensity={0.5} angle={0.3} penumbra={1} />
        
        {/* Current character in center */}
        <DinoCharacter
          position={centerPosition}
          rotation={[0, 0, 0]}
          scale={0.4}
          modelPath={characters[currentCharacterIndex].path}
        />
        
        {/* For future multiple characters, we can add navigation logic here */}
        {characters.length > 1 && (
          <>
            {/* Previous character on left (if exists) */}
            {currentCharacterIndex > 0 && (
              <DinoCharacter
                position={leftPosition}
                rotation={[0, Math.PI * 0.2, 0]}
                scale={0.25}
                modelPath={characters[currentCharacterIndex - 1].path}
              />
            )}
            
            {/* Next character on right (if exists) */}
            {currentCharacterIndex < characters.length - 1 && (
              <DinoCharacter
                position={rightPosition}
                rotation={[0, -Math.PI * 0.2, 0]}
                scale={0.25}
                modelPath={characters[currentCharacterIndex + 1].path}
              />
            )}
            
            {/* Last character on left when at first */}
            {currentCharacterIndex === 0 && characters.length > 1 && (
              <DinoCharacter
                position={leftPosition}
                rotation={[0, Math.PI * 0.2, 0]}
                scale={0.25}
                modelPath={characters[characters.length - 1].path}
              />
            )}
            
            {/* First character on right when at last */}
            {currentCharacterIndex === characters.length - 1 && characters.length > 1 && (
              <DinoCharacter
                position={rightPosition}
                rotation={[0, -Math.PI * 0.2, 0]}
                scale={0.25}
                modelPath={characters[0].path}
              />
            )}
          </>
        )}
      </Canvas>
      
      {/* Navigation arrows - hidden when only one character */}
      {characters.length > 1 && (
        <>
          <button className="carousel-arrow carousel-arrow-left" onClick={navigateLeft}>
            ‹
          </button>
          <button className="carousel-arrow carousel-arrow-right" onClick={navigateRight}>
            ›
          </button>
        </>
      )}
      
      {/* Character name */}
      <div className="character-name">
        {characters[currentCharacterIndex].name}
      </div>
    </>
  );
}

// Main menu UI component
export function MenuUI({ startSinglePlayer, startMultiplayer, onLogout, userSession, onMatchFound, onMatchmakingError, onCharacterSelect }) {
  const [currentCharacterIndex, setCurrentCharacterIndex] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showGameModeSelect, setShowGameModeSelect] = useState(false);
  const [showMatchmakingButton, setShowMatchmakingButton] = useState(false);
  const [storePage, setStorePage] = useState(null); // null | 'coins' | 'store'
  const [currentCoins, setCurrentCoins] = useState(0);

  // Use the stable reference
  const characters = CHARACTERS;

  useEffect(() => {
    if (onCharacterSelect) {
      onCharacterSelect(characters[currentCharacterIndex]);
    }
  }, [currentCharacterIndex, onCharacterSelect]);

  // Utility function to get user assets
  const getAssets = async () => {
    try {
      if (!userSession?.client || !userSession?.session) {
        return { coins: 0, skins: [] };
      }
      
      const response = await userSession.client.rpc(userSession.session, "get_assets", "");
      console.log('Main menu RPC response:', response);
      
      // Check if payload is already an object or needs parsing
      if (typeof response.payload === 'string') {
        return JSON.parse(response.payload);
      } else {
        return response.payload;
      }
    } catch (error) {
      console.error('Failed to get assets:', error);
      return { coins: 0, skins: [] };
    }
  };

  // Load initial coin balance
  useEffect(() => {
    loadUserAssets();
  }, [userSession]);

  const loadUserAssets = async () => {
    const assets = await getAssets();
    setCurrentCoins(assets.coins || 0);
  };

  // Handle coin balance updates from store
  const handleCoinsUpdate = (newCoinBalance) => {
    setCurrentCoins(newCoinBalance);
  };

  // Use the matchmaking hook
  const {
    isSearching,
    matchTicket,
    playersInMatch,
    elapsedTime,
    getTicketDisplay,
    startMatchmaking,
    cancelMatchmaking
  } = useMatchmaking(userSession, onMatchFound, onMatchmakingError);

  const handleDropdownToggle = () => {
    setDropdownOpen(!dropdownOpen);
  };

  const handleStartGameClick = () => {
    setShowGameModeSelect(true);
  };

  const handleBackToMenu = () => {
    setShowGameModeSelect(false);
    setShowMatchmakingButton(false);
  };

  const handleLogout = () => {
    setDropdownOpen(false);
    onLogout();
  };

  const handleSinglePlayerClick = () => {
    const selectedCharacter = characters[currentCharacterIndex];
    startSinglePlayer(selectedCharacter);
  };

  const handleMultiplayerClick = () => {
    setShowMatchmakingButton(true);
  };

  const handleMatchmakingToggle = () => {
    console.log("Matchmaking button clicked. Current state - isSearching:", isSearching);
    if (isSearching) {
      console.log("Attempting to cancel matchmaking...");
      cancelMatchmaking();
    } else {
      console.log("Attempting to start matchmaking...");
      const selectedCharacter = characters[currentCharacterIndex];
      startMatchmaking(selectedCharacter);
    }
  };

  // Function to get button text based on state
  const getMatchmakingButtonText = () => {
    if (isSearching) {
      return `Cancel Search (${elapsedTime}s)`;
    }
    return 'Find Match';
  };

  // Function to get button color based on state
  const getMatchmakingButtonColor = () => {
    if (isSearching) {
      return '#f44336'; // Red for cancel
    }
    return '#23b828ff'; // Green for find match
  };

  // Show store/coins page if selected
  if (storePage) {
    // Pass a callback to return to main menu UI
    return (
      <StoreNavigation
        onBackToMenu={() => {
          setStorePage(null);
          // Refresh coin balance when returning from store
          loadUserAssets();
        }}
        initialPage={storePage}
        userSession={userSession}
        onCoinsUpdate={handleCoinsUpdate}
      />
    );
  }

  return (
    <div className="new-game-menu">
      {/* Top navigation */}
      <div className="top-nav">
        <div className="dropdown-container">
          <button className="hamburger-menu" onClick={handleDropdownToggle}>
            <span></span>
            <span></span>
            <span></span>
          </button>
          {dropdownOpen && (
            <div className="dropdown-menu">
              <button className="dropdown-item">Settings</button>
              <button className="dropdown-item logout-btn" onClick={handleLogout}>Logout</button>
            </div>
          )}
        </div>

        <div className="username-display">
          {userSession?.username || 'Player'}
        </div>

        <div className="top-nav-buttons">
          <button className="coins-button" onClick={() => setStorePage('coins')}>
            <span className="coin-icon">🪙</span>
            <span className="coin-amount">{currentCoins.toLocaleString()}</span>
          </button>
          <button className="store-button" onClick={() => setStorePage('store')}>
            🛒
          </button>
        </div>
      </div>

      {/* Character carousel section */}
      <div className="character-carousel-container">
        <CharacterCarousel 
          currentCharacterIndex={currentCharacterIndex}
          setCurrentCharacterIndex={setCurrentCharacterIndex}
        />
      </div>

      {/* Bottom section with game mode selection or start button */}
      <div className="bottom-section">
        {!showGameModeSelect && !showMatchmakingButton ? (
          <button className="start-game-button" onClick={handleStartGameClick}>
            START GAME
          </button>
        ) : showGameModeSelect && !showMatchmakingButton ? (
          <div className="game-mode-selection">
            <button onClick={handleBackToMenu} className="back-to-menu-btn">
              ← Back
            </button>
            <div className="game-mode-buttons">
              <button
                onClick={handleSinglePlayerClick}
                className="game-mode-button single-player-button"
              >
                Single Player
              </button>
              <button
                onClick={handleMultiplayerClick}
                className="game-mode-button multiplayer-button"
              >
                Multiplayer
              </button>
            </div>
          </div>
        ) : (
          <div className="matchmaking-section">
            <button onClick={handleBackToMenu} className="back-to-menu-btn">
              ← Back
            </button>
            <div className="matchmaking-controls">
              <button
                onClick={handleMatchmakingToggle}
                className="matchmaking-button"
                style={{ 
                  backgroundColor: getMatchmakingButtonColor(),
                  transform: isSearching ? 'scale(0.98)' : 'scale(1)',
                  boxShadow: isSearching ? '0 2px 4px rgba(0,0,0,0.2)' : '0 4px 8px rgba(0,0,0,0.2)',
                  opacity: isSearching ? 0.9 : 1
                }}
                disabled={false}
              >
                {getMatchmakingButtonText()}
              </button>
              {isSearching && (
                <div className="matchmaking-progress">
                  <div className="progress-bar">
                    <div 
                      className="progress-fill" 
                      style={{ width: `${Math.min(100, (elapsedTime / 30) * 100)}%` }}
                    ></div>
                  </div>
                  <p className="search-status">
                    {elapsedTime < 10 ? 'Looking for players...' : 
                     elapsedTime < 20 ? 'Expanding search...' : 
                     'Searching globally...'}
                  </p>
                </div>
              )}
              {playersInMatch.length > 0 && (
                <div className="players-found">
                  <h4>Players Found:</h4>
                  <ul>
                    {playersInMatch.map((player, index) => (
                      <li key={index}>
                        {player.presence?.username || player.username || `Player ${index + 1}`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Matchmaking wrapper component
export function MatchmakingUIWrapper({ userSession, backToMenu, handleMatchFound, handleMatchmakingError, selectedCharacter }) {
  return (
    <div className="matchmaking-container">
      <button onClick={backToMenu} className="back-button">
        Back to Menu
      </button>
      <MatchmakingUI
        userSession={userSession}
        onMatchFound={handleMatchFound}
        onMatchmakingError={handleMatchmakingError}
        selectedCharacter={selectedCharacter}
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