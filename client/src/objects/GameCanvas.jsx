import React, { Suspense, useMemo, useState, useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Box, KeyboardControls, OrbitControls, Sky, useGLTF } from '@react-three/drei';
import { Physics, RigidBody } from '@react-three/rapier';
import { Dino } from './dino';
import * as THREE from "three";
import { CameraRig } from './CameraRig';
import MatchmakingSystem from './MatchmakingSystem';
import './styling/GameCanvas.css'; // Import the CSS file

const lightPos = [100, 30, 100];
const mapScale = 5.5;

export const Controls = {
  forward: "forward",
  back: "back",
  left: "left",
  right: "right",
  jump: "jump",
  sprint: "sprint"
}

// Simplified and fixed OtherPlayer component
export const OtherPlayer = ({ playerData, userSession }) => {
  const { scene: Body } = useGLTF('/dino_parts1/dino_body.glb');
  const { scene: Head } = useGLTF('/dino_parts1/dino_head.glb');
  const { scene: LeftLeg } = useGLTF('/dino_parts1/left_leg.glb');
  const { scene: armLeft } = useGLTF('/dino_parts1/left_arm.glb')
  const { scene: tail } = useGLTF('/dino_parts1/dino_tail.glb')
  const { scene: weapon } = useGLTF('/objects/game_glock.glb')
  const groupRef = useRef();

  useFrame(() => {
    if (groupRef.current && playerData) {
      // Update position - no lerping for now to make it more obvious
      if (playerData.position) {
        groupRef.current.position.set(
          playerData.position.x || 0,
          playerData.position.y || 3,
          playerData.position.z || 0
        );
      }

      // Update rotation
      if (playerData.rotation !== undefined) {
        groupRef.current.rotation.y = playerData.rotation;
      }
    }
  });

  // Simple fallback visual for debugging
  return (
    <group ref={groupRef} scale={[0.4, 0.4, 0.4]} rotation={[0, Math.PI, 0]}>
      {/* Bright debug box - make it very visible */}
      <mesh position={[0, 3, 0]}>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial
          color="red"
          emissive="red"
          emissiveIntensity={0.5}
        />
      </mesh>

      {/* Username label above the debug box */}
      <mesh position={[0, 5, 0]}>
        <boxGeometry args={[3, 0.5, 0.1]} />
        <meshStandardMaterial
          color="yellow"
          emissive="yellow"
          emissiveIntensity={0.3}
        />
      </mesh>

      {/* Dino parts with better cloning */}
      {Body && <primitive object={Body.clone(true)} position={[0, 0, 0]} />}
      {Head && <primitive object={Head.clone(true)} position={[0, 2.2, 1.3]} />}
      {LeftLeg && (
        <>
          <primitive object={LeftLeg.clone(true)} position={[1, -0.3, 0.8]} />
          <primitive object={LeftLeg.clone(true)} scale={[-1, 1, 1]} position={[-1, -0.3, 0.8]} />
        </>
      )}

      {armLeft && (
        <>
          <group position={[-1.25, 1.3, 1.3]}>
            <primitive object={armLeft.clone(true)} />
            {weapon && (
              <primitive
                object={weapon.clone(true)}
                rotation={[0, -1.5, 0]}
                scale={[0.15, 0.15, 0.15]}
                position={[-0.2, 0.5, 1]}
              />
            )}
          </group>

          <group position={[1.25, 1.3, 1.3]}>
            <primitive object={armLeft.clone(true)} scale={[-1, 1, 1]} />
            {weapon && (
              <primitive
                object={weapon.clone(true)}
                rotation={[0, -1.5, 0]}
                scale={[0.15, 0.15, 0.15]}
                position={[0.2, 0.5, 1]}
              />
            )}
          </group>
        </>
      )}

      {tail && <primitive object={tail.clone(true)} position={[0, 0, 0]} />}
    </group>
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

// Game environment (lighting, map, etc.)
const GameEnvironment = () => {
  const { scene: gameMap } = useGLTF('/objects/mapTest.glb');

  useEffect(() => {
    gameMap.traverse((child) => {
      if (child.isMesh) {
        gameMap.castShadow = true;
        gameMap.receiveShadow = true;
      }
    })
  }, [gameMap]);

  return (
    <>
      <Sky sunPosition={lightPos} mieCoefficient={0.001} rayleigh={0.2} turbidity={20} castShadow />

      <ambientLight intensity={0.8} color="#87CEEB" />
      <directionalLight
        position={lightPos}
        intensity={3}
        color={'#d1b269'}
        castShadow
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-camera-far={100}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
        shadow-bias={-0.1}
      />
      <directionalLight
        position={[-50, 20, -50]}
        intensity={1}
        color={'#b3d9ff'}
      />
      <directionalLight
        position={[0, 10, -100]}
        intensity={1.2}
        color={'#ffd700'}
      />

      <mesh position={[0, 0.75, 0]} rotation={[-Math.PI / 2, 0, 0]} >
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#0074ad" transparent opacity={0.8}
          metalness={0.1} roughness={1} envMapIntensity={0.8} />
      </mesh>

      <RigidBody
        colliders="trimesh"
        type="fixed"
        name="floor"
        interpolate={true}
        friction={0}
        restitution={0}
      >
        <primitive object={gameMap} scale={mapScale} castShadow receiveShadow={true} />
      </RigidBody>
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
      <div className="game-menu">
        <h1 className="game-title">
          Dino Game
        </h1>

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

  // Matchmaking UI
  if (gameState === 'matchmaking') {
    return (
      <div className="matchmaking-container">
        <button
          onClick={backToMenu}
          className="back-button"
        >
          Back to Menu
        </button>

        <MatchmakingSystem
          userSession={userSession}
          onMatchFound={handleMatchFound}
          onMatchmakingError={handleMatchmakingError}
        />
      </div>
    );
  }

  // Game UI
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

        <button
          onClick={backToMenu}
          className="info-back-button"
        >
          Back to Menu
        </button>
      </div>

      {/* Game Canvas */}
      <KeyboardControls map={map}>
        <Canvas shadows gl={{
          shadowMap: { enabled: true, type: THREE.UnfilteredShadowMap }
        }}>
          <Suspense fallback={null}>
            <Physics gravity={[0, -9.81, 0]} timeStep={1 / 100}>
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