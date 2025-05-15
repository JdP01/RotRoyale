import React, {useState, useRef, useMemo, forwardRef} from 'react';
import {Box, useKeyboardControls, useGLTF} from '@react-three/drei'; 
import {RapierRigidBody, RigidBody, useRapier, useSphericalJoint} from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import * as THREE from "three";
import { Controls } from "./GameCanvas"

function NeckJoint ({bodyA, bodyB}) {

    const joint = useSphericalJoint(bodyA, bodyB, [
       [0,0,0], 
       [0,0,0]
    ]);
    return null;
    };

export const Dino = ({ref: bodyRef}) =>{ 

    const { scene: Body } = useGLTF('/dino_parts1/body.glb'); // path to your GLTF
    const { scene: Head } = useGLTF('/dino_parts1/head.glb');
    const headRef = useRef();
    //const { scene: LeftArm } = useGLTF('/dino_parts1/arm_left.glb');
    //const { scene: LeftLeg } = useGLTF('/dino_parts1/bodyleft_leg.glb');

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
        if(!isOnFloor.current){ 
            return;
        }
        dir.set(0,0,0)
        if (forwardPressed)  dir.z -= 10;
        if (backPressed)     dir.z += 10;
        if (leftPressed)     dir.x -= 10;
        if (rightPressed)    dir.x += 10;
        const vel = bodyRef.current.linvel(); // { x, y, z }

        bodyRef.current.setLinvel({x:dir.x,y:vel.y,z: dir.z},true);

    }

    useFrame((_,delta) => { 
        if (!bodyRef.current) return;

        handleMovement() ; 
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
            if (other.rigidBodyObject.name === "floor"){isOnFloor.current = true;}
        }}
        onCollisionExit={({other}) => { 
            if (other.rigidBodyObject.name === "floor"){isOnFloor.current = false;}
        }}
        type = "dynamic"
        colliders = "hull" 
        interpolate = {true}
        >
            <primitive object = {Body} />

            {/*<meshStandardMaterial attach={"material"} color={hover? "red":"pink"} />*/}
        </RigidBody>
        <RigidBody
        
        position = {[2,6,0]}
        type = "dynamic"
        colliders = "hull"
        interpolate = {true}
        ref = {headRef}
        >
            <primitive object = {Head}/>
        </RigidBody>
        <NeckJoint bodyA = {headRef} bodyB = {bodyRef}/>
        </>

    );
};
