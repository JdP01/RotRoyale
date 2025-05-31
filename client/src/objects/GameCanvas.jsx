import React, { Suspense,useMemo,useState, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {Box, KeyboardControls, OrbitControls} from '@react-three/drei'; 
import { Physics, RigidBody} from '@react-three/rapier';
import {Dino} from './dino';
import * as THREE from "three";
import { CameraRig } from './CameraRig'; // ← new



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

  const map = useMemo(() =>[
          { name: Controls.forward, keys: ["KeyW"]},
          { name: Controls.back, keys: ["KeyS"]},
          { name: Controls.left, keys: ["KeyA"]},
          { name: Controls.right, keys: ["KeyD"]},
          { name: Controls.jump, keys: ["Space"]},
          { name: Controls.sprint, keys: ["Shift"]},
      ],
      []
      );

  return (
    <KeyboardControls map={map}>
      <Canvas shadows >
        <color attach="background" args={['#87ceeb']} />
        <Suspense fallback = {null}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity = {0.4} castShadow />

          <Physics gravity={[0,-9.81,0]} timeStep={1/300} >
          <OrbitControls />

          <Dino ref ={dinoRef} onRotationChange = {setDinoRotation}/>

          <CameraRig 
                targetRef={dinoRef} 
                characterRotation={dinoRotation}
                distance={8}        
                height={4}          
                heightOffset={1}    
                stiffness={0.08}    
                lookStiffness={0.12} 
            />
            <RigidBody interpolate = {true} type = "fixed" name = "floor" colliders = "cuboid" restitution={0} friction={1} >
                <Box args = {[100,1,100]} 
                castShadow receiveShadow>
                  <meshStandardMaterial color="springgreen" />
                </Box>
            </RigidBody>
          </Physics>
        </Suspense>
      </Canvas>
    </KeyboardControls>
  );
}
