import React, {useState, useRef, useMemo, forwardRef} from 'react';
import {Box, useKeyboardControls} from '@react-three/drei'; 
import {RigidBody } from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import * as THREE from "three";
import { Controls } from "./GameCanvas"
import { and } from 'three/tsl';


export const Cube = forwardRef((_,bodyRef) =>{ 
    const [hover, setHover] = useState(false);
    //const cube = useRef(); 
    const jump = () =>{
        bodyRef.current.applyImpulse({x: 0, y:10, z: 0});

        isOnFloor.current = false;
     }
    const jumpPressed = useKeyboardControls((state) => state[Controls.jump]);
    const forwardPressed = useKeyboardControls((state) => state[Controls.forward]);
    const backPressed = useKeyboardControls((state) => state[Controls.back]);
    const leftPressed = useKeyboardControls((state) => state[Controls.left]);
    const rightPressed = useKeyboardControls((state) => state[Controls.right]);
    
    const handleMovement = () => { 
        if(!isOnFloor.current){ 
            return;
        }

        const dir = new THREE.Vector3();
        if (forwardPressed)  dir.z -= 10;
        if (backPressed)     dir.z += 10;
        if (leftPressed)     dir.x -= 10;
        if (rightPressed)    dir.x += 10;
        const vel = bodyRef.current.linvel(); // { x, y, z }


        bodyRef.current.setLinvel({x:dir.x,y:vel.y,z: dir.z},true);

    }

    useFrame((_,delta) => { 
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
            if (other.rigidBodyObject.name === "floor"){ 
                isOnFloor.current = true;
            }
        }}
        onCollisionExit={({other}) => { 
            if (other.rigidBodyObject.name === "floor"){ 
                isOnFloor.current = false;
            }
        }}

        type = "dynamic" 
        colliders = "cuboid" 
        interpolation
        >
            <Box  args = {[2,1,2]}
            onPointerEnter={() => setHover(true)} 
            onPointerLeave = {() => setHover(false)}
            castShadow
            receiveShadow
            >

                <meshStandardMaterial attach={"material"} color={hover? "red":"pink"} />
            </Box>
            </RigidBody>
        </>

    );
});
