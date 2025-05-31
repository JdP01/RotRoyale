import React, {useState, useRef, useMemo, forwardRef, useEffect} from 'react';
import {Box, useKeyboardControls, useGLTF} from '@react-three/drei'; 
import {RapierRigidBody, RigidBody} from '@react-three/rapier';
import { useFrame, useThree } from '@react-three/fiber';
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

export const Dino = ({ref: bodyRef, onRotationChange}) =>{ 
        const ref = useRef();
        const legLeftRef = useRef();
        const legRightRef = useRef();
        const headRef = useRef();
        const tailRef = useRef();
        const armLeftRef = useRef();
        const armRightRef = useRef();
        const mainGroupRef = useRef();
        
    const { scene: Body } = useGLTF('/dino_parts1/body.glb'); // path to your GLTF
    const { scene: Head } = useGLTF('/dino_parts1/head.glb');
    const {scene: LeftLeg} = useGLTF('/dino_parts1/left_leg.glb'); 
    const {scene: armLeft} = useGLTF('/dino_parts1/arm_left.glb')
    const {scene: tail} = useGLTF('/dino_parts1/tail.glb')
    const {scene: weapon} = useGLTF('/objects/glock_game.glb')

    // Mouse and camera controls
    const { camera, gl } = useThree();
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const [targetRotation, setTargetRotation] = useState(0);
    const [currentBodyRotation, setCurrentBodyRotation] = useState(0);
    const [headTargetRotation, setHeadTargetRotation] = useState(0);
    
    // Animation states
    const [isMoving, setIsMoving] = useState(false);
    const [isSprinting, setIsSprinting] = useState(false);
    const animationTime = useRef(0);
    const bodyBobOffset = useRef(0);

    // Movement controls 
    const [hover, setHover] = useState(false);
    const jump = () =>{
        bodyRef.current.applyImpulse({x: 0, y:200, z: 0});
        isOnFloor.current = false;
     }
    const jumpPressed = useKeyboardControls((state) => state[Controls.jump]);
    const forwardPressed = useKeyboardControls((state) => state[Controls.forward]);
    const backPressed = useKeyboardControls((state) => state[Controls.back]);
    const leftPressed = useKeyboardControls((state) => state[Controls.left]);
    const rightPressed = useKeyboardControls((state) => state[Controls.right]);
    const sprintPressed = useKeyboardControls((state) => state[Controls.sprint]); // Add sprint to your Controls enum
    
    const dir = new THREE.Vector3();
    
    // Mouse movement handler
    useEffect(() => {
        const handleMouseMove = (event) => {
            const x = (event.clientX / window.innerWidth) * 2 - 1;
            const y = -(event.clientY / window.innerHeight) * 2 + 1;
            setMousePosition({ x, y });
        };

        gl.domElement.addEventListener('mousemove', handleMouseMove);
        return () => gl.domElement.removeEventListener('mousemove', handleMouseMove);
    }, [gl]);

    // Calculate target rotation based on mouse position
    useEffect(() => {
        const angle = Math.atan2(mousePosition.x, -mousePosition.y); // Fixed: negative Y for correct forward direction
        setTargetRotation(angle);
        
        // Head rotation with limited range (±60 degrees)
        const headAngle = Math.max(-Math.PI/3, Math.min(Math.PI/3, angle));
        setHeadTargetRotation(headAngle);
    }, [mousePosition]);
    
    const handleMovement = (delta) => { 
        dir.set(0,0,0);
        let moving = false;
        
        // Check if any movement key is pressed
        if (forwardPressed || backPressed || leftPressed || rightPressed) {
            moving = true;
        }
        
        setIsMoving(moving);
        setIsSprinting(sprintPressed && moving);
        
        if (moving) {
            // Use current body rotation as forward direction
            const forward = new THREE.Vector3(0, 0, -1); // Forward is negative Z
            const right = new THREE.Vector3(1, 0, 0);    // Right is positive X
            
            // Rotate directions based on current body rotation
            forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), currentBodyRotation);
            right.applyAxisAngle(new THREE.Vector3(0, 1, 0), currentBodyRotation);
            
            const moveSpeed = (sprintPressed && moving) ? 15 : 10;
            
            if (forwardPressed)  dir.add(forward.clone().multiplyScalar(moveSpeed));
            if (backPressed)     dir.add(forward.clone().multiplyScalar(-moveSpeed));
            if (leftPressed)     dir.add(right.clone().multiplyScalar(-moveSpeed));
            if (rightPressed)    dir.add(right.clone().multiplyScalar(moveSpeed));
            
            // Smoothly rotate body towards target when moving
            const rotationSpeed = 3 * delta;
            const angleDiff = targetRotation - currentBodyRotation;
            const shortestAngle = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
            
            if (Math.abs(shortestAngle) > 0.1) {
                const newRotation = currentBodyRotation + shortestAngle * rotationSpeed;
                setCurrentBodyRotation(newRotation);
            }
        }
        
        const vel = bodyRef.current.linvel();
        bodyRef.current.setLinvel({x: dir.x, y: vel.y, z: dir.z}, true);
    }

    const updateAnimations = (delta) => {
        const speed = isSprinting ? 2.5 : isMoving ? 1.5 : 0;
        animationTime.current += delta * speed * 8; // Animation speed multiplier
        
        if (isMoving) {
            // Body bobbing
            bodyBobOffset.current = Math.sin(animationTime.current * 2) * 0.1;
            
            // Leg swinging
            const legSwing = Math.sin(animationTime.current) * 0.3;
            if (legLeftRef.current) {
                legLeftRef.current.rotation.x = legSwing;
            }
            if (legRightRef.current) {
                legRightRef.current.rotation.x = -legSwing;
            }
            
            // Arm swinging (opposite to legs)
            const armSwing = Math.sin(animationTime.current + Math.PI) * 0.2;
            if (armLeftRef.current) {
                armLeftRef.current.rotation.x = armSwing;
            }
            if (armRightRef.current) {
                armRightRef.current.rotation.x = -armSwing;
            }
        } else {
            // Gradually return to neutral positions when not moving
            bodyBobOffset.current *= 0.95;
            
            if (legLeftRef.current) {
                legLeftRef.current.rotation.x *= 0.9;
            }
            if (legRightRef.current) {
                legRightRef.current.rotation.x *= 0.9;
            }
            if (armLeftRef.current) {
                armLeftRef.current.rotation.x *= 0.9;
            }
            if (armRightRef.current) {
                armRightRef.current.rotation.x *= 0.9;
            }
        }
        
        // Tail wagging - always active but faster when moving/sprinting
        const tailSpeed = isMoving ? (isSprinting ? 3 : 2) : 1;
        const tailWag = Math.sin(animationTime.current * tailSpeed) * 0.15;
        if (tailRef.current) {
            tailRef.current.rotation.y = tailWag;
        }
        
        // Head rotation - smooth interpolation
        if (headRef.current) {
            const currentHeadRotation = headRef.current.rotation.y;
            const headRotationSpeed = isMoving ? 5 : 8; // Faster head movement when stationary
            const headAngleDiff = headTargetRotation - currentHeadRotation;
            const headShortestAngle = Math.atan2(Math.sin(headAngleDiff), Math.cos(headAngleDiff));
            
            headRef.current.rotation.y += headShortestAngle * headRotationSpeed * delta;
        }
    };

    const isOnFloor = useRef(true);

    //Game Frame Loop 
    useFrame((_, delta) => { 
        if (!bodyRef.current) return;
        
        handleMovement(delta); 
        updateAnimations(delta);

        if(jumpPressed && isOnFloor.current) { 
            jump();
            isOnFloor.current = true; 
        }
        
        // Apply body rotation and notify parent
        if (mainGroupRef.current) {
            mainGroupRef.current.rotation.y = currentBodyRotation;
            mainGroupRef.current.position.y = bodyBobOffset.current;
            
            // Notify parent component of rotation change for camera
            if (onRotationChange) {
                onRotationChange(currentBodyRotation);
            }
        }
    });

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
        enabledRotations={[false, true, false]} // Only allow rotation around Y
        type = "dynamic"
        colliders = "hull"
        interpolate = {true}
        gravityScale={2}
        >
        <group ref={mainGroupRef}>
          <primitive object={Body} position={[0, 0, 0]} colliders = "cuboid"/>

          <group ref={headRef} position={[0, 2.2, 1.3]} colliders = "hull">
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