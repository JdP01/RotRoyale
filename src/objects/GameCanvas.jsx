import React, { Suspense,useMemo,useState } from 'react';
import { Canvas } from '@react-three/fiber';
import {Box, KeyboardControls, OrbitControls} from '@react-three/drei'; 
import { Physics, RigidBody} from '@react-three/rapier';
import {Cube} from './character';
import * as THREE from "three";



export const Controls = {
  forward: "forward",
  back: "back", 
  left: "left", 
  right: "right", 
  jump: "jump", 
}

export default function GameCanvas() {

  const map = useMemo(() =>[
          { name: Controls.forward, keys: ["ArrowUp", "KeyW"]},
          { name: Controls.back, keys: ["ArrowDown", "KeyS"]},
          { name: Controls.left, keys: ["ArrowLeft", "KeyA"]},
          { name: Controls.right, keys: ["ArrowRight", "KeyD"]},
          { name: Controls.jump, keys: ["Space"]},
      ],
      []
      );

  return (
    <KeyboardControls map={map}>
      <Canvas shadows camera={{ position: [9, 4, 9], fov: 50 }}>
        <color attach="background" args={['#87ceeb']} />
        <Suspense fallback = {null}>
        <ambientLight intensity={0.5} castShadow/>
        <directionalLight position={[10, 10, 5]} intensity = {0.4} castShadow />

          <Physics gravity={[0,-9.81,0]} debug >
          <OrbitControls />
            <RigidBody type = "fixed" name = "floor" colliders = "cuboid" friction={2}>
                <Box args = {[100,1,100]} castShadow receiveShadow>
                  <meshStandardMaterial color="springgreen" />
                </Box>
            </RigidBody>
            <Cube/>
          </Physics>
        </Suspense>
      </Canvas>
    </KeyboardControls>
  );
}
