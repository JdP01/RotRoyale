import React, { Suspense, useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Box, KeyboardControls, OrbitControls, Sky } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import { Dino } from '../localplayer/dino';
import * as THREE from "three";
import { CameraRig } from '../localplayer/CameraRig';
import GameEnvironment from './GameEnvironment';
import { PlayerUI } from '../../ui/PlayerUI';
import { usePlayerState } from '../../logic/PlayerState';
import RaycastVisualizer from './RaycastVisualizer';
//import './styling/GameCanvas.css'; // Import the CSS file  

export const Controls = {
  forward: "forward",
  back: "back",
  left: "left",
  right: "right",
  jump: "jump",
  sprint: "sprint",
  //shoot: "shoot"
}

export const OtherPlayer = ({ playerData, userSession }) => {
    return (
        <Dino
            ref={useRef()}
            userSession={userSession}
            isNetworkedPlayer={true}
            networkPosition={playerData.position}
            networkRotation={playerData.rotation}
            networkButtonStates={playerData.buttonStates} // Pass button states instead of animation state
        />
    );
};

// Fixed GameLogic component
const GameLogic = ({
  userSession,
  currentMatch,
  dinoRef,
  dinoRotation,
  onRotationChange,
  cameraPitch,
  onCameraPitchChange,
  isAiming,
  onAimingChange,
  otherPlayersData
}) => {
  const lastSentTime = useRef(0);
  const [localPlayerButtonStates, setLocalPlayerButtonStates] = useState({
    forward: false,
    back: false,
    left: false,
    right: false,
    jump: false,
    sprint: false
  });
  
  // Get raycast visualization state and player state functions
  const { raycastVisible, raycastStart, raycastEnd, enemyRaycastVisible, enemyRaycastStart, enemyRaycastEnd, setBroadcastCallback, takeDamage, showEnemyRaycast } = usePlayerState();

  // Set up broadcast callback for sending game events to server
  useEffect(() => {
    if (currentMatch && userSession?.socket) {
      const broadcastGameEvent = (eventData) => {
        try {
          const socket = userSession.socket;
          const matchId = currentMatch.match_id;
          const opCode = 2; // Different op code for game events vs position updates
          
          const gameEvent = {
            ...eventData,
            playerId: userSession.account.user.id,
            username: userSession.account.user.username || userSession.username || 'Unknown Player',
          };
          
          const data = JSON.stringify(gameEvent);
          
          console.log('🌐 Broadcasting game event:', gameEvent);
          
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
        } catch (error) {
          console.error("Error broadcasting game event:", error);
        }
      };
      
      setBroadcastCallback(broadcastGameEvent);
    }
    
    return () => {
      setBroadcastCallback(null);
    };
  }, [currentMatch, userSession, setBroadcastCallback]);

  // Handle hit detection for incoming raycast shots
  const handleRaycastHit = useCallback((raycastData) => {
    if (!dinoRef.current || !raycastData.startPosition || !raycastData.endPosition) return;
    
    // Show visual representation of enemy's shot
    showEnemyRaycast(raycastData.startPosition, raycastData.endPosition);
    
    // Create THREE.js Raycaster for precise mesh collision detection
    const raycaster = new THREE.Raycaster();
    
    // Set up ray from start position towards end position
    const rayStart = new THREE.Vector3(
      raycastData.startPosition.x,
      raycastData.startPosition.y,
      raycastData.startPosition.z
    );
    const rayEnd = new THREE.Vector3(
      raycastData.endPosition.x,
      raycastData.endPosition.y,
      raycastData.endPosition.z
    );
    
    const rayDirection = rayEnd.clone().sub(rayStart).normalize();
    const rayDistance = rayStart.distanceTo(rayEnd);
    
    raycaster.set(rayStart, rayDirection);
    raycaster.far = rayDistance; // Limit ray to the shot distance
    
    // Get all dino meshes - access Three.js objects properly
    const dinoMeshes = [];
    const playerPosition = dinoRef.current.translation();
    const playerPos = new THREE.Vector3(playerPosition.x, playerPosition.y, playerPosition.z);
    
    console.log(`🔍 Player position: (${playerPosition.x.toFixed(2)}, ${playerPosition.y.toFixed(2)}, ${playerPosition.z.toFixed(2)})`);
    
    // The physics body doesn't have traverse - we need to access the Three.js children directly
    // Get the Three.js object from the physics body
    const physicsBodyChildren = dinoRef.current.children || [];
    console.log(`🔍 Physics body children count: ${physicsBodyChildren.length}`);
    
    // Method 1: Search through physics body children (Three.js objects)
    physicsBodyChildren.forEach((child, index) => {
      console.log(`📦 Physics body child ${index}:`, child.type, child.name || 'unnamed');
      
      if (child.traverse) {
        child.traverse((subChild) => {
          console.log(`  📦 Sub-child:`, subChild.type, subChild.name || 'unnamed', subChild.isMesh ? 'MESH' : '');
          if (subChild.isMesh && subChild.geometry) {
            const meshWorldPosition = new THREE.Vector3();
            subChild.getWorldPosition(meshWorldPosition);
            console.log(`    📍 Mesh world position: (${meshWorldPosition.x.toFixed(2)}, ${meshWorldPosition.y.toFixed(2)}, ${meshWorldPosition.z.toFixed(2)})`);
            
            const distance = meshWorldPosition.distanceTo(playerPos);
            console.log(`    📏 Distance to player: ${distance.toFixed(2)}`);
            
            if (distance < 10) {
              dinoMeshes.push(subChild);
              console.log(`    ✅ Added mesh to hit detection array`);
            }
          }
        });
      } else if (child.isMesh && child.geometry) {
        // Direct mesh child
        const meshWorldPosition = new THREE.Vector3();
        child.getWorldPosition(meshWorldPosition);
        const distance = meshWorldPosition.distanceTo(playerPos);
        console.log(`  � Direct mesh at distance: ${distance.toFixed(2)}`);
        
        if (distance < 10) {
          dinoMeshes.push(child);
          console.log(`  ✅ Added direct mesh to hit detection array`);
        }
      }
    });
    
    console.log(`🔍 Found ${dinoMeshes.length} meshes from physics body children`);
    
    // Method 2: If still no meshes, search the scene more broadly
    if (dinoMeshes.length === 0) {
      console.log(`🔍 No meshes found in physics body, searching scene...`);
      
      // Get the scene by traversing up from the physics body
      let currentNode = dinoRef.current.parent;
      while (currentNode && currentNode.type !== 'Scene') {
        currentNode = currentNode.parent;
      }
      
      if (currentNode && currentNode.traverse) {
        console.log(`🔍 Found scene, searching for meshes near player...`);
        currentNode.traverse((child) => {
          if (child.isMesh && child.geometry) {
            const meshWorldPosition = new THREE.Vector3();
            child.getWorldPosition(meshWorldPosition);
            
            const distance = meshWorldPosition.distanceTo(playerPos);
            if (distance < 8) { // Close to player
              console.log(`🔍 Scene mesh found at distance ${distance.toFixed(2)}:`, child.name || 'unnamed', child.type);
              dinoMeshes.push(child);
            }
          }
        });
      }
      console.log(`🔍 Scene search added ${dinoMeshes.length} meshes`);
    }
    
    console.log(`🎯 Final mesh count for ray testing: ${dinoMeshes.length}`);
    
    // Test ray intersection against all found meshes
    if (dinoMeshes.length > 0) {
      console.log(`🎯 Testing raycast intersection against ${dinoMeshes.length} meshes...`);
      const intersections = raycaster.intersectObjects(dinoMeshes, true);
      
      console.log(`🎯 Raycast intersections found: ${intersections.length}`);
      
      if (intersections.length > 0) {
        const hitPoint = intersections[0].point;
        const hitDistance = rayStart.distanceTo(hitPoint);
        const hitObject = intersections[0].object;
        
        console.log(`💥 DIRECT HIT! Dino mesh hit by raycast from ${raycastData.username}!`);
        console.log(`Hit point: (${hitPoint.x.toFixed(2)}, ${hitPoint.y.toFixed(2)}, ${hitPoint.z.toFixed(2)})`);
        console.log(`Hit distance: ${hitDistance.toFixed(2)} units`);
        console.log(`Hit object:`, hitObject.name || 'unnamed mesh', hitObject.type);
        
        takeDamage(raycastData.damage || 25, `shot by ${raycastData.username}`);
        return true;
      } else {
        console.log(`🎯 Shot from ${raycastData.username} missed - no mesh intersection detected`);
        console.log(`Ray details: start(${rayStart.x.toFixed(2)}, ${rayStart.y.toFixed(2)}, ${rayStart.z.toFixed(2)}) end(${rayEnd.x.toFixed(2)}, ${rayEnd.y.toFixed(2)}, ${rayEnd.z.toFixed(2)})`);
      }
    }
    
    // Always use fallback detection since mesh detection might be unreliable
    console.log(`🎯 Using position-based fallback detection...`);
    const fallbackRadius = 1.2; // Reasonable radius for hit detection
    const rayLength = rayStart.distanceTo(rayEnd);
    const playerToRayStart = playerPos.clone().sub(rayStart);
    const projectionLength = playerToRayStart.dot(rayDirection);
    const clampedProjection = Math.max(0, Math.min(rayLength, projectionLength));
    const closestPoint = rayStart.clone().add(rayDirection.clone().multiplyScalar(clampedProjection));
    
    const distanceToRay = playerPos.distanceTo(closestPoint);
    console.log(`Fallback: distance to ray = ${distanceToRay.toFixed(2)}, threshold = ${fallbackRadius}`);
    
    if (distanceToRay <= fallbackRadius) {
      console.log(`💥 Player hit by raycast from ${raycastData.username} (fallback detection)! Distance: ${distanceToRay.toFixed(2)}`);
      takeDamage(raycastData.damage || 25, `shot by ${raycastData.username}`);
      return true;
    }
    
    console.log(`🎯 Shot from ${raycastData.username} missed - distance: ${distanceToRay.toFixed(2)}`);
    return false;
  }, [dinoRef, takeDamage, showEnemyRaycast]);

  // Set up global handler for incoming raycast events
  useEffect(() => {
    window.handleIncomingRaycast = handleRaycastHit;
    
    return () => {
      window.handleIncomingRaycast = null;
    };
  }, [handleRaycastHit]);

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
      rotation: dinoRotation,
      buttonStates: localPlayerButtonStates // Send button states instead of calculated animation state
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
        onRotationChange={onRotationChange}
        onCameraPitchChange={onCameraPitchChange}
        onAimingChange={onAimingChange}
        onButtonStatesChange={setLocalPlayerButtonStates} // Pass button states callback instead
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
        cameraPitch={cameraPitch}
        isAiming={isAiming}
        distance={6}
        height={5}
        heightOffset={1}
        stiffness={0.8}
        lookStiffness={0.9}
      />

      {/* Raycast Visualizer for player's own shots */}
      <RaycastVisualizer
        isVisible={raycastVisible}
        startPosition={raycastStart}
        endPosition={raycastEnd}
        duration={1500}
      />
      
      {/* Raycast Visualizer for enemy shots */}
      <RaycastVisualizer
        isVisible={enemyRaycastVisible}
        startPosition={enemyRaycastStart}
        endPosition={enemyRaycastEnd}
        duration={1000}
        color="orange" // Different color to distinguish enemy shots
      />
    </>
  );
};

