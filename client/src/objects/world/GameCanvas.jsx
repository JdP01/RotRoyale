import React, { Suspense, useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Box, KeyboardControls, OrbitControls, Sky } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import { BasicCharacter } from '../localplayer/basic';
import { SkeletonVoxy } from '../localplayer/SkeletonVoxy';
import mapData from '../mapdata/instructions/goodgame1.json';
import { createNavigationGrid, createRandomSpawnPositions } from '../mapdata/navigation';
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
  reload: "reload",
  //shoot: "shoot"
}

export const OtherPlayer = ({ playerData, userSession }) => {
    const characterType = playerData.character?.component === 'bear' ? 'bear' : 'dino';
    
    return (
        <BasicCharacter
            characterType={characterType}
            ref={useRef()}
            userSession={userSession}
            isNetworkedPlayer={true}
            networkPosition={playerData.position}
            networkRotation={playerData.rotation}
            networkButtonStates={playerData.buttonStates} // Pass button states instead of animation state
        />
    );
};

const EnemyRespawnHud = () => {
  const enemyRespawnSeconds = usePlayerState((state) => state.enemyRespawnSeconds);

  if (enemyRespawnSeconds <= 0) return null;

  return (
    <div className="enemy-respawn-hud" role="status">
      Skeleton will respawn in {enemyRespawnSeconds}
    </div>
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
  otherPlayersData,
  selectedCharacter,
  backToMenu
}) => {
  const lastSentTime = useRef(0);
  const defeatedSkeletonsRef = useRef(0);
  const isPreparingSkeletonWaveRef = useRef(false);
  const [skeletonWaveSize, setSkeletonWaveSize] = useState(1);
  const [skeletonWaveNumber, setSkeletonWaveNumber] = useState(1);
  const [isPreparingSkeletonWave, setIsPreparingSkeletonWave] = useState(false);
  const navigationGrid = useMemo(() => createNavigationGrid(mapData), []);
  const skeletonSpawnPositions = useMemo(
    () => createRandomSpawnPositions(navigationGrid, skeletonWaveSize, mapData.water.position[1] + 1.2),
    [navigationGrid, skeletonWaveNumber, skeletonWaveSize],
  );
  const [localPlayerButtonStates, setLocalPlayerButtonStates] = useState({
    forward: false,
    back: false,
    left: false,
    right: false,
    jump: false,
    sprint: false
  });
  
  // Get raycast visualization state and player state functions
  const { raycastVisible, raycastStart, raycastEnd, enemyRaycastVisible, enemyRaycastStart, enemyRaycastEnd, enemyRespawnSeconds, setBroadcastCallback, setEnemyRespawnSeconds, setLobbyKickCallback, takeDamage, showEnemyRaycast } = usePlayerState();

  const handleSkeletonDefeated = useCallback(() => {
    if (isPreparingSkeletonWaveRef.current) return;

    defeatedSkeletonsRef.current += 1;
    if (defeatedSkeletonsRef.current < skeletonWaveSize) return;

    defeatedSkeletonsRef.current = 0;
    isPreparingSkeletonWaveRef.current = true;
    setIsPreparingSkeletonWave(true);
    setEnemyRespawnSeconds(5);
  }, [setEnemyRespawnSeconds, skeletonWaveSize]);

  useEffect(() => {
    if (!isPreparingSkeletonWave) return undefined;

    if (enemyRespawnSeconds === 0) {
      setSkeletonWaveSize((size) => size * 2);
      setSkeletonWaveNumber((wave) => wave + 1);
      isPreparingSkeletonWaveRef.current = false;
      setIsPreparingSkeletonWave(false);
      return undefined;
    }

    const timer = setTimeout(() => {
      setEnemyRespawnSeconds(enemyRespawnSeconds - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [enemyRespawnSeconds, isPreparingSkeletonWave, setEnemyRespawnSeconds]);

  useEffect(() => () => setEnemyRespawnSeconds(0), [setEnemyRespawnSeconds]);

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
          
          // console.log('🌐 Broadcasting game event:', gameEvent);
          
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
    
    // Set up lobby kick callback for when player dies
    if (backToMenu) {
      const currentState = usePlayerState.getState();
      
      // Only set up callback if one doesn't already exist
      if (!currentState.lobbyKickCallback) {
        console.log("🚪 Setting up lobby kick callback");
        
        const lobbyKickHandler = (reason) => {
          console.log("🚪 Player kicked to lobby:", reason);
          
          // Return to menu/lobby immediately
          try {
            backToMenu();
            console.log("🚪 Successfully called backToMenu");
          } catch (error) {
            console.error("🚪 Error calling backToMenu:", error);
          }
        };
        
        setLobbyKickCallback(lobbyKickHandler);
      } else {
        console.log("🚪 Lobby kick callback already exists, skipping setup");
      }
    }
    
    return () => {
      // Clear callbacks
      setBroadcastCallback(null);
      setLobbyKickCallback(null);
      
      // Also clear any pending death timeouts from PlayerState
      const playerState = usePlayerState.getState();
      if (playerState.deathTimeoutId) {
        clearTimeout(playerState.deathTimeoutId);
        // Reset the timeout ID in the store
        usePlayerState.setState({ deathTimeoutId: null });
        console.log("🚪 Cleared death timeout on component unmount");
      }
    };
  }, [currentMatch, userSession, backToMenu]);

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
    
    // Get all dino meshes - properly access Three.js objects from the physics body
    const dinoMeshes = [];
    const playerPosition = dinoRef.current.translation();
    const playerPos = new THREE.Vector3(playerPosition.x, playerPosition.y, playerPosition.z);
    
    console.log(`🔍 Player position: (${playerPosition.x.toFixed(2)}, ${playerPosition.y.toFixed(2)}, ${playerPosition.z.toFixed(2)})`);
    
    // Try to get the main group reference that we attached in BasicCharacter
    const mainGroup = dinoRef.current.mainGroup;
    
    if (mainGroup) {
      console.log(`🔍 Found main group reference from physics body`);
      console.log(`🔍 Main group children count: ${mainGroup.children.length}`);
      
      // Traverse the main group to find all meshes
      mainGroup.traverse((child) => {
        if (child.isMesh && child.geometry) {
          // Get world position of the mesh
          const meshWorldPosition = new THREE.Vector3();
          child.getWorldPosition(meshWorldPosition);
          
          // Only include meshes that are reasonably close to the player position
          const distance = meshWorldPosition.distanceTo(playerPos);
          console.log(`  📦 Found mesh: ${child.name || 'unnamed'} at distance ${distance.toFixed(2)}`);
          
          if (distance < 15) { // Generous distance check
            dinoMeshes.push(child);
            console.log(`    ✅ Added mesh to hit detection array: ${child.name || 'unnamed'}`);
          }
        }
      });
    } else {
      console.log(`❌ Main group reference not found, trying fallback method...`);
      
      // Fallback: Get the Three.js object from the Rapier physics body
      const threeJSObject = dinoRef.current.object;
      
      if (threeJSObject) {
        console.log(`🔍 Found Three.js object from physics body: ${threeJSObject.type}`);
        console.log(`🔍 Three.js object children count: ${threeJSObject.children.length}`);
        
        // Traverse the Three.js object hierarchy to find all meshes
        threeJSObject.traverse((child) => {
          if (child.isMesh && child.geometry) {
            // Get world position of the mesh
            const meshWorldPosition = new THREE.Vector3();
            child.getWorldPosition(meshWorldPosition);
            
            // Only include meshes that are reasonably close to the player position
            const distance = meshWorldPosition.distanceTo(playerPos);
            console.log(`  📦 Found mesh: ${child.name || 'unnamed'} at distance ${distance.toFixed(2)}`);
            
            if (distance < 15) { // Generous distance check
              dinoMeshes.push(child);
              console.log(`    ✅ Added mesh to hit detection array: ${child.name || 'unnamed'}`);
            }
          }
        });
      } else {
        console.log(`❌ Could not access Three.js object from physics body - using scene search`);
        
        // Last resort: Search the scene for meshes near the player position
        // Get the scene by traversing up from any object
        let scene = null;
        if (threeJSObject && threeJSObject.parent) {
          let currentNode = threeJSObject.parent;
          while (currentNode && currentNode.type !== 'Scene') {
            currentNode = currentNode.parent;
          }
          scene = currentNode;
        }
        
        if (scene) {
          console.log(`🔍 Fallback: searching scene for meshes near player...`);
          scene.traverse((child) => {
            if (child.isMesh && child.geometry) {
              const meshWorldPosition = new THREE.Vector3();
              child.getWorldPosition(meshWorldPosition);
              
              const distance = meshWorldPosition.distanceTo(playerPos);
              if (distance < 8) { // Close to player
                console.log(`🔍 Scene mesh found at distance ${distance.toFixed(2)}:`, child.name || 'unnamed');
                dinoMeshes.push(child);
              }
            }
          });
        }
      }
    }
    
    console.log(`🎯 Final mesh count for ray testing: ${dinoMeshes.length}`);
    
    // Test ray intersection against all found meshes
    if (dinoMeshes.length > 0) {
      console.log(`🎯 Testing raycast intersection against ${dinoMeshes.length} meshes...`);
      
      // Update world matrices to ensure accurate intersections
      dinoMeshes.forEach(mesh => {
        mesh.updateMatrixWorld(true);
      });
      
      const intersections = raycaster.intersectObjects(dinoMeshes, false); // Don't recursively check children since we already collected all meshes
      
      console.log(`🎯 Raycast intersections found: ${intersections.length}`);
      
      if (intersections.length > 0) {
        const hitPoint = intersections[0].point;
        const hitDistance = rayStart.distanceTo(hitPoint);
        const hitObject = intersections[0].object;
        
        console.log(`🎯 HIT DETECTION: MESH INTERSECTION SUCCESS from ${raycastData.username}`);
        console.log(`   └─ Hit object: ${hitObject.name || 'unnamed mesh'} (${hitObject.type})`);
        console.log(`   └─ Hit point: (${hitPoint.x.toFixed(2)}, ${hitPoint.y.toFixed(2)}, ${hitPoint.z.toFixed(2)})`);
        console.log(`   └─ Hit distance: ${hitDistance.toFixed(2)}`);
        
        takeDamage(raycastData.damage || 25, `shot by ${raycastData.username}`);
        return true;
      } else {
        console.log(`🎯 HIT DETECTION: Shot from ${raycastData.username} missed - no mesh intersection detected`);
        console.log(`   └─ Ray: start(${rayStart.x.toFixed(2)}, ${rayStart.y.toFixed(2)}, ${rayStart.z.toFixed(2)}) end(${rayEnd.x.toFixed(2)}, ${rayEnd.y.toFixed(2)}, ${rayEnd.z.toFixed(2)})`);
        console.log(`   └─ Ray direction: (${rayDirection.x.toFixed(2)}, ${rayDirection.y.toFixed(2)}, ${rayDirection.z.toFixed(2)})`);
        console.log(`   └─ Ray distance: ${rayDistance.toFixed(2)}`);
        
        // Log details about each mesh for debugging
        dinoMeshes.forEach((mesh, index) => {
          const meshWorldPos = new THREE.Vector3();
          mesh.getWorldPosition(meshWorldPos);
          console.log(`   └─ Mesh ${index}: ${mesh.name || 'unnamed'} at (${meshWorldPos.x.toFixed(2)}, ${meshWorldPos.y.toFixed(2)}, ${meshWorldPos.z.toFixed(2)})`);
        });
      }
    } else {
      console.log(`❌ No meshes found for hit detection - this should not happen!`);
    }
    
    // Only use fallback detection if we couldn't find any meshes at all
    if (dinoMeshes.length === 0) {
      console.log(`🎯 Using position-based fallback detection (no meshes found)...`);
      const fallbackRadius = 1.2; // Reasonable radius for hit detection
      const rayLength = rayStart.distanceTo(rayEnd);
      const playerToRayStart = playerPos.clone().sub(rayStart);
      const projectionLength = playerToRayStart.dot(rayDirection);
      const clampedProjection = Math.max(0, Math.min(rayLength, projectionLength));
      const closestPoint = rayStart.clone().add(rayDirection.clone().multiplyScalar(clampedProjection));
      
      const distanceToRay = playerPos.distanceTo(closestPoint);
      console.log(`   └─ Fallback: distance to ray = ${distanceToRay.toFixed(2)}, threshold = ${fallbackRadius}`);
      
      if (distanceToRay <= fallbackRadius) {
        console.log(`🎯 HIT DETECTION: FALLBACK POSITION-BASED SUCCESS from ${raycastData.username}`);
        console.log(`   └─ Distance to ray: ${distanceToRay.toFixed(2)} (threshold: ${fallbackRadius})`);
        console.log(`   └─ Meshes found: ${dinoMeshes.length}, Intersections: 0`);
        
        takeDamage(raycastData.damage || 25, `shot by ${raycastData.username}`);
        return true;
      }
    }
    
    console.log(`🎯 Shot from ${raycastData.username} missed completely`);
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
      buttonStates: localPlayerButtonStates, // Send button states instead of calculated animation state
      character: selectedCharacter // Include character information
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
      <BasicCharacter
        characterType={selectedCharacter?.component === 'bear' ? 'bear' : 'dino'}
        ref={dinoRef}
        onRotationChange={onRotationChange}
        onCameraPitchChange={onCameraPitchChange}
        onAimingChange={onAimingChange}
        onButtonStatesChange={setLocalPlayerButtonStates}
        castShadow
        userSession={userSession}
        currentMatch={currentMatch}
      />

      {!currentMatch && !isPreparingSkeletonWave && Array.from({ length: skeletonWaveSize }, (_, index) => (
        <SkeletonVoxy
          key={`skeleton-wave-${skeletonWaveNumber}-${index}`}
          targetRef={dinoRef}
          takeDamage={takeDamage}
          onDefeated={handleSkeletonDefeated}
          navigationGrid={navigationGrid}
          position={skeletonSpawnPositions[index]}
        />
      ))}

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
  backToMenu,
  selectedCharacter
}) {
  const [dinoRotation, setDinoRotation] = useState(0);
  const [cameraPitch, setCameraPitch] = useState(0);
  const [isAiming, setIsAiming] = useState(false);
  const dinoRef = useRef(null);
  const hasKickedRef = useRef(false);
  const [livePlayerCount, setLivePlayerCount] = useState(null);
  
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

  // Reset player state when GameCanvas first loads (new game start)
  useEffect(() => {
    console.log("🎮 GameCanvas mounted - resetting player state for new game");
    resetPlayerState();
    hasKickedRef.current = false;
  }, []); // Empty dependency array means this runs once when component mounts

  // Enhanced socket event handling
  useEffect(() => { //Listens actively for changes in userSession, only runs when userSession changes
    if (!userSession?.socket) return;

    const socket = userSession.socket;

    //Listener for real-time data updates for other players
    socket.onmatchdata = (matchData) => {
      console.log("🔍 Received raw match data:", matchData);
      console.log("🔍 Data type:", matchData.data?.constructor?.name);

      // Handle authoritative server snapshot opcode (be defensive about property name).
      const opCode = (typeof matchData.opCode === 'number') ? matchData.opCode
        : (typeof matchData.opcode === 'number') ? matchData.opcode
        : (typeof matchData.op_code === 'number') ? matchData.op_code
        : null;

      console.log("🔍 Detected opCode:", opCode);

      if (opCode === 150) { // OpServerSnapshot
        console.log("🎯 Processing server snapshot (opcode 150)");
        try {
          let decoded;
          if (matchData.data instanceof Uint8Array) {
            decoded = new TextDecoder().decode(matchData.data);
            console.log("🔍 Decoded from Uint8Array:", decoded);
          } else if (typeof matchData.data === 'string') {
            decoded = matchData.data;
            console.log("🔍 Data is already string:", decoded);
          } else if (matchData.data && typeof matchData.data === 'object') {
            console.log("🔍 Data is already object/array:", matchData.data);
            // Already an object/array
            const me = Array.isArray(matchData.data) ? matchData.data.find(p => p.u === userSession?.account?.user?.id) : null;
            console.log("🔍 Found my player in snapshot:", me);
            console.log("🔍 My user ID:", userSession?.account?.user?.id);
            
            if (me) {
              console.log("🔍 Server says my alive status:", me.a, "health:", me.hp);
              
              if (hasKickedRef.current === false && me.a === false) {
                console.log("💀 Server confirms I'm dead; kicking to lobby.");
                hasKickedRef.current = true;
                try { backToMenu(); } catch (e) { console.error(e); }
              } else if (me.a === true) {
                console.log("✅ Server confirms I'm alive - resetting local state if needed");
                // Server approved respawn or player is alive - reset UI if dead locally
                const currentState = usePlayerState.getState();
                if (currentState.isDead || currentState.health <= 0) {
                  console.log("🔄 Resetting player state based on server confirmation");
                  resetPlayerState();
                  // Reset physics position to match server
                  if (dinoRef.current && me.x !== undefined && me.y !== undefined) {
                    const serverPos = { x: me.x, y: me.y, z: me.z || 0 };
                    dinoRef.current.setTranslation(serverPos, true);
                    dinoRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
                    dinoRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
                    setDinoRotation(0);
                    setCameraPitch(0);
                    dinoRef.current.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
                    console.log("✅ Player state reset to server position:", serverPos);
                  }
                }
              }
            }
            return;
          }

          const snapshot = JSON.parse(decoded || '[]'); // [{u,x,y,z?,hp,a}]
          console.log("🔍 Parsed snapshot:", snapshot);
          const me = Array.isArray(snapshot) ? snapshot.find(p => p.u === userSession?.account?.user?.id) : null;
          console.log("🔍 Found my player in snapshot:", me);
          console.log("🔍 My user ID:", userSession?.account?.user?.id);
          
          if (me) {
            console.log("🔍 Server says my alive status:", me.a, "health:", me.hp);
            
            if (hasKickedRef.current === false && me.a === false) {
              console.log("💀 Server confirms I'm dead; kicking to lobby.");
              hasKickedRef.current = true;
              try { backToMenu(); } catch (e) { console.error(e); }
            } else if (me.a === true) {
              console.log("✅ Server confirms I'm alive - resetting local state if needed");
              // Server approved respawn or player is alive - reset UI if dead locally
              const currentState = usePlayerState.getState();
              if (currentState.isDead || currentState.health <= 0) {
                console.log("🔄 Resetting player state based on server confirmation");
                resetPlayerState();
                // Reset physics position to match server
                if (dinoRef.current && me.x !== undefined && me.y !== undefined) {
                  const serverPos = { x: me.x, y: me.y, z: me.z || 0 };
                  dinoRef.current.setTranslation(serverPos, true);
                  dinoRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
                  dinoRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
                  setDinoRotation(0);
                  setCameraPitch(0);
                  dinoRef.current.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
                  console.log("✅ Player state reset to server position:", serverPos);
                }
              }
            }
          }
        } catch (e) {
          console.error("❌ Error handling server snapshot:", e);
        }
        return; // Do not process further as generic game update
      }

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
              rotation: gameUpdate.rotation,
              character: gameUpdate.character,
            });

            setOtherPlayersData(prev => {
              const updated = {
                ...prev,
                [gameUpdate.playerId]: {
                  position: gameUpdate.position,
                  rotation: gameUpdate.rotation,
                  buttonStates: gameUpdate.buttonStates || { forward: false, back: false, left: false, right: false, jump: false, sprint: false }, // Store button states instead
                  username: gameUpdate.username,
                  character: gameUpdate.character,
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

  // Poll accurate player count from backend via RPC. Falls back to connectedPlayers.length.
  useEffect(() => {
    if (!userSession?.client || !userSession?.session || !currentMatch?.match_id) {
      setLivePlayerCount(null);
      return;
    }
    let cancelled = false;
    const fetchCount = async () => {
      try {
        const payload = JSON.stringify({ match_id: currentMatch.match_id });
        const resp = await userSession.client.rpc(userSession.session, "get_players_connected", payload);
        const data = typeof resp.payload === 'string' ? JSON.parse(resp.payload) : resp.payload;
        if (!cancelled && typeof data?.players === 'number') {
          setLivePlayerCount(data.players);
        }
      } catch (e) {
        console.warn("get_players_connected RPC failed; using local count", e);
        if (!cancelled) setLivePlayerCount(null);
      }
    };
    // Fetch immediately and then every 3s.
    fetchCount();
    const t = setInterval(fetchCount, 3000);
    return () => { cancelled = true; clearInterval(t); };
  }, [userSession?.client, userSession?.session, currentMatch?.match_id]);

  const map = useMemo(() => [ //map for KeyboardControls
    { name: Controls.forward, keys: ["KeyW"] },
    { name: Controls.back, keys: ["KeyS"] },
    { name: Controls.left, keys: ["KeyA"] },
    { name: Controls.right, keys: ["KeyD"] },
    { name: Controls.jump, keys: ["Space"] },
    { name: Controls.sprint, keys: ["Shift"] },
    { name: Controls.reload, keys: ["KeyR"] },
    
  ], []);

  return (
    <div className="game-container">
      {/* Player Health/Stamina UI */}
      <PlayerUI isAiming={isAiming} />
      <EnemyRespawnHud />
      
      {/* Enhanced Game Info Overlay */}
      <div className="game-info-overlay">
        <p><strong>Game Mode:</strong> {currentMatch ? 'Multiplayer' : 'Single Player'}</p>
        {currentMatch && (
          <>
            <p><strong>Match ID:</strong> {currentMatch.match_id?.substring(0, 8)}...</p>
            <p><strong>Players Connected:</strong> {livePlayerCount ?? (1 + Object.keys(otherPlayersData).length)}</p>
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
            <Physics gravity={[0, -9.81, 0]} timeStep={1 /300} debug = {false}>
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
                selectedCharacter={selectedCharacter}
                backToMenu={backToMenu}
              />

            </Physics>
          </Suspense>
        </Canvas>
      </KeyboardControls>
    </div>
  );
}