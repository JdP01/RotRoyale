import React, {useState, useRef} from 'react';
import {useKeyboardControls, useGLTF} from '@react-three/drei'; 
import {RigidBody} from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import * as THREE from "three";
import { Controls } from "./GameCanvas"
import { useDinoAnimations } from "./dinoAnimations";

export const Dino = ({ref: bodyRef, onRotationChange}) => { 
    // Refs for body parts
    const legLeftRef = useRef();
    const legRightRef = useRef();
    const headRef = useRef();
    const tailRef = useRef();
    const armLeftRef = useRef();
    const armRightRef = useRef();
    const mainGroupRef = useRef();
    
    // Load all models
    const { scene: Body } = useGLTF('/dino_parts1/body.glb');
    const { scene: Head } = useGLTF('/dino_parts1/head.glb');
    const { scene: LeftLeg } = useGLTF('/dino_parts1/left_leg.glb'); 
    const { scene: armLeft } = useGLTF('/dino_parts1/arm_left.glb')
    const { scene: tail } = useGLTF('/dino_parts1/tail.glb')
    const { scene: weapon } = useGLTF('/objects/glock_game.glb')

    // Character rotation
    const [currentBodyRotation, setCurrentBodyRotation] = useState(0);
    const [targetRotation, setTargetRotation] = useState(0);
    
    // Animation states
    const [isMoving, setIsMoving] = useState(false);
    const [isSprinting, setIsSprinting] = useState(false);
    const [isJumping, setIsJumping] = useState(false);
    
    // Animation hook
    const { updateAdvancedAnimations } = useDinoAnimations();

    // Movement controls 
    const jump = () => {
        bodyRef.current.applyImpulse({x: 0, y: 7, z: 0});
        isOnFloor.current = false;
        setIsJumping(true);
        // Reset jumping state after a delay
        //setTimeout(() => setIsJumping(false), 800);
    }
    
    const jumpPressed = useKeyboardControls((state) => state[Controls.jump]);
    const forwardPressed = useKeyboardControls((state) => state[Controls.forward]);
    const backPressed = useKeyboardControls((state) => state[Controls.back]);
    const leftPressed = useKeyboardControls((state) => state[Controls.left]);
    const rightPressed = useKeyboardControls((state) => state[Controls.right]);
    const sprintPressed = useKeyboardControls((state) => state[Controls.sprint]);
    
    const dir = new THREE.Vector3();
    
    const handleMovement = (delta) => { 
        dir.set(0, 0, 0);
        let moving = false;
        let newTargetRotation = currentBodyRotation;
        
        // Check movement inputs and set target rotation
        if (forwardPressed) {
            dir.z = 1;
            newTargetRotation = Math.PI; // Face forward
            moving = true;
        }
        if (backPressed) {
            dir.z = -1;
            newTargetRotation = 0; // Face backward (toward camera)
            moving = true;
        }
        if (leftPressed) {
            dir.x = 1;
            newTargetRotation = -Math.PI / 2; // Face left
            moving = true;
        }
        if (rightPressed) {
            dir.x = -1;
            newTargetRotation = Math.PI / 2; // Face right
            moving = true;
        }
        if (jumpPressed && isOnFloor.current) { 
            jump();
            isOnFloor.current = true; 
        }
        
        // Handle diagonal movement - character faces the primary direction
        if (forwardPressed && leftPressed) newTargetRotation = -3 * Math.PI / 4; // Northeast
        if (forwardPressed && rightPressed) newTargetRotation =3 * Math.PI / 4; // Northwest
        if (backPressed && leftPressed) newTargetRotation = -Math.PI / 4; // Southeast
        if (backPressed && rightPressed) newTargetRotation = Math.PI / 4; // Southwest
        
        setIsMoving(moving);
        setIsSprinting(sprintPressed && moving);
        
        if (moving) {
            setTargetRotation(newTargetRotation);
            
            // Smoothly rotate body towards target
            const rotationSpeed = 8 * delta;
            const angleDiff = newTargetRotation - currentBodyRotation;
            const shortestAngle = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
            
            if (Math.abs(shortestAngle) > 0.05) {
                const newRotation = currentBodyRotation + shortestAngle * rotationSpeed;
                setCurrentBodyRotation(newRotation);
            } 
            else setCurrentBodyRotation(newTargetRotation);

            // Normalize direction and apply speed
            dir.normalize();
            const moveSpeed = (sprintPressed && moving) ? 15 : 10;
            dir.multiplyScalar(moveSpeed);
        }

        const vel = bodyRef.current.linvel();
        bodyRef.current.setLinvel({x: dir.x, y: vel.y, z: dir.z}, true);
    }

    const isOnFloor = useRef(true);

    // Game Frame Loop 
    useFrame((_, delta) => { 
        if (!bodyRef.current) return;
        
        handleMovement(delta); 
        
        // Update animations and get body bob height
        const bodyBobHeight = updateAdvancedAnimations(delta, {
            isMoving,
            isSprinting, 
            isJumping
        }, {
            legLeftRef,
            legRightRef,
            headRef,
            tailRef,
            armLeftRef,
            armRightRef,
            mainGroupRef
        });
        
        // Apply body rotation and vertical bobbing
        if (mainGroupRef.current && bodyRef.current) {

            mainGroupRef.current.position.y = bodyBobHeight;
            
            const quaternion = new THREE.Quaternion();
            quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0), currentBodyRotation);
            bodyRef.current.setRotation(quaternion,true);
            // Notify parent component of rotation change for camera
            if (onRotationChange) {
                onRotationChange(currentBodyRotation);
            }
        }
    });

    return( 
        <>
        <RigidBody ref={bodyRef}
            position={[2, 5, 0]} 
            onCollisionEnter={({other}) => { 
                console.log("colliding with", other.rigidBodyObject?.name);
                if (other.rigidBodyObject.name === "floor") {
                    isOnFloor.current = true;
                    setIsJumping(false); // Reset jumping when landing
                }
            }}
            onCollisionExit={({other}) => { 
                if (other.rigidBodyObject.name === "floor") {
                    isOnFloor.current = false;
                }
            }}
            enabledRotations={[false, false, false]}
            type="dynamic"
            colliders="hull"
            interpolate={true}
            gravityScale={2}
        >
            <group ref={mainGroupRef} scale={[0.4, 0.4, 0.4]} rotation={[0, Math.PI, 0]} >
                <primitive object={Body} position={[0, 0, 0]} />

                <group ref={headRef} position={[0, 2.2, 1.3]} >
                    <primitive object={Head} />
                </group>
                
                <group ref={legLeftRef} position={[1, 1, 1]}>
                    <primitive object={LeftLeg} position={[0, -1.3, -0.2]} />
                </group>

                <group ref={legRightRef} position={[-1, 1, 1]}>
                    <primitive object={LeftLeg.clone()} scale={[-1, 1, 1]} position={[0, -1.3, -0.2]} />
                </group>

                <group ref={armLeftRef} position={[-1.25, 1.3, 1.3]}>
                    <primitive object={armLeft} />
                    <primitive object={weapon} rotation={[0, -1.5, 0]} scale={[0.15, 0.15, 0.15]} position={[-0.2, 0.5, 1]}/>
                </group>

                <group ref={armRightRef} position={[1.25, 1.3, 1.3]}>
                    <primitive object={armLeft.clone()} scale={[-1, 1, 1]} />
                    <primitive object={weapon.clone()} rotation={[0, -1.5, 0]} scale={[0.15, 0.15, 0.15]} position={[0.2, 0.5, 1]}/>
                </group>

                <group ref={tailRef} position={[0, 0, 0]}>
                    <primitive object={tail}/>
                </group>
            </group>
        </RigidBody>
        </>
    );
};