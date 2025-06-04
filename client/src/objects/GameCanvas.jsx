import React, { Suspense, useMemo, useState, useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Box, KeyboardControls, OrbitControls, Sky,useGLTF} from '@react-three/drei';
import { Physics, RigidBody } from '@react-three/rapier';
import { Dino } from './dino';
import * as THREE from "three";
import { CameraRig } from './CameraRig';

const lightPos = [100,30,100];
const mapScale = 5.5; 

export const Controls = {
  forward: "forward",
  back: "back",
  left: "left",
  right: "right",
  jump: "jump",
  sprint: "sprint"
}

export default function GameCanvas() {

  const { scene: gameMap } = useGLTF('/objects/mapTest.glb');
  useEffect(() => {
          gameMap.traverse((child)=> { 
              if(child.isMesh){
                  gameMap.castShadow = true;
                  gameMap.receiveShadow = true;
              }
          })
      }, [gameMap]);

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

  return (
    <KeyboardControls map={map}>
      {/* FIXED: Enable shadows on Canvas */}
      <Canvas shadows gl={{ 
          shadowMap: { enabled: true, type: THREE.UnfilteredShadowMap } 
      }}
      >
        <Sky sunPosition = {lightPos} mieCoefficient={0.001} rayleigh={0.2} turbidity={20} castShadow/>
        <Suspense fallback={null}>
          
          {/* FIXED: Proper lighting setup for shadows */}
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
          {/* Rim light for better silhouettes */}
          <directionalLight 
            position={[0, 10, -100]} 
            intensity={1.2} 
            color={'#ffd700'} 
          />

          <Physics gravity={[0, -9.81, 0]} timeStep={1/100} debug>
            <OrbitControls />

            <Dino ref={dinoRef} onRotationChange={setDinoRotation} castShadow/>
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
            colliders = "trimesh" 
            type = "fixed"
            name = "floor" 
            interpolate = {true} 
            friction = {0} 
            restitution = {0}>
              
              <primitive object={gameMap} scale = {mapScale} castShadow receiveShadow = {true}/>
            </RigidBody>
            {/* FIXED: Floor with proper shadow receiving */}
            
          </Physics>
        </Suspense>
      </Canvas>
    </KeyboardControls>
  );
}
{/*<CameraRig
              targetRef={dinoRef}
              characterRotation={dinoRotation}
              distance={8}
              height={3.5}
              heightOffset={0.5}
              stiffness={0.08}
              lookStiffness={0.12}
            />*/}

{/*<RigidBody interpolate={true} type="fixed" name="floor" colliders="cuboid" restitution={0} friction={0}>
              <Box args={[100, 1, 100]} receiveShadows position={[0,0,0]}>
                <meshStandardMaterial color="blue"  metalness={0} roughness={1}/>
              </Box>
    </RigidBody> */}