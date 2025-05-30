import React, {useState, useRef, useMemo, forwardRef, useEffect} from 'react';
import {Box, useKeyboardControls, useGLTF} from '@react-three/drei'; 
import {RapierRigidBody, RigidBody} from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import * as THREE from "three";
import { Controls } from "./GameCanvas"

function getObjectDimensions(objectRef) {
    const obj = objectRef.current
    if (!obj) {
        return { min: [0, 0, 0], max: [0, 0, 0] }
    }
    
    // Make sure world matrices are up to date
    obj.updateMatrixWorld(true)
    
    // Compute Box3
    const box = new THREE.Box3().setFromObject(obj)
    
    // Pull out into plain arrays
    const { x: minX, y: minY, z: minZ } = box.min
    const { x: maxX, y: maxY, z: maxZ } = box.max

     const sizeX = maxX - minX;
    const sizeY = maxY - minY;
    const sizeZ = maxZ - minZ;

    // --- ADD THIS ---
    // Calculate the center point
    const centerX = (maxX + minX) / 2;
    const centerY = (maxY + minY) / 2;
    const centerZ = (maxZ + minZ) / 2;
    return {
        min: [minX,minY,minZ],
        max: [maxX,maxY,maxZ],
        size: [sizeX,sizeY,sizeZ], 
        center: [centerX, centerY, centerZ]
    }
}

export const Dino = ({ref: bodyRef}) =>{ 
        const ref = useRef();
        const legLeftRef = useRef();
        const legRightRef = useRef();
        const headRef = useRef();
        const tailRef = useRef();
        const armLeftRef = useRef();
        const armRightRef = useRef();
        
    const { scene: Body } = useGLTF('/dino_parts1/body.glb'); // path to your GLTF
    const { scene: Head } = useGLTF('/dino_parts1/head.glb');
    const {scene: LeftLeg} = useGLTF('/dino_parts1/left_leg.glb'); 
    const {scene: armLeft} = useGLTF('/dino_parts1/arm_left.glb')
    const {scene: tail} = useGLTF('/dino_parts1/tail.glb')
    const {scene: weapon} = useGLTF('/objects/glock_game.glb')

    //Start movement controls 
    const [hover, setHover] = useState(false);
    const jump = () =>{
        bodyRef.current.applyImpulse({x: 0, y:10, z: 0});

        isOnFloor.current = false;
     }
    const jumpPressed = useKeyboardControls((state) => state[Controls.jump]);
    const forwardPressed = useKeyboardControls((state) => state[Controls.forward]);
    const backPressed = useKeyboardControls((state) => state[Controls.back]);
    const leftPressed = useKeyboardControls((state) => state[Controls.left]);
    const rightPressed = useKeyboardControls((state) => state[Controls.right]);
    const dir = new THREE.Vector3();
    
    const handleMovement = () => { 

        dir.set(0,0,0)
          const pos = bodyRef.current.translation(); // Get current position
          const newPos = { x: pos.x, y: pos.y, z: pos.z };

        if(!isOnFloor.current){ 
          newPos.y -= 0.1;
        }
        else{ 
          //newPos.y = 0;
        }
        if (forwardPressed)  newPos.z -= 1;
        if (backPressed)     newPos.z += 1;
        if (leftPressed)     newPos.x -= 1;
        if (rightPressed)    newPos.x += 1;

        bodyRef.current.setNextKinematicTranslation(newPos);


    }
    //End movement controls


    //call getObjectDirections here 

    //Game Frame Loop 
    useFrame((_,delta) => { 
        if (!bodyRef.current) return;
        handleMovement(); 

        if(jumpPressed && isOnFloor.current) { 
            jump();
            isOnFloor.current = true; 
        }         
     
            
    });

    const isOnFloor = useRef(true);

    return( 
        <>
        <RigidBody ref = {bodyRef}
        
        position ={[2,5,0]} 
        onCollisionEnter={({other}) => { 
          console.log("colliding with", other.rigidBodyObject?.name);
            if (other.rigidBodyObject.name === "floor"){isOnFloor.current = true;}
        }}
        onCollisionExit={({other}) => { 
            if (other.rigidBodyObject.name === "floor"){isOnFloor.current = false;}
        }}
        type = "kinematicPosition"
        colliders = "hull" 
        interpolate = {true}
        >
        <group ref={bodyRef}>
          <primitive object={Body} position={[0, 0, 0]} />

          <group ref={headRef} position={[0, 2.2, 1.3]}>
            <primitive object={Head} />
          </group>
  
          <group ref={legLeftRef} position={[1, 1, 1]}>
            <primitive object={LeftLeg} position={[0,-1.3,-0.2]} />
          </group>
  
          <group ref={legRightRef} position={[-1, 1, 1]}>
            <primitive object={LeftLeg.clone()} scale={[-1, 1, 1]} position={[0,-1.3,-0.2]}/>
          </group>
  
          <group ref={armLeftRef} position={[-1.25, 1.3, 1.3]}>
            <primitive object={armLeft} />
            <primitive object={weapon} rotation={[0,-1.5,0]} scale={[0.15,0.15,0.15]} position={[-0.2,0.5,1]}/>
          </group>
  
          <group ref={armRightRef} position={[1.25, 1.3, 1.3]}>
            <primitive object={armLeft.clone()} scale={[-1, 1, 1]} />
            <primitive object={weapon.clone()} rotation={[0,-1.5,0]} scale={[0.15,0.15,0.15]} position={[0.2,0.5,1]}/>
          </group>
  
          <group ref={tailRef} position={[0, 0, 0]}>
            <primitive object={tail}/>
          </group>
        </group>
        </RigidBody>
        </>
        
    );
};
