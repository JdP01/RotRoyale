import React, {useState, useRef, useMemo, useEffect} from 'react';
import {useGLTF} from '@react-three/drei'; 
import {RigidBody, CapsuleCollider, CuboidCollider} from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import * as THREE from "three";
import { useDinoAnimations } from "./dinoAnimations";
import { useDinoControls } from "./dinoControls";
import { usePlayerState } from "../game/PlayerState";

export const Dino = ({ 
    ref: bodyRef, 
    onRotationChange, 
    isNetworkedPlayer = false, 
    networkAnimationState,
    networkPosition,  // Add these new props
    networkRotation
}) => { 
    // Refs for body parts
    const legLeftRef = useRef();
    const legRightRef = useRef();
    const headRef = useRef();
    const tailRef = useRef();
    const armLeftRef = useRef();
    const armRightRef = useRef();
    const mainGroupRef = useRef();
    
    // Load all models
    const { scene: Body } = useGLTF('/dino_parts1/dino_body.glb');
    const { scene: Head } = useGLTF('/dino_parts1/dino_head.glb');
    const { scene: LeftLeg } = useGLTF('/dino_parts1/left_leg.glb'); 
    const { scene: armLeft } = useGLTF('/dino_parts1/left_arm.glb')
    const { scene: tail } = useGLTF('/dino_parts1/dino_tail.glb')
    const { scene: weapon } = useGLTF('/objects/game_glock.glb')
    
    // Clone models for each instance
    const models = useMemo(() => {
        const bodyModel = Body.clone(true);
        const headModel = Head.clone(true);
        const leftLegModel = LeftLeg.clone(true);
        const armLeftModel = armLeft.clone(true);
        const tailModel = tail.clone(true);
        const weaponModel = weapon.clone(true);

        // Ensure shadows are set up for cloned models
        [bodyModel, headModel, leftLegModel, armLeftModel, tailModel, weaponModel].forEach(model => {
            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
        });

        return {
            Body: bodyModel,
            Head: headModel,
            LeftLeg: leftLegModel,
            armLeft: armLeftModel,
            tail: tailModel,
            weapon: weaponModel
        };
    }, [Body, Head, LeftLeg, armLeft, tail, weapon]);

    // Animation states - use network states if provided, otherwise use local states
    const [isMoving, setIsMoving] = useState(false);
    const [isSprinting, setIsSprinting] = useState(false);
    const [isJumping, setIsJumping] = useState(false);

    // Use network animation states if this is a networked player
    const effectiveAnimationState = isNetworkedPlayer ? networkAnimationState : {
        isMoving,
        isSprinting,
        isJumping
    };
    
    // Add interpolation state for networked players
    const [targetPosition] = useState(new THREE.Vector3());
    const [targetRotation] = useState(new THREE.Quaternion());
    const currentPosition = useRef(new THREE.Vector3());
    const currentRotation = useRef(new THREE.Quaternion());
    const lerpFactor = 0.2; // Adjust this value to control smoothing (0.1 to 0.3 recommended)
    
    // Animation hook
    const { updateAdvancedAnimations } = useDinoAnimations();
    
    const isOnFloor = useRef(true);
    
    // Get controller logic - now returns both camera and character rotations
    const { handleMovement, cameraRotation, characterRotation } = useDinoControls(bodyRef, isOnFloor, setIsJumping);

    // Only use controls if not a networked player
    const controls = !isNetworkedPlayer ? useDinoControls(bodyRef, isOnFloor, setIsJumping) : null;
    
    // Get player state for health/stamina (only for local player)
    const { takeDamage } = !isNetworkedPlayer ? usePlayerState() : { takeDamage: () => {} };
    
    // Store previous velocity to detect hard landings
    const previousVelocity = useRef({ x: 0, y: 0, z: 0 });

    // Game Frame Loop 
    useFrame((_, delta) => { 
        if (!bodyRef.current) return;

        if (!isNetworkedPlayer) {
            // Handle local player controls
            controls.handleMovement(delta, setIsMoving, setIsSprinting);
            
            // Store velocity for fall damage detection
            if (bodyRef.current) {
                previousVelocity.current = bodyRef.current.linvel();
            }
        } else {
            // Interpolate networked player position and rotation
            currentPosition.current.lerp(targetPosition, lerpFactor);
            currentRotation.current.slerp(targetRotation, lerpFactor);
            
            bodyRef.current.setTranslation(currentPosition.current, true);
            bodyRef.current.setRotation(currentRotation.current, true);
        }
        
        // Apply animations using effective animation state for both local and networked players
        const bodyBobHeight = updateAdvancedAnimations(delta, effectiveAnimationState, {
            legLeftRef,
            legRightRef,
            headRef,
            tailRef,
            armLeftRef,
            armRightRef,
            mainGroupRef
        });

        // Apply body bob and rotation
        if (mainGroupRef.current) {
            mainGroupRef.current.position.y = bodyBobHeight;
            
            if (!isNetworkedPlayer && controls) {
                const quaternion = new THREE.Quaternion();
                quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0), controls.characterRotation);
                bodyRef.current.setRotation(quaternion, true);
                
                if (onRotationChange) {  // Fixed missing parenthesis
                    onRotationChange(controls.cameraRotation);
                }
            }
        }
    });

    // Update effect to immediately set initial position
    useEffect(() => {
        if (isNetworkedPlayer && networkPosition && bodyRef.current) {
            // Immediately set the initial position
            bodyRef.current.setTranslation(networkPosition);
            currentPosition.current.set(networkPosition.x, networkPosition.y, networkPosition.z);
            targetPosition.set(networkPosition.x, networkPosition.y, networkPosition.z);
        }
    }, [isNetworkedPlayer]); // Only run on initial mount for networked players

    // Separate effect for position updates
    useEffect(() => {
        if (isNetworkedPlayer && networkPosition) {
            targetPosition.set(networkPosition.x, networkPosition.y, networkPosition.z);
        }
    }, [isNetworkedPlayer, networkPosition]);

    useEffect(() => {
        if (isNetworkedPlayer && networkRotation) {
            targetRotation.setFromEuler(new THREE.Euler(0, networkRotation, 0));
            // Initialize current rotation on first update
            if (currentRotation.current.lengthSq() === 0) {
                currentRotation.current.copy(targetRotation);
            }
        }
    }, [isNetworkedPlayer, networkRotation]);

    return( 
        <>
        <RigidBody ref={bodyRef}
            position={isNetworkedPlayer ? [0, 0, 0] : [2, 3, 0]} // Start at origin for networked players
            onCollisionEnter={({other}) => { 
                console.log("colliding with", other.rigidBodyObject?.name);
                if (other.rigidBodyObject.name === "floor") {
                    isOnFloor.current = true;
                    setIsJumping(false); // Reset jumping when landing
                    
                    // Check for fall damage (only for local player)
                    if (!isNetworkedPlayer && bodyRef.current) {
                        const currentVelocity = bodyRef.current.linvel();
                        const fallSpeed = Math.abs(previousVelocity.current.y);
                        
                        // If falling fast (adjust threshold as needed)
                        if (fallSpeed > 20) {
                            const damage = (fallSpeed - 20) * 1/2; // Scale damage
                            takeDamage(damage, 'fall');
                        }
                    }
                }
            }}
            onCollisionExit={({other}) => { 
                if (other.rigidBodyObject.name === "floor") {
                    isOnFloor.current = false;
                }
            }}
            enabledRotations={[false, false, false]}
            type="dynamic"
            colliders = {false} 
            interpolate={true}
            gravityScale={5}
            friction={0}
        >

            <group ref={mainGroupRef} scale={[0.4, 0.4, 0.4]} rotation={[0, Math.PI, 0]} >

                <primitive object={models.Body} position={[0, 0, 0]}  metalness={0} roughness={1}/>
            
                <CapsuleCollider args={[1, 1.5]} position={[0, 4.55, 2.2]} rotation={[0.8, 0, 0]} restitution={0} />
                <CapsuleCollider args ={[0.8,0.3]} position ={[0,5,-5.3]} rotation = {[-1, 0, 0]} restitution={0} />
                <CuboidCollider args={[0.77, 0.6, 1.3]} position={[0, 8.6, 4.2]} rotation={[0, 0, 0]} restitution={0}/>
                <group ref={headRef} position={[0, 2.2, 1.3]} >
                    <primitive object={models.Head} />
                </group>
                <group ref={legLeftRef} position={[1, 1, 1]}>
                    <primitive object={models.LeftLeg} position={[0, -1.3, -0.2]} />
                </group>

                <group ref={legRightRef} position={[-1, 1, 1]}>
                    <primitive object={models.LeftLeg.clone()} scale={[-1, 1, 1]} position={[0, -1.3, -0.2]} />
                </group>

                <group ref={armLeftRef} position={[-1.25, 1.3, 1.3]}>
                    <primitive object={models.armLeft} />
                    <primitive object={models.weapon} rotation={[0, -1.5, 0]} scale={[0.15, 0.15, 0.15]} position={[-0.2, 0.5, 1]}/>
                </group>

                <group ref={armRightRef} position={[1.25, 1.3, 1.3]}>
                    <primitive object={models.armLeft.clone()} scale={[-1, 1, 1]} />
                    <primitive object={models.weapon.clone()} rotation={[0, -1.5, 0]} scale={[0.15, 0.15, 0.15]} position={[0.2, 0.5, 1]}/>
                </group>

                <group ref={tailRef} position={[0, 0, 0]}>
                    <primitive object={models.tail}/>
                </group>
            </group>
        </RigidBody>
        </>
    );
};