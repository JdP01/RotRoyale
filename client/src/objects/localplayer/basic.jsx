import React, {useState, useRef, useMemo, useEffect} from 'react';
import {useGLTF} from '@react-three/drei'; 
import {RigidBody, CapsuleCollider, CuboidCollider} from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import * as THREE from "three";
import { useBasicAnimations } from "./basicAnimation";
import { useDinoControls } from "./controls";
import { usePlayerState } from "../../logic/PlayerState";
import characterDefs from './basicDef.json';

export const BasicCharacter = ({ 
    characterType, // 'bear' or 'dino'
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
    // Get character configuration from JSON
    const config = characterDefs[characterType];
    if (!config) {
        console.error(`Character type "${characterType}" not found in configuration`);
        return null;
    }
    
    // Refs for body parts
    const legLeftRef = useRef();
    const legRightRef = useRef();
    const headRef = useRef();
    const armLeftRef = useRef();
    const armRightRef = useRef();
    const tailRef = useRef();
    const mainGroupRef = useRef();
    
    // Load all models based on configuration
    const bodyParts = config.bodyParts;
    const loadedModels = {};
    
    // Safely load models - only load if path exists in config
    if (bodyParts.body) {
        const { scene: Body } = useGLTF(bodyParts.body);
        loadedModels.Body = Body;
    }
    if (bodyParts.head) {
        const { scene: Head } = useGLTF(bodyParts.head);
        loadedModels.Head = Head;
    }
    if (bodyParts.leftLeg) {
        const { scene: LeftLeg } = useGLTF(bodyParts.leftLeg);
        loadedModels.LeftLeg = LeftLeg;
    }
    if (bodyParts.leftArm) {
        const { scene: LeftArm } = useGLTF(bodyParts.leftArm);
        loadedModels.LeftArm = LeftArm;
    }
    if (bodyParts.tail) {
        const { scene: Tail } = useGLTF(bodyParts.tail);
        loadedModels.Tail = Tail;
    }
    if (bodyParts.weapon) {
        const { scene: Weapon } = useGLTF(bodyParts.weapon);
        loadedModels.Weapon = Weapon;
    }
    
    // Clone models for each instance with pre-cloned mirrored parts
    const models = useMemo(() => {
        const clonedModels = {};
        
        // Clone body parts if they exist
        if (loadedModels.Body) {
            clonedModels.Body = loadedModels.Body.clone(true);
        }
        if (loadedModels.Head) {
            clonedModels.Head = loadedModels.Head.clone(true);
        }
        if (loadedModels.LeftLeg) {
            clonedModels.LeftLeg = loadedModels.LeftLeg.clone(true);
            clonedModels.RightLeg = loadedModels.LeftLeg.clone(true); // Pre-clone for right leg
        }
        if (loadedModels.LeftArm) {
            clonedModels.ArmLeft = loadedModels.LeftArm.clone(true);
            clonedModels.ArmRight = loadedModels.LeftArm.clone(true); // Pre-clone for right arm
        }
        if (loadedModels.Tail) {
            clonedModels.Tail = loadedModels.Tail.clone(true);
        }
        if (loadedModels.Weapon) {
            clonedModels.WeaponLeft = loadedModels.Weapon.clone(true);
            clonedModels.WeaponRight = loadedModels.Weapon.clone(true); // Pre-clone for right weapon
        }

        // Ensure shadows are set up for all cloned models
        Object.values(clonedModels).forEach(model => {
            if (model) {
                model.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
            }
        });

        return clonedModels;
    }, [loadedModels]);

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
    const lerpFactor = config.movement.lerpFactor;
    
    // Animation hook
    const { updateAdvancedAnimations } = useBasicAnimations();
    
    // Get controller logic - for local players use actual controls, for networked use simulated controls
    const controls = !isNetworkedPlayer ? useDinoControls(bodyRef, setIsJumping, config.movement.maxGroundDistance) : null;
    
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
            //setIsJumping(false);
            
            // Check for fall damage (only for local player)
            if (!isNetworkedPlayer && bodyRef.current) {
                const fallSpeed = Math.abs(previousVelocity.current.y);
                
                if (fallSpeed > config.movement.fallDamageThreshold) {
                    const damage = (fallSpeed - config.movement.fallDamageThreshold) * config.movement.fallDamageMultiplier;
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
        
        // Apply animations using effective animation state and config
        const bodyBobHeight = updateAdvancedAnimations(delta, effectiveAnimationState, {
            legLeftRef,
            legRightRef,
            headRef,
            armLeftRef,
            armRightRef,
            tailRef,
            mainGroupRef
        }, config.animations);

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
            position={isNetworkedPlayer ? [0, 0, 0] : config.physics.position}
            onCollisionEnter={handleCollisionEnter}
            onCollisionExit={handleCollisionExit}
            enabledRotations={config.physics.enabledRotations}
            type="dynamic"
            colliders={false} 
            interpolate={config.physics.interpolate}
            gravityScale={config.physics.gravityScale}
            friction={config.physics.friction}
        >
            <group ref={mainGroupRef} scale={config.scale.main} rotation={[0, 0, 0]}>
                {/* Main body */}
                {models.Body && (
                    <primitive 
                        object={models.Body} 
                        position={config.positions.body} 
                        scale={config.scale.body}
                        rotation={config.rotations.body}
                    />
                )}
            
                {/* Colliders */}
                {config.colliders.main.type === 'capsule' && (
                    <CapsuleCollider 
                        args={config.colliders.main.args} 
                        position={config.colliders.main.position} 
                        rotation={config.colliders.main.rotation} 
                        restitution={config.colliders.main.restitution} 
                    />
                )}
                {config.colliders.main.type === 'cuboid' && (
                    <CuboidCollider 
                        args={config.colliders.main.args} 
                        position={config.colliders.main.position} 
                        rotation={config.colliders.main.rotation} 
                        restitution={config.colliders.main.restitution} 
                    />
                )}

                {/* Secondary collider (if exists) */}
                {config.colliders.secondary && config.colliders.secondary.type === 'capsule' && (
                    <CapsuleCollider 
                        args={config.colliders.secondary.args} 
                        position={config.colliders.secondary.position} 
                        rotation={config.colliders.secondary.rotation} 
                        restitution={config.colliders.secondary.restitution} 
                    />
                )}
                {config.colliders.secondary && config.colliders.secondary.type === 'cuboid' && (
                    <CuboidCollider 
                        args={config.colliders.secondary.args} 
                        position={config.colliders.secondary.position} 
                        rotation={config.colliders.secondary.rotation} 
                        restitution={config.colliders.secondary.restitution} 
                    />
                )}

                {/* Tertiary collider (if exists) */}
                {config.colliders.tertiary && config.colliders.tertiary.type === 'capsule' && (
                    <CapsuleCollider 
                        args={config.colliders.tertiary.args} 
                        position={config.colliders.tertiary.position} 
                        rotation={config.colliders.tertiary.rotation} 
                        restitution={config.colliders.tertiary.restitution} 
                    />
                )}
                {config.colliders.tertiary && config.colliders.tertiary.type === 'cuboid' && (
                    <CuboidCollider 
                        args={config.colliders.tertiary.args} 
                        position={config.colliders.tertiary.position} 
                        rotation={config.colliders.tertiary.rotation} 
                        restitution={config.colliders.tertiary.restitution} 
                    />
                )}

                {/* Head */}
                {models.Head && (
                    <group ref={headRef} position={config.positions.head}>
                        <primitive 
                            object={models.Head} 
                            scale={config.scale.head}
                            rotation={config.rotations.head}
                        />
                    </group>
                )}
                
                {/* Left leg */}
                {models.LeftLeg && (
                    <group ref={legLeftRef} position={config.positions.leftLeg}>
                        <primitive 
                            object={models.LeftLeg} 
                            position={config.positions.leftLegOffset}
                            scale={config.scale.leftLeg}
                            rotation={config.rotations.leftLeg}
                        />
                    </group>
                )}

                {/* Right leg (pre-cloned and mirrored) */}
                {models.RightLeg && (
                    <group ref={legRightRef} position={config.positions.rightLeg}>
                        <primitive 
                            object={models.RightLeg} 
                            scale={config.scale.rightLeg} 
                            position={config.positions.rightLegOffset}
                            rotation={config.rotations.rightLeg}
                        />
                    </group>
                )}

                {/* Left arm with weapon */}
                {models.ArmLeft && (
                    <group ref={armLeftRef} position={config.positions.leftArm}>
                        <primitive 
                            object={models.ArmLeft} 
                            position={config.positions.leftArmOffset}
                            rotation={config.rotations.leftArm}
                            scale={config.scale.leftArm}
                        />
                        {models.WeaponLeft && (
                            <primitive 
                                object={models.WeaponLeft} 
                                rotation={config.rotations.weaponLeft} 
                                scale={config.scale.weaponLeft} 
                                position={config.positions.weaponLeft}
                            />
                        )}
                    </group>
                )}

                {/* Right arm with weapon (pre-cloned and mirrored) */}
                {models.ArmRight && (
                    <group ref={armRightRef} position={config.positions.rightArm}>
                        <primitive 
                            object={models.ArmRight} 
                            scale={config.scale.rightArm} 
                            position={config.positions.rightArmOffset} 
                            rotation={config.rotations.rightArm}
                        />
                        {models.WeaponRight && (
                            <primitive 
                                object={models.WeaponRight} 
                                rotation={config.rotations.weaponRight} 
                                scale={config.scale.weaponRight} 
                                position={config.positions.weaponRight}
                            />
                        )}
                    </group>
                )}

                {/* Tail (optional) */}
                {models.Tail && (
                    <group ref={tailRef} position={config.positions.tail}>
                        <primitive 
                            object={models.Tail}
                            scale={config.scale.tail}
                            rotation={config.rotations.tail}
                        />
                    </group>
                )}
            </group>
        </RigidBody>
    );
};

// Legacy export for backward compatibility
export const Bear = (props) => <BasicCharacter {...props} characterType="bear" />;

// Export for Dino character type
export const Dino = (props) => <BasicCharacter {...props} characterType="dino" />;