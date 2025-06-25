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

export const Controls = {
  forward: "forward",
  back: "back",
  left: "left",
  right: "right",
  jump: "jump",
  sprint: "sprint"
};

// Component to render other players in the game
const OtherPlayer = ({ playerData, userSession }) => {
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

// Main game logic component handling player movement and updates
const GameLogic = ({
  userSession,
  currentMatch,
  dinoRef,
  dinoRotation,
  setDinoRotation,
  otherPlayersData,
  setOtherPlayersData
}) => {
  const lastSentTime = useRef(0);

  // Send player position updates to other players
  useFrame(() => {
    if (!currentMatch || !userSession?.socket || !dinoRef.current) return;

    const now = Date.now();
    if (now - lastSentTime.current < 100) return; // Throttle updates to every 100ms

    const position = dinoRef.current.translation();

    // Create player update packet
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
      // Send update to other players through the socket
      userSession.socket.sendMatchState(currentMatch.match_id, {
        data: playerUpdate
      });
      lastSentTime.current = now;
    } catch (error) {
      console.error("Error sending player update:", error);
    }
  });

  return (
    <>
      {/* Main player dino */}
      <Dino
        ref={dinoRef}
        onRotationChange={setDinoRotation}
        castShadow
        userSession={userSession}
        currentMatch={currentMatch}
      />

      {/* Render other players */}
      {Object.entries(otherPlayersData).map(([playerId, playerData]) => (
        <OtherPlayer
          key={playerId}
          playerData={playerData}
          userSession={userSession}
        />
      ))}

      {/* Camera following the player */}
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

// Main game canvas component
export default function GameCanvas({ 
  userSession, 
  currentMatch, 
  otherPlayersData, 
  setOtherPlayersData 
}) {
  const [dinoRotation, setDinoRotation] = useState(0);
  const dinoRef = useRef(null);

  // Function to handle player respawn
  const handleRespawn = () => {
    if (dinoRef.current) {
      // Reset position to slightly above ground to prevent falling through
      dinoRef.current.setTranslation({ x: 0, y: 5, z: 0 });
      // Reset rotation to default
      setDinoRotation(0);
      // Reset velocity if the physics body is available
      if (dinoRef.current.setLinvel) {
        dinoRef.current.setLinvel({ x: 0, y: 0, z: 0 });
      }
      if (dinoRef.current.setAngvel) {
        dinoRef.current.setAngvel({ x: 0, y: 0, z: 0 });
      }
    }
  };

  // Keyboard control mappings
  const map = useMemo(() => [
    { name: Controls.forward, keys: ["KeyW"] },
    { name: Controls.back, keys: ["KeyS"] },
    { name: Controls.left, keys: ["KeyA"] },
    { name: Controls.right, keys: ["KeyD"] },
    { name: Controls.jump, keys: ["Space"] },
    { name: Controls.sprint, keys: ["Shift"] },
  ], []);

  // Expose respawn function to parent
  useEffect(() => {
    if (window.gameActions) {
      window.gameActions.respawn = handleRespawn;
    } else {
      window.gameActions = { respawn: handleRespawn };
    }
    return () => {
      if (window.gameActions) {
        window.gameActions.respawn = null;
      }
    };
  }, []);

  return (
    <KeyboardControls map={map}>
      <Canvas shadows gl={{
        shadowMap: { enabled: true, type: THREE.UnfiltedShadowMap }
      }}>
        <Suspense fallback={null}>
          <Physics gravity={[0, -9.81, 0]} timeStep={1 / 100} debug>
            <OrbitControls />
            
            {/* Game world environment */}
            <GameEnvironment />

            {/* Game logic handling player movement and multiplayer */}
            <GameLogic
              userSession={userSession}
              currentMatch={currentMatch}
              dinoRef={dinoRef}
              dinoRotation={dinoRotation}
              setDinoRotation={setDinoRotation}
              otherPlayersData={otherPlayersData}
              setOtherPlayersData={setOtherPlayersData}
            />
          </Physics>
        </Suspense>
      </Canvas>
    </KeyboardControls>
  );
}