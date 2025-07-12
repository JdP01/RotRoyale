import React, { useEffect } from 'react';
import { useGLTF, Sky } from '@react-three/drei';
import { RigidBody } from '@react-three/rapier';
import * as THREE from 'three';

const mapScale = 4.5; //original is 5.5
const lightPos = [100, 30, 100];

const GameEnvironment = () => {
  const { scene: gameMap } = useGLTF('/objects/Map2.glb');

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

      <mesh position={[0, -41.9, 0]} rotation={[-Math.PI / 2, 0, 0]} > {/* Water */}
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#0074ad" transparent opacity={0.8}
          metalness={0.1} roughness={1} envMapIntensity={0.8} />
      </mesh>

      <RigidBody
        colliders="trimesh"
        type="fixed"
        name="floor"
        interpolate={true}
        friction={1}
        restitution={0}
      >
        <primitive object={gameMap} scale={mapScale} castShadow receiveShadow={true} />
      </RigidBody>
    </>
  );
};

export default GameEnvironment;
