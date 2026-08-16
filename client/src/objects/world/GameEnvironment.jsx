import React from "react";
import { Sky } from "@react-three/drei";
import BeachMap from "../mapdata/maps/colliderInstancing.jsx";

const lightPos = [10, 1, 100];

const GameEnvironment = () => {
  return (
    <>
      {/* Sky and lighting setup */}
      <Sky sunPosition={lightPos} mieCoefficient={0.0001} rayleigh={2} turbidity={100} castShadow />

      <ambientLight intensity={0.5} color="#a1f9ff" />
      <directionalLight
        position={lightPos}
        intensity={3}
        color={'#d1b269'}
        castShadow
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-camera-far={200}
        shadow-camera-left={-100}
        shadow-camera-right={100}
        shadow-camera-top={100}
        shadow-camera-bottom={-100}
        shadow-bias={-0.0001}
        shadow-normalBias={0.02}
      />
      <directionalLight
        position={[-50, 20, -50]}
        intensity={1}
        color={'#b3d9ff'}
      />
      <directionalLight
        position={[-20, 20, -100]}
        intensity={1.2}
        color={'#e20000'}
      />

      {/* Load the complete beach map with instanced props */}
      <BeachMap />
    </>
  );
};

export default GameEnvironment;
