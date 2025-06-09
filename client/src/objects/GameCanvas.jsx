import React, { Suspense, useMemo, useState, useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Box, KeyboardControls, OrbitControls, Sky, useGLTF } from '@react-three/drei';
import { Physics, RigidBody } from '@react-three/rapier';
import { Dino } from './dino';
import * as THREE from "three";
import { CameraRig } from './CameraRig';
import MatchmakingSystem from './MatchmakingSystem';

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

export default function GameCanvas({ userSession }) {
  const { scene: gameMap } = useGLTF('/objects/mapTest.glb');
  const [gameState, setGameState] = useState('menu'); // 'menu', 'matchmaking', 'playing'
  const [currentMatch, setCurrentMatch] = useState(null);
  const [connectedPlayers, setConnectedPlayers] = useState([]);

  useEffect(() => {
    gameMap.traverse((child) => {
      if (child.isMesh) {
        gameMap.castShadow = true;
        gameMap.receiveShadow = true;
      }
    })
  }, [gameMap]);

  useEffect(() => {
    if (!userSession?.socket) return;

    const socket = userSession.socket;

    // Listen for real-time match updates
    socket.onmatchdata = (matchData) => {
      console.log("Received match data:", matchData);
      // Handle real-time game state updates here
      
      try {
        const gameUpdate = JSON.parse(matchData.data);
        // Update game state based on received data
        console.log("Game update:", gameUpdate);
      } catch (error) {
        console.error("Error parsing match data:", error);
      }
    };

    socket.onmatchpresence = (matchPresence) => {
      console.log("Match presence update:", matchPresence);
      
      // Update connected players list
      const currentPlayers = matchPresence.joins || [];
      const leftPlayers = matchPresence.leaves || [];
      
      setConnectedPlayers(prev => {
        let updated = [...prev];
        
        // Add new players
        currentPlayers.forEach(player => {
          if (!updated.find(p => p.user_id === player.user_id)) {
            updated.push(player);
          }
        });
        
        // Remove disconnected players
        leftPlayers.forEach(player => {
          updated = updated.filter(p => p.user_id !== player.user_id);
        });
        
        return updated;
      });
    };

    return () => {
      socket.onmatchdata = null;
      socket.onmatchpresence = null;
    };
  }, [userSession]);

  const dinoRef = useRef(null);
  const [dinoRotation, setDinoRotation] = useState(0);

  const map = useMemo(() => [
    { name: Controls.forward, keys: ["KeyW"] },
    { name: Controls.back, keys: ["KeyS"] },
    { name: Controls.left, keys: ["KeyA"] },
    { name: Controls.right, keys: ["KeyD"] },
    { name: Controls.jump, keys: ["Space"] },
    { name: Controls.sprint, keys: ["Shift"] },
  ], []);

  const handleMatchFound = async (matchData) => {
    console.log("Match found, setting up game:", matchData);
    setCurrentMatch(matchData);
    setGameState('playing');

    // Join the match
    try {
      await userSession.socket.joinMatch(matchData.match_id);
      console.log("Successfully joined match:", matchData.match_id);
    } catch (error) {
      console.error("Error joining match:", error);
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
    setGameState('menu');
    setCurrentMatch(null);
    setConnectedPlayers([]);
  };

  // Menu UI
  if (gameState === 'menu') {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white'
      }}>
        <h1 style={{ fontSize: '48px', marginBottom: '50px', textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>
          Dino Game
        </h1>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <button 
            onClick={startSinglePlayer}
            style={{
              background: '#4CAF50',
              color: 'white',
              border: 'none',
              padding: '20px 40px',
              fontSize: '18px',
              borderRadius: '10px',
              cursor: 'pointer',
              boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
            }}
          >
            Single Player
          </button>
          
          <button 
            onClick={startMultiplayer}
            style={{
              background: '#2196F3',
              color: 'white',
              border: 'none',
              padding: '20px 40px',
              fontSize: '18px',
              borderRadius: '10px',
              cursor: 'pointer',
              boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
            }}
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
      <div style={{
        width: '100vw',
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        position: 'relative'
      }}>
        <button 
          onClick={backToMenu}
          style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            background: '#666',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '5px',
            cursor: 'pointer',
            zIndex: 1001
          }}
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
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      {/* Game Info Overlay */}
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        background: 'rgba(0,0,0,0.7)',
        color: 'white',
        padding: '10px',
        borderRadius: '5px',
        zIndex: 1000,
        fontSize: '14px'
      }}>
        <p>Game Mode: {currentMatch ? 'Multiplayer' : 'Single Player'}</p>
        {currentMatch && (
          <>
            <p>Match ID: {currentMatch.match_id}</p>
            <p>Players: {connectedPlayers.length}</p>
          </>
        )}
        <button 
          onClick={backToMenu}
          style={{
            background: '#666',
            color: 'white',
            border: 'none',
            padding: '5px 10px',
            borderRadius: '3px',
            cursor: 'pointer',
            marginTop: '5px'
          }}
        >
          Back to Menu
        </button>
      </div>

      {/* Game Canvas */}
      <KeyboardControls map={map}>
        <Canvas shadows gl={{ 
          shadowMap: { enabled: true, type: THREE.UnfilteredShadowMap } 
        }}>
          <Sky sunPosition={lightPos} mieCoefficient={0.001} rayleigh={0.2} turbidity={20} castShadow/>
          <Suspense fallback={null}>
            
            <ambientLight intensity={0.8} color="#87CEEB"/>
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
              position={[-50,20, -50]} 
              intensity={1} 
              color={'#b3d9ff'} 
            />
            <directionalLight 
              position={[0, 10, -100]} 
              intensity={1.2} 
              color={'#ffd700'} 
            />

            <Physics gravity={[0, -9.81, 0]} timeStep={1/100}>
              <OrbitControls />

              <Dino ref={dinoRef} onRotationChange={setDinoRotation} castShadow userSession={userSession} currentMatch={currentMatch}/>
              <CameraRig
                targetRef={dinoRef}
                characterRotation={dinoRotation}
                distance={8}
                height={3.5}
                heightOffset={0.5}
                stiffness={0.1}
                lookStiffness={0.12}
              />
              
              <mesh position={[0,0.75,0]} rotation={[-Math.PI / 2, 0, 0]} >
                <planeGeometry args={[100, 100]} />
                <meshStandardMaterial color="#0074ad" transparent opacity={0.8} 
                metalness={0.1} roughness={1} envMapIntensity={0.8}/>
              </mesh>

              <RigidBody 
                colliders="trimesh" 
                type="fixed"
                name="floor" 
                interpolate={true} 
                friction={0} 
                restitution={0}
              >
                <primitive object={gameMap} scale={mapScale} castShadow receiveShadow={true}/>
              </RigidBody>
              
            </Physics>
          </Suspense>
        </Canvas>
      </KeyboardControls>
    </div>
  );
}