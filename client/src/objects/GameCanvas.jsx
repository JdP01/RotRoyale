import React, { Suspense, useMemo, useState, useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Box, KeyboardControls, OrbitControls, Sky } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import { Dino } from './dino';
import * as THREE from "three";
import { CameraRig } from './CameraRig';
import MatchmakingUI from './MatchmakingUI';
import GameEnvironment from './GameEnvironment';
import {MenuUI} from './GameUI';
import './styling/GameCanvas.css'; // Import the CSS fileI  

export const Controls = {
  forward: "forward",
  back: "back",
  left: "left",
  right: "right",
  jump: "jump",
  sprint: "sprint"
}

export const OtherPlayer = ({ playerData, userSession }) => {
    return (
        <Dino
            ref={useRef()}
            userSession={userSession}
            isNetworkedPlayer={true}
            networkPosition={playerData.position}
            networkRotation={playerData.rotation + (Math.PI)} // Adjust rotation to match dino's facing direction
            networkAnimationState={{
                isMoving: playerData.position ? true : false,
                isSprinting: false,
                isJumping: false
            }}
        />
    );
};

// Fixed GameLogic component
const GameLogic = ({
  userSession,
  currentMatch,
  dinoRef,
  dinoRotation,
  setDinoRotation,
  otherPlayersData
}) => {
  const lastSentTime = useRef(0);

  // Send player position updates
  useFrame(() => {
    if (!currentMatch || !userSession?.socket || !dinoRef.current) return;

    const now = Date.now();
    if (now - lastSentTime.current < 100) return;

    const position = dinoRef.current.translation();

    const playerUpdate = {
      type: 'player_update',
      playerId: userSession.account.user.id,
      username: userSession.account.user.username || userSession.username || 'Unknown Player',
      position: {
        x: position.x,
        y: position.y,
        z: position.z
      },
      rotation: dinoRotation
    };

    try {
      const socket = userSession.socket;
      const matchId = currentMatch.match_id;
      const opCode = 1;
      const data = JSON.stringify(playerUpdate);

      if (typeof socket.sendMatchData === 'function') {
        socket.sendMatchData(matchId, opCode, data);
      } else if (typeof socket.sendMatchState === 'function') {
        socket.sendMatchState(matchId, opCode, data);
      } else if (typeof socket.sendData === 'function') {
        socket.sendData(matchId, opCode, data);
      } else if (typeof socket.send === 'function') {
        socket.send({
          match_data_send: {
            match_id: matchId,
            op_code: opCode,
            data: data
          }
        });
      }

      lastSentTime.current = now;
    } catch (error) {
      console.error("Error sending match data:", error);
    }
  });

  return (
    <>
      {/* Main player */}
      <Dino
        ref={dinoRef}
        onRotationChange={setDinoRotation}
        castShadow
        userSession={userSession}
        currentMatch={currentMatch}
      />

      {/* Other players - simplified rendering */}
      {Object.entries(otherPlayersData).map(([playerId, playerData]) => {
        console.log(`Rendering other player: ${playerId}`, playerData);
        return (
          <OtherPlayer
            key={playerId}
            playerData={playerData}
            userSession={userSession}
          />
        );
      })}

      <CameraRig
        targetRef={dinoRef}
        characterRotation={dinoRotation}
        distance={8}
        height={3.5}
        heightOffset={0.5}
        stiffness={0.1}
        lookStiffness={0.12}
      />
    </>
  );
};

