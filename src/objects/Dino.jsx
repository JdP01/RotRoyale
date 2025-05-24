import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { Physics, RigidBody, CuboidCollider, useRapier } from '@react-three/rapier';
import * as THREE from 'three';



export function Dino({ position, rotationY, lookRotation, isJumping, isMoving, isSprinting }) {
    const ref = useRef();
    const legLeftRef = useRef();
    const legRightRef = useRef();
    const headRef = useRef();
    const tailRef = useRef();
    const armLeftRef = useRef();
    const armRightRef = useRef();
    const bodyRef = useRef();
    
    // OPTIMIZATION: Use refs instead of state for animation values
    const legAngle = useRef(0);
    const headBobAngle = useRef(0);
    const tailAngle = useRef(0);
    const armAngle = useRef(0);
    const bodyBobAngle = useRef(0);
    const bodyBobHeight = useRef(0);
  
    // Load all models
    const body = useGLTF('/dino_parts1/body.glb')
    const head =useGLTF('/dino_parts1/head.glb')
    const legLeft = useGLTF('/dino_parts1/leg_left.glb')
    const armLeft = useGLTF('/dino_parts1/arm_left.glb')
    const tail = useGLTF('/dino_parts1/tail.glb')
    const weapon = useGLTF('/objects/glock_game.glb')

    // Create refs for all bounding box helpers

    
    const bodyBBHelperRef = useRef();
    const headBBHelperRef = useRef();
    const legLeftBBHelperRef = useRef();
    const legRightBBHelperRef = useRef();
    const armLeftBBHelperRef = useRef();
    const armRightBBHelperRef = useRef();
    const tailBBHelperRef = useRef();
    const weaponLeftBBHelperRef = useRef();
    const weaponRightBBHelperRef = useRef();

    // Create bounding boxes for all components
    useEffect(() => {
    // Define colors for different part bounding boxes
    const colors = {
        body: 0xC71585,    // Magenta purple
        head: 0x00FF00,    // Green
        legs: 0xFF0000,    // Red
        arms: 0x0000FF,    // Blue
        tail: 0xFFFF00,    // Yellow
        weapons: 0xFF00FF  // Pink
    };

    // Helper function to create a bounding box for a scene
    const createBoundingBox = (scene, ref, parentRef, color) => {
        if (scene) {
        // Create bounding box
        const bb = new THREE.Box3(new THREE.Vector3(), new THREE.Vector3());
        scene.updateMatrixWorld(true); // Force update matrix
        bb.setFromObject(scene);
        
        // Create helper with specific color
        
        const bbHelper = new THREE.Box3Helper(bb, color);
        ref.current = bbHelper;
        
        // Add helper to parent if available
        if (parentRef.current) {
            parentRef.current.add(bbHelper);
        }
        
        // Return cleanup function
        return () => {
            if (parentRef.current && ref.current) {
            parentRef.current.remove(ref.current);
            }
        };
        }
        return null;
    };

    // Create array to collect all cleanup functions
    const cleanupFunctions = [];

    // Body bounding box
    if (body.scene) {
        //cleanupFunctions.push(createBoundingBox(body.scene, bodyBBHelperRef, bodyRef, colors.body));
    }
    if (head.scene) {
        cleanupFunctions.push(createBoundingBox(head.scene, headBBHelperRef, headRef, colors.head));
    }
    if (legLeft.scene) {
        cleanupFunctions.push(createBoundingBox(legLeft.scene, legLeftBBHelperRef, legLeftRef, colors.legs));
        // For the right leg we need to handle the clone differently
        const rightLegScene = legLeft.scene.clone();
        rightLegScene.scale.x = -1; // Apply the same scale as in your render function
        cleanupFunctions.push(createBoundingBox(rightLegScene, legRightBBHelperRef, legRightRef, colors.legs));
    }
    if (armLeft.scene) { //both arms 
        cleanupFunctions.push(createBoundingBox(armLeft.scene, armLeftBBHelperRef, armLeftRef, colors.arms));
        
        const rightArmScene = armLeft.scene.clone();
        rightArmScene.scale.x = -1; // Apply the same scale as in your render function
        cleanupFunctions.push(createBoundingBox(rightArmScene, armRightBBHelperRef, armRightRef, colors.arms));
    }
    if (tail.scene) {
        cleanupFunctions.push(createBoundingBox(tail.scene, tailBBHelperRef, tailRef, colors.tail));
    }
    if (weapon.scene) {//both weapons 
        cleanupFunctions.push(createBoundingBox(weapon.scene, weaponLeftBBHelperRef, armLeftRef, colors.weapons));

        const rightWeaponScene = weapon.scene.clone();
        cleanupFunctions.push(createBoundingBox(rightWeaponScene, weaponRightBBHelperRef, armRightRef, colors.weapons));
    }
    // Combined cleanup function
    return () => {
        cleanupFunctions.forEach(cleanup => {
        if (typeof cleanup === 'function') {
            cleanup();
        }
        });
    };
    }, [
    // Dependencies - rerun if any of these change
    body.scene, 
    head.scene, 
    legLeft.scene, 
    armLeft.scene, 
    tail.scene, 
    weapon.scene
    ]);
  
    // Use ref to track the previous movement state for smoother transitions
    const prevMovingState = useRef({ isMoving, isJumping });
    
    useFrame((state, delta) => {
      if (ref.current) {
        // Base position from props - we'll add vertical bobbing
        const basePosition = [...position];
        
        // Use lookRotation (temporary rotation when movement keys are pressed) or fall back to rotationY
        ref.current.rotation.y = lookRotation !== null ? lookRotation : rotationY; //rotationY
        
        // Determine animation speeds based on sprint status
        const legAnimationSpeed = isSprinting ? 25 : 15;
        const headBobSpeed = isSprinting ? 12 : 7;
        const headBobIntensity = isSprinting ? 0.05 : 0.025;
        const armAnimationSpeed = isSprinting ? 22 : 13; // Slightly different from legs for natural look
        const bodyBobSpeed = isSprinting ? 20 : 12;      // Body bob speed
        const bodyBobIntensity = isSprinting ? 0.1 : 0.06; // How high the body bobs
        
        // Handle body tilt during jumping
        if (bodyRef.current) {
          if (isJumping) {
            // OPTIMIZATION: Apply lerping to body rotation for smoother transitions
            const targetRotX = -0.2;
            bodyRef.current.rotation.x += (targetRotX - bodyRef.current.rotation.x) * 0.15;
          } else {
            bodyRef.current.rotation.x += (0 - bodyRef.current.rotation.x) * 0.15;
          }
        }
        
        // Track state changes for smoother transitions
        const startedMoving = !prevMovingState.current.isMoving && isMoving;
        const stoppedMoving = prevMovingState.current.isMoving && !isMoving;
        
        // Update animation angles only when moving
        if (isMoving) {
          // OPTIMIZATION: Update ref values directly instead of using setState
          legAngle.current = (legAngle.current + delta * legAnimationSpeed) % (Math.PI * 2);
          headBobAngle.current = (headBobAngle.current + delta * headBobSpeed) % (Math.PI * 2);
          tailAngle.current = (tailAngle.current + delta * (isSprinting ? 12 : 7)) % (Math.PI * 2);
          armAngle.current = (armAngle.current + delta * armAnimationSpeed) % (Math.PI * 2);
          bodyBobAngle.current = (bodyBobAngle.current + delta * bodyBobSpeed) % (Math.PI * 2);
          
          // Calculate body bob height - only when not jumping
          if (!isJumping) {
            // Use absolute value of sine to create a "bouncy" effect that only goes up
            const targetBobHeight = Math.abs(Math.sin(bodyBobAngle.current)) * bodyBobIntensity;
            // Smooth the body bob with lerping
            bodyBobHeight.current += (targetBobHeight - bodyBobHeight.current) * 0.2;
          } else {
            // When jumping, gradually reduce any existing bob
            bodyBobHeight.current *= 0.9;
          }
          
          // Apply animation to legs
          if (legLeftRef.current && legRightRef.current) {
            // Increase leg movement range when sprinting
            const legAmplitude = isSprinting ? 0.8 : 0.5;
            
            // OPTIMIZATION: Apply lerping to leg rotations for smoother transitions
            const targetLeftLegRotation = Math.sin(legAngle.current) * legAmplitude;
            const targetRightLegRotation = Math.sin(legAngle.current + Math.PI) * legAmplitude;
            
            legLeftRef.current.rotation.x += (targetLeftLegRotation - legLeftRef.current.rotation.x) * 0.3;
            legRightRef.current.rotation.x += (targetRightLegRotation - legRightRef.current.rotation.x) * 0.3;
          }
          
          // Apply arm animations - opposite phase to the legs for natural cross-body motion
          if (armLeftRef.current && armRightRef.current) {
            // Arm movement range - smaller than legs since they're shorter
            const armAmplitude = isSprinting ? 0.5 : 0.3;
            
            // Arms move in opposite phase to legs for natural cross-body movement
            const targetLeftArmRotation = Math.sin(armAngle.current + Math.PI) * armAmplitude;
            const targetRightArmRotation = Math.sin(armAngle.current) * armAmplitude;
            
            // Apply smoothed rotation
            armLeftRef.current.rotation.x += (targetLeftArmRotation - armLeftRef.current.rotation.x) * 0.25;
            armRightRef.current.rotation.x += (targetRightArmRotation - armRightRef.current.rotation.x) * 0.25;
          }
          
          // Apply head bobbing - only when not jumping
          if (headRef.current && !isJumping) {
            // Use a smoother curve for head bobbing (sine squared)
            const headCurve = Math.sin(headBobAngle.current) * headBobIntensity;
            // OPTIMIZATION: Apply lerping to head rotation for smoother transitions
            headRef.current.rotation.x += (headCurve - headRef.current.rotation.x) * 0.2;
          }
          
          // Apply tail animation
          if (tailRef.current) {
            // Calculate tail motion - should swing horizontally (yaw) with slight vertical component
            const tailSwingHorizontal = Math.sin(tailAngle.current) * (isSprinting ? 0.2 : 0.15);
            const tailSwingVertical = Math.sin(tailAngle.current * 2) * 0.05;
            
            // Apply smooth transition to tail rotation
            tailRef.current.rotation.y += (tailSwingHorizontal - tailRef.current.rotation.y) * 0.15;
            tailRef.current.rotation.x += (tailSwingVertical - tailRef.current.rotation.x) * 0.1;
            
            // During jumps, add upward tail motion
            if (isJumping) {
              const jumpTailLift = 0.2;
              tailRef.current.rotation.x += (jumpTailLift - tailRef.current.rotation.x) * 0.2;
            }
          }
        } else {
          // If just stopped moving, smoothly reset head and leg positions
          if (stoppedMoving || !isMoving) {
            // Reset leg positions with lerping when not moving
            if (legLeftRef.current && legRightRef.current) {
              legLeftRef.current.rotation.x += (0 - legLeftRef.current.rotation.x) * 0.2;
              legRightRef.current.rotation.x += (0 - legRightRef.current.rotation.x) * 0.2;
            }
            
            // Reset arm positions with lerping when not moving
            if (armLeftRef.current && armRightRef.current) {
              armLeftRef.current.rotation.x += (0 - armLeftRef.current.rotation.x) * 0.2;
              armRightRef.current.rotation.x += (0 - armRightRef.current.rotation.x) * 0.2;
            }
            
            // Reset head rotation gradually when stopping
            if (headRef.current) {
              headRef.current.rotation.x += (0 - headRef.current.rotation.x) * 0.2;
            }
            
            // For tail when idle, have subtle idle animation
            if (tailRef.current) {
              tailAngle.current = (tailAngle.current + delta * 2) % (Math.PI * 2);
              const idleTailMotion = Math.sin(tailAngle.current) * 0.05;
              
              // Smooth transition to idle motion
              tailRef.current.rotation.y += (idleTailMotion - tailRef.current.rotation.y) * 0.05;
              tailRef.current.rotation.x += (0 - tailRef.current.rotation.x) * 0.1;
            }
            
            // For arms when idle, very subtle motion
            if (armLeftRef.current && armRightRef.current) {
              armAngle.current = (armAngle.current + delta) % (Math.PI * 2);
              const idleArmMotion = Math.sin(armAngle.current) * 0.03;
              
              // Subtle idle arm motion
              armLeftRef.current.rotation.z += (idleArmMotion - armLeftRef.current.rotation.z) * 0.03;
              armRightRef.current.rotation.z += (-idleArmMotion - armRightRef.current.rotation.z) * 0.03;
            }
            
            // Gradually reduce body bob when stopping
            bodyBobHeight.current *= 0.9;
          }
        }
        
        // Always reset head rotation during jumps to avoid conflicts
        if (isJumping && headRef.current) {
          headRef.current.rotation.x += (0 - headRef.current.rotation.x) * 0.2;
        }
        
        // During jumps, animate arms to extend forward slightly
        if (isJumping && armLeftRef.current && armRightRef.current) {
          const jumpArmPose = -0.3; // Arms extend forward during jump
          armLeftRef.current.rotation.x += (jumpArmPose - armLeftRef.current.rotation.x) * 0.15;
          armRightRef.current.rotation.x += (jumpArmPose - armRightRef.current.rotation.x) * 0.15;
        }
        
        // Apply the body bob to the final position
        const finalPosition = [
          basePosition[0],
          basePosition[1] + bodyBobHeight.current, // Add bob height to Y position
          basePosition[2]
        ];
        
        // Apply final position
        ref.current.position.set(...finalPosition);
        
        // Update previous state tracking
        prevMovingState.current = { isMoving, isJumping };
      }
    });
  
    return (
      <group ref={ref} scale={[0.4,0.4,0.4]} rotation={[0, Math.PI, 0]} position={[0,0,0]}>
        <RigidBody
          colliders = "trimesh"
          type = "kinematicVelocity"
          >
        <group ref={bodyRef}>
          <primitive object={body.scene} position={[0, 0, 0]} />

          <group ref={headRef} position={[0, 2.2, 1.3]}>
            <primitive object={head.scene} />
          </group>
  
          <group ref={legLeftRef} position={[1, 1, 1]}>
            <primitive object={legLeft.scene} position={[0,-1.3,-0.2]} />
          </group>
  
          <group ref={legRightRef} position={[-1, 1, 1]}>
            <primitive object={legLeft.scene.clone()} scale={[-1, 1, 1]} position={[0,-1.3,-0.2]}/>
          </group>
  
          <group ref={armLeftRef} position={[-1.25, 1.3, 1.3]}>
            <primitive object={armLeft.scene} />
            <primitive object={weapon.scene} rotation={[0,-1.5,0]} scale={[0.15,0.15,0.15]} position={[-0.2,0.5,1]}/>
          </group>
  
          <group ref={armRightRef} position={[1.25, 1.3, 1.3]}>
            <primitive object={armLeft.scene.clone()} scale={[-1, 1, 1]} />
            <primitive object={weapon.scene.clone()} rotation={[0,-1.5,0]} scale={[0.15,0.15,0.15]} position={[0.2,0.5,1]}/>
          </group>
  
          <group ref={tailRef} position={[0, 0, 0]}>
            <primitive object={tail.scene}/>
          </group>
        </group>
        </RigidBody>
      </group>
    );
}