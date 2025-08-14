import React, {useState, useRef, useMemo, useEffect} from 'react';
import {useGLTF} from '@react-three/drei'; 
import {RigidBody, CapsuleCollider, CuboidCollider} from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import * as THREE from "three";
import { useBearAnimations } from "./bearAnimations";
import { useDinoControls } from "../controls";
import { usePlayerState } from "../../../logic/PlayerState";

export const Bear = ({ 
    ref: bodyRef, 
    onRotationChange, 
    onCameraPitchChange,
    onAimingChange,
    onButtonStatesChange, // New callback for sending button states to network
    isNetworkedPlayer = false, 
    networkButtonStates, // Button states from network instead of animation states
    networkPosition,
    networkRotation
}) => { 
    // Refs for body parts
    const legLeftRef = useRef();
    const legRightRef = useRef();
    const headRef = useRef();
    const armLeftRef = useRef();
    const armRightRef = useRef();
    const mainGroupRef = useRef();
    
    // Load all models
    const { scene: Body } = useGLTF('/bear/body.glb');
    const { scene: Head } = useGLTF('/bear/head.glb');
    const { scene: LeftLeg } = useGLTF('/bear/leg_right.glb'); 
    const { scene: armLeft } = useGLTF('/bear/arm_right.glb');
    const { scene: weapon } = useGLTF('/objects/game_glock.glb');
    
    // Clone models for each instance with pre-cloned mirrored parts
    const models = useMemo(() => {
        const bodyModel = Body.clone(true);
        const headModel = Head.clone(true);
        const leftLegModel = LeftLeg.clone(true);
        const rightLegModel = LeftLeg.clone(true); // Pre-clone for right leg
        const armLeftModel = armLeft.clone(true);
        const armRightModel = armLeft.clone(true); // Pre-clone for right arm
        const weaponLeftModel = weapon.clone(true);
        const weaponRightModel = weapon.clone(true); // Pre-clone for right weapon

        // Ensure shadows are set up for all cloned models
        const allModels = [
            bodyModel, headModel, leftLegModel, rightLegModel, 
            armLeftModel, armRightModel, weaponLeftModel, weaponRightModel
        ];
        
        allModels.forEach(model => {
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
            RightLeg: rightLegModel,
            ArmLeft: armLeftModel,
            ArmRight: armRightModel,
            WeaponLeft: weaponLeftModel,
            WeaponRight: weaponRightModel
        };
    }, [Body, Head, LeftLeg, armLeft, weapon]);

    // Animation states - use local states for both local and networked players
    // Networked players will calculate their own animation states from button states
    const [isMoving, setIsMoving] = useState(false);
    const [isSprinting, setIsSprinting] = useState(false);
    const [isJumping, setIsJumping] = useState(false);

    // Always use local animation states - networked players calculate from button states
    const effectiveAnimationState = {
        isMoving,
        isSprinting,
        isJumping
    };
    
    // Interpolation state for networked players
    const [targetPosition] = useState(new THREE.Vector3());
    const [targetRotation] = useState(new THREE.Quaternion());
    const currentPosition = useRef(new THREE.Vector3());
    const currentRotation = useRef(new THREE.Quaternion());
    const lerpFactor = 0.2;
    
    // Animation hook
    const { updateAdvancedAnimations } = useBearAnimations();
    
    // Get controller logic - for local players use actual controls, for networked use simulated controls
    const controls = !isNetworkedPlayer ? useDinoControls(bodyRef, setIsJumping, 6.85) : null;
    
    // For networked players, simulate movement states based on button states
    useEffect(() => {
        if (isNetworkedPlayer && networkButtonStates) {
            const moving = networkButtonStates.forward || networkButtonStates.back || 
                          networkButtonStates.left || networkButtonStates.right;
            const sprinting = moving && networkButtonStates.sprint;
            const jumping = networkButtonStates.jump;
            
            setIsMoving(moving);
            setIsSprinting(sprinting);
            setIsJumping(jumping);
        }
    }, [isNetworkedPlayer, networkButtonStates]);
    
    // Character rotation state for networked players (separate from camera rotation)
    const [networkedCharacterRotation, setNetworkedCharacterRotation] = useState(0);
    
    // Calculate character rotation for networked players based on button states
    useEffect(() => {
        if (isNetworkedPlayer && networkButtonStates && networkRotation !== undefined) {
            const { forward, back, left, right } = networkButtonStates;
            const cameraRotation = networkRotation; // Use network rotation as "camera" direction
            
            // Calculate character visual rotation based on movement direction (same logic as local player)
            let targetCharacterRotation = cameraRotation;
            
            if (forward && !back && !left && !right) {
                // Moving forward - face forward direction
                targetCharacterRotation = cameraRotation;
            } else if (back && !forward && !left && !right) {
                // Moving backward - face backward direction
                targetCharacterRotation = cameraRotation + Math.PI;
            } else if (left && !right && !forward && !back) {
                // Moving left - face left direction
                targetCharacterRotation = cameraRotation + Math.PI / 2;
            } else if (right && !left && !forward && !back) {
                // Moving right - face right direction
                targetCharacterRotation = cameraRotation - Math.PI / 2;
            } else if (forward && left && !back && !right) {
                // Forward + Left diagonal
                targetCharacterRotation = cameraRotation + Math.PI / 4;
            } else if (forward && right && !back && !left) {
                // Forward + Right diagonal
                targetCharacterRotation = cameraRotation - Math.PI / 4;
            } else if (back && left && !forward && !right) {
                // Backward + Left diagonal
                targetCharacterRotation = cameraRotation + Math.PI - Math.PI / 4;
            } else if (back && right && !forward && !left) {
                // Backward + Right diagonal  
                targetCharacterRotation = cameraRotation + Math.PI + Math.PI / 4;
            }
            
            setNetworkedCharacterRotation(targetCharacterRotation);
        }
    }, [isNetworkedPlayer, networkButtonStates, networkRotation]);
    
    // For local players, send button states to network
    useEffect(() => {
        if (!isNetworkedPlayer && controls && onButtonStatesChange) {
            onButtonStatesChange(controls.buttonStates);
        }
    }, [controls?.buttonStates, isNetworkedPlayer, onButtonStatesChange]);
    
    // Pass aiming state up to parent component
    useEffect(() => {
        if (!isNetworkedPlayer && controls && onAimingChange) {
            onAimingChange(controls.isAiming);
        }
    }, [controls?.isAiming, isNetworkedPlayer, onAimingChange]);
    
    // Get player state for health/stamina (only for local player)
    const { takeDamage } = !isNetworkedPlayer ? usePlayerState() : { takeDamage: () => {} };
    
    // Store previous velocity to detect hard landings
    const previousVelocity = useRef({ x: 0, y: 0, z: 0 });

    // Collision handlers
    const handleCollisionEnter = ({ other }) => {
        console.log("colliding with", other.rigidBodyObject?.name);
        if (other.rigidBodyObject?.name === "floor") {
            setIsJumping(false);
            
            // Check for fall damage (only for local player)
            if (!isNetworkedPlayer && bodyRef.current) {
                const fallSpeed = Math.abs(previousVelocity.current.y);
                
                if (fallSpeed > 20) {
                    const damage = (fallSpeed - 20) * 0.5;
                    takeDamage(damage, 'fall');
                }
            }
        }
    };

    const handleCollisionExit = ({ other }) => {
        // Floor collision exit no longer needed for jump logic
    };

    // Game Frame Loop 
    useFrame((_, delta) => { 
        if (!bodyRef.current) return;
        //console.log("Location:", bodyRef.current.translation());
        if (!isNetworkedPlayer && controls) {
            // Handle local player controls
            controls.handleMovement(delta, setIsMoving, setIsSprinting);
            
            // Store velocity for fall damage detection
            previousVelocity.current = bodyRef.current.linvel();
        } else if (isNetworkedPlayer) {
            // Interpolate networked player position and rotation
            if (targetPosition && targetRotation) {
                currentPosition.current.lerp(targetPosition, lerpFactor);
                currentRotation.current.slerp(targetRotation, lerpFactor);
                
                bodyRef.current.setTranslation(currentPosition.current, true);
                bodyRef.current.setRotation(currentRotation.current, true);
            }
        }
        
        // Apply animations using effective animation state
        const bodyBobHeight = updateAdvancedAnimations(delta, effectiveAnimationState, {
            legLeftRef,
            legRightRef,
            headRef,
            armLeftRef,
            armRightRef,
            mainGroupRef
        });

        // Apply body bob and rotation
        if (mainGroupRef.current) {
            mainGroupRef.current.position.y = bodyBobHeight;
            
            if (!isNetworkedPlayer && controls) {
                // Local player rotation logic
                const quaternion = new THREE.Quaternion();
                quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), controls.characterRotation);
                bodyRef.current.setRotation(quaternion, true);
                
                if (onRotationChange) {
                    onRotationChange(controls.cameraRotation);
                }
                
                if (onCameraPitchChange) {
                    onCameraPitchChange(controls.cameraPitch);
                }
            } else if (isNetworkedPlayer) {
                // Networked player rotation logic - use calculated character rotation
                const quaternion = new THREE.Quaternion();
                quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), networkedCharacterRotation);
                bodyRef.current.setRotation(quaternion, true);
            }
        }
    });

    // Effects for networked player position/rotation updates
    useEffect(() => {
        if (isNetworkedPlayer && networkPosition && bodyRef.current) {
            // Set initial position for networked players
            bodyRef.current.setTranslation(networkPosition);
            currentPosition.current.set(networkPosition.x, networkPosition.y, networkPosition.z);
            targetPosition.set(networkPosition.x, networkPosition.y, networkPosition.z);
        }
    }, [isNetworkedPlayer]);

    useEffect(() => {
        if (isNetworkedPlayer && networkPosition) {
            targetPosition.set(networkPosition.x, networkPosition.y, networkPosition.z);
        }
    }, [isNetworkedPlayer, networkPosition]);

    useEffect(() => {
        if (isNetworkedPlayer && networkRotation !== undefined) {
            targetRotation.setFromEuler(new THREE.Euler(0, networkRotation, 0));
            // Initialize current rotation on first update
            if (currentRotation.current.lengthSq() === 0) {
                currentRotation.current.copy(targetRotation);
            }
        }
    }, [isNetworkedPlayer, networkRotation]);

    return (
        <RigidBody 
            ref={bodyRef}
            position={isNetworkedPlayer ? [0, 0, 0] : [2, 3, 0]}
            onCollisionEnter={handleCollisionEnter}
            onCollisionExit={handleCollisionExit}
            enabledRotations={[false, false, false]}
            type="dynamic"
            colliders={false} 
            interpolate={true}
            gravityScale={5}
            friction={0}
        >
            <group ref={mainGroupRef} scale={[0.5, 0.5, 0.5]} rotation={[0, 0, 0]}>
                {/* Main body */}
                <primitive object={models.Body} position={[0.1, 0.7, 1]} scale={[1,1,1]} />
            
                {/* Colliders */}
                <CapsuleCollider args={[0.6, 1.3]} position={[0, 7, 2.2]} rotation={[0, 0, 0]} restitution={0} /> {/*main collider*/}

                
                {/* Head */}
                <group ref={headRef} position={[0.2, 0.7, 1]}>
                    <primitive object={models.Head} />
                </group>
                
                {/* Left leg */}
                <group ref={legLeftRef} position={[0.8, 3, 1.15]}>
                    <primitive object={models.LeftLeg} position={[0, -2.3, -0.2]} />
                </group>

                {/* Right leg (pre-cloned and mirrored) */}
                <group ref={legRightRef} position={[-0.8, 3, 1.15]}>
                    <primitive object={models.RightLeg} scale={[-1, 1, 1]} position={[0, -2.3, -0.2]} />
                </group>

                {/* Left arm with weapon */}
                <group ref={armLeftRef} position={[-0.8, 3.3, 0.6]}> {/*position set twice to adjust for rotation axis*/}
                    <primitive object={models.ArmLeft} position ={[0,-2.6,0]}rotation ={[0.15,0,0]}/>
                    <primitive 
                        object={models.WeaponLeft} 
                        rotation={[0, -1.5, 0]} 
                        scale={[0.13, 0.13, 0.13]} 
                        position={[-0.2, 0.15, 2]}
                    />
                </group>

                {/* Right arm with weapon (pre-cloned and mirrored) */}
                <group ref={armRightRef} position={[0.8, 3.3, 0.6]}> {/*position set twice to adjust for rotation axis*/}
                    <primitive object={models.ArmRight} scale={[-1, 1, 1]} position={[0,-2.6,0]} rotation ={[0.15,0,0]}/>
                    <primitive 
                        object={models.WeaponRight} 
                        rotation={[0, -1.5, 0]} 
                        scale={[0.13, 0.13, 0.13]} 
                        position={[0.2, 0.15, 2]}
                    />
                </group>
            </group>
        </RigidBody>
    );
};