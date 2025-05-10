import React, {useState, useRef, useMemo} from 'react';
import {Box, useKeyboardControls} from '@react-three/drei'; 
import {RigidBody } from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import * as THREE from "three";
import { Controls } from "./GameCanvas"
import { and } from 'three/tsl';


export const Cube = () =>{ 
    const [hover, setHover] = useState(false);
    const cube = useRef(); 
    const jump = () =>{
        cube.current.applyImpulse({x: 0, y:5, z: 0});
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
        if(forwardPressed){ 
            cube.current.applyImpulse({x: -2, y:0, z: 0});
        }
        if(backPressed){ 
            cube.current.applyImpulse({x: 2, y:0, z: 0});
        }
        if(leftPressed){ 
            cube.current.applyImpulse({x: 0, y:0, z: 2});
        }
        if(rightPressed){ 
            cube.current.applyImpulse({x: 0, y:0, z: -2});
        }

    }

    useFrame((_,delta) => { 
        if(jumpPressed && isOnFloor.current) { 
            jump();
            isOnFloor.current = true; 
        }
        handleMovement() ; 
        
    });

    const isOnFloor = useRef(true);
    return( 
        <>
        <RigidBody ref = {cube} 
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
        >
            <Box  args = {[2,1,2]}
            onPointerEnter={() => setHover(true)} 
            onPointerLeave = {() => setHover(false)}
            castShadow
            receiveShadow
            >

                <meshStandardMaterial attach={"material"} color={hover? "red":"blue"} />
            </Box>
            </RigidBody>
        </>

    );
}
