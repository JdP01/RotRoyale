import React from 'react';
import { Sky } from '@react-three/drei';
import BeachMap from '../mapdata/maps/beachmap.jsx';

const lightPos = [100, 5, 100];

const GameEnvironment = () => {
  return (
    <>
      {/* Sky and lighting setup */}
      <Sky sunPosition={lightPos} mieCoefficient={0.001} rayleigh={1.2} turbidity={20} castShadow />

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
        position={[0, 20, -100]}
        intensity={1.2}
        color={'#ffd700'}
      />

      {/* Load the complete beach map with instanced props */}
      <BeachMap />
    </>
  );
};

export default GameEnvironment;