export default function GameCanvas({ userSession }) {
  const [gameState, setGameState] = useState('menu');
  const [currentMatch, setCurrentMatch] = useState(null);
  const [connectedPlayers, setConnectedPlayers] = useState([]);
  const [otherPlayersData, setOtherPlayersData] = useState({});
  const [dinoRotation, setDinoRotation] = useState(0);
  const dinoRef = useRef(null);

  // Enhanced socket event handling
  useEffect(() => { //Listens actively for changes in userSession, only runs when userSession changes
    if (!userSession?.socket) return;

    const socket = userSession.socket;

    //Listener for real-time data updates for other players
    socket.onmatchdata = (matchData) => {
      console.log("Received raw match data:", matchData);
      console.log("Data type:", matchData.data?.constructor?.name);

      try {
        let gameUpdate;
        
        // Handle Uint8Array data
        if (matchData.data instanceof Uint8Array) {
          console.log("Converting Uint8Array to string...");
          const decoder = new TextDecoder();
          const dataString = decoder.decode(matchData.data);
          console.log("Decoded string:", dataString);
          gameUpdate = JSON.parse(dataString);
        } 
        // Handle string data
        else if (typeof matchData.data === 'string') {
          console.log("Parsing string data...");
          gameUpdate = JSON.parse(matchData.data);
        } 
        // Handle object data
        else if (matchData.data && typeof matchData.data === 'object') {
          console.log("Using object data directly...");
          gameUpdate = matchData.data;
        } 
        else {
          throw new Error(`Unexpected match data format: ${typeof matchData.data}`);
        }

        console.log("Parsed game update:", gameUpdate);

        // Only update if it's from another player and has valid data
        if (gameUpdate.type === 'player_update' && 
            gameUpdate.playerId && 
            gameUpdate.playerId !== userSession.account.user.id) {
          
          console.log(`Updating player ${gameUpdate.playerId} (${gameUpdate.username}):`, {
            position: gameUpdate.position,
            rotation: gameUpdate.rotation
          });

          setOtherPlayersData(prev => {
            const updated = {
              ...prev,
              [gameUpdate.playerId]: {
                position: gameUpdate.position,
                rotation: gameUpdate.rotation,
                username: gameUpdate.username,
                lastUpdate: Date.now()
              }
            };
            console.log("Updated other players state:", updated);
            return updated;
          });
        }
      } catch (error) {
        console.error("Error processing match data:", error);
        console.error("Problematic data:", matchData);
      }
    };

    //Listener for match presence updates (when players joins/leaves)
    socket.onmatchpresence = (matchPresence) => {
      console.log("Match presence update received:", matchPresence);

      const joinedPlayers = matchPresence.joins || [];
      const leftPlayers = matchPresence.leaves || [];

      // Handle joined players
      joinedPlayers.forEach(player => {
        console.log(`Player joined: ${player.username || 'Unknown'} (ID: ${player.user_id})`);
        console.log('Player metadata:', player);
      });

      // Handle left players
      leftPlayers.forEach(player => {
        console.log(`Player left: ${player.username || 'Unknown'} (ID: ${player.user_id})`);
      });

      setConnectedPlayers(prev => {
        let updated = [...prev];

        // Add new players
        joinedPlayers.forEach(player => {
          if (!updated.find(p => p.user_id === player.user_id)) {
            console.log(`Adding player to connected list: ${player.username} (${player.user_id})`);
            updated.push(player);
          }
        });

        // Remove left players
        leftPlayers.forEach(player => {
          console.log(`Removing player from connected list: ${player.username} (${player.user_id})`);
          updated = updated.filter(p => p.user_id !== player.user_id);

          // Also clean up their game state
          setOtherPlayersData(prev => {
            const newData = { ...prev };
            if (newData[player.user_id]) {
              console.log(`Cleaning up game state for player: ${player.user_id}`);
              delete newData[player.user_id];
            }
            return newData;
          });
        });

        console.log("Updated connected players list:", updated);
        return updated;
      });
    };

    return () => {
      socket.onmatchdata = null;
      socket.onmatchpresence = null;
    };
  }, [userSession]);

  const map = useMemo(() => [ //map for KeyboardControls
    { name: Controls.forward, keys: ["KeyW"] },
    { name: Controls.back, keys: ["KeyS"] },
    { name: Controls.left, keys: ["KeyA"] },
    { name: Controls.right, keys: ["KeyD"] },
    { name: Controls.jump, keys: ["Space"] },
    { name: Controls.sprint, keys: ["Shift"] },
  ], []);

  const handleMatchFound = async (matchData) => { // 
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
  }; //end handleMatchFound

  const handleMatchmakingError = (error) => {
    console.error("Matchmaking error:", error);
    alert(`Matchmaking failed: ${error}`);
  };

  const startSinglePlayer = () => { //Change Gamestate
    setGameState('playing');
  };
  const startMultiplayer = () => { //Change Gamestate
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

  // Menu UI
  if (gameState === 'menu') {
    return (
      <MenuUI
      startSinglePlayer={startSinglePlayer}
      startMultiplayer={startMultiplayer}
    />
    );
  }

  // Matchmaking UI
  if (gameState === 'matchmaking') {
    return (
      <MatchmakingUI
        userSession={userSession}
        onMatchFound={handleMatchFound}
        onMatchmakingError={handleMatchmakingError}
      />
    );
  }
const handleRespawn = () => {
  if (dinoRef.current) {
    // Reset position to origin (0, 0, 0) or whatever your spawn point is
    const spawnPosition = { x: 0, y: 5, z: 0 }; // Adjust Y value based on your ground level
    // Set the position using Rapier physics body
    dinoRef.current.setTranslation(spawnPosition, true);
    // Reset velocity to stop any momentum
    dinoRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
    dinoRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
    // Reset rotation
    setDinoRotation(0);
    dinoRef.current.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    
    console.log("Player respawned at:", spawnPosition);
  }
};

return (
  <div className="game-container">
    {/* Enhanced Game Info Overlay */}
    <div className="game-info-overlay">
      <p><strong>Game Mode:</strong> {currentMatch ? 'Multiplayer' : 'Single Player'}</p>
      {currentMatch && (
        <>
          <p><strong>Match ID:</strong> {currentMatch.match_id?.substring(0, 8)}...</p>
          <p><strong>Players Connected:</strong> {connectedPlayers.length}</p>
          <p><strong>Other Players Visible:</strong> <span style={{ color: Object.keys(otherPlayersData).length > 0 ? '#4CAF50' : '#f44336' }}>{Object.keys(otherPlayersData).length}</span></p>
          <p><strong>My Player ID:</strong> {userSession?.account?.user?.id?.substring(0, 8)}...</p>

          {Object.keys(otherPlayersData).length > 0 && (
            <div className="other-players-summary">
              <p><strong>Other Players:</strong></p>
              {Object.entries(otherPlayersData).map(([playerId, data]) => (
                <div key={playerId} className="other-player-item">
                  • {data.username || playerId.substring(0, 8)}...
                  <br />
                  &nbsp;&nbsp;Pos: ({data.position?.x?.toFixed(1)}, {data.position?.y?.toFixed(1)}, {data.position?.z?.toFixed(1)})
                  <br />
                  &nbsp;&nbsp;Last: {Math.floor((Date.now() - data.lastUpdate) / 1000)}s ago
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div className="button-group">
        <button
          onClick={handleRespawn}
          className="info-respawn-button"
        >
          Respawn
        </button>
        <button
          onClick={backToMenu}
          className="info-back-button"
        >
          Back to Menu
        </button>
      </div>
    </div>

    {/* Game Canvas */}
    <KeyboardControls map={map}>
      <Canvas shadows gl={{
        shadowMap: { enabled: true, type: THREE.UnfiltedShadowMap }
      }}>
        <Suspense fallback={null}>
          <Physics gravity={[0, -9.81, 0]} timeStep={1 / 100} debug>
            <OrbitControls />

            <GameEnvironment />

            <GameLogic
              userSession={userSession}
              currentMatch={currentMatch}
              dinoRef={dinoRef}
              dinoRotation={dinoRotation}
              setDinoRotation={setDinoRotation}
              otherPlayersData={otherPlayersData}
            />

          </Physics>
        </Suspense>
      </Canvas>
    </KeyboardControls>
  </div>
);
}