export default function GameCanvas({ 
  userSession, 
  currentMatch, 
  connectedPlayers, 
  otherPlayersData, 
  setConnectedPlayers, 
  setOtherPlayersData, 
  backToMenu 
}) {
  const [dinoRotation, setDinoRotation] = useState(0);
  const [cameraPitch, setCameraPitch] = useState(0);
  const [isAiming, setIsAiming] = useState(false);
  const dinoRef = useRef(null);
  
  // Memoize the aiming callback to prevent unnecessary re-renders
  const handleAimingChange = useCallback((aimingState) => {
    setIsAiming(aimingState);
  }, []);
  
  // Memoize rotation callbacks to prevent unnecessary re-renders
  const handleRotationChange = useCallback((rotation) => {
    setDinoRotation(rotation);
  }, []);
  
  const handleCameraPitchChange = useCallback((pitch) => {
    setCameraPitch(pitch);
  }, []);
  
  // Get player state for respawn functionality
  const { reset: resetPlayerState } = usePlayerState();

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

        // Handle different types of game updates
        if (gameUpdate.playerId && gameUpdate.playerId !== userSession.account.user.id) {
          
          // Handle player position updates
          if (gameUpdate.type === 'player_update') {
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
                  buttonStates: gameUpdate.buttonStates || { forward: false, back: false, left: false, right: false, jump: false, sprint: false }, // Store button states instead
                  username: gameUpdate.username,
                  lastUpdate: Date.now()
                }
              };
              console.log("Updated other players state:", updated);
              return updated;
            });
          }
          
          // Handle raycast shots from other players
          else if (gameUpdate.type === 'raycast_shot') {
            console.log(`🔫 Received raycast shot from ${gameUpdate.username} (${gameUpdate.playerId})`);
            
            // Check if this raycast hits the local player
            // We'll need to access the hit detection function from GameLogic
            // For now, we'll trigger a callback that GameLogic can handle
            if (window.handleIncomingRaycast) {
              window.handleIncomingRaycast(gameUpdate);
            }
          }
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
      setCameraPitch(0);
      dinoRef.current.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
      
      // Reset player health and stamina
      resetPlayerState();
      
      console.log("Player respawned at:", spawnPosition);
    }
  };

  return (
    <div className="game-container">
      {/* Player Health/Stamina UI */}
      <PlayerUI isAiming={isAiming} />
      
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
          shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap }
        }}>
          <Suspense fallback={null}>
            <Physics gravity={[0, -9.81, 0]} timeStep={1 /300}>
              <OrbitControls />

              <GameEnvironment />

              <GameLogic
                userSession={userSession}
                currentMatch={currentMatch}
                dinoRef={dinoRef}
                dinoRotation={dinoRotation}
                onRotationChange={handleRotationChange}
                cameraPitch={cameraPitch}
                onCameraPitchChange={handleCameraPitchChange}
                isAiming={isAiming}
                onAimingChange={handleAimingChange}
                otherPlayersData={otherPlayersData}
              />

            </Physics>
          </Suspense>
        </Canvas>
      </KeyboardControls>
    </div>
  );
}