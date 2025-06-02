import React, { Suspense, useMemo, useState, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Box, KeyboardControls, OrbitControls, Sky} from '@react-three/drei';
import { Physics, RigidBody } from '@react-three/rapier';
import { Dino } from './dino';
import * as THREE from "three";
import { CameraRig } from './CameraRig';

const lightPos = [100,1,100];

export const Controls = {
  forward: "forward",
  back: "back",
  left: "left",
  right: "right",
  jump: "jump",
  sprint: "sprint"
}

export default function GameCanvas() {
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
          shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap } 
      }}
      >
        <Sky sunPosition = {lightPos} mieCoefficient={0.001} rayleigh={5} turbidity={20} castShadow/>
        <Suspense fallback={null}>
          
          {/* FIXED: Proper lighting setup for shadows */}
          <ambientLight intensity={0.3} />
          <directionalLight 
            position={lightPos} 
            intensity={50} 
            color={'#d1b269'} 
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-camera-far={50}
            shadow-camera-left={-20}
            shadow-camera-right={20}
            shadow-camera-top={20}
            shadow-camera-bottom={-20}
          />

          <Physics gravity={[0, -9.81, 0]} timeStep={1 / 300}>
            <OrbitControls />

            <Dino ref={dinoRef} onRotationChange={setDinoRotation} />

            <CameraRig
              targetRef={dinoRef}
              characterRotation={dinoRotation}
              distance={8}
              height={4}
              heightOffset={1}
              stiffness={0.08}
              lookStiffness={0.12}
            />

            {/* FIXED: Floor with proper shadow receiving */}
            <RigidBody interpolate={true} type="fixed" name="floor" colliders="cuboid" restitution={0} friction={1}>
              <Box args={[100, 1, 100]} receiveShadow>
                <meshStandardMaterial color="springgreen" />
              </Box>
            </RigidBody>
          </Physics>
        </Suspense>
      </Canvas>
    </KeyboardControls>
  );
}