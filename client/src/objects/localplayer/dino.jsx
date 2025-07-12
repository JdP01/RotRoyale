import React, {useState, useRef, useMemo, useEffect} from 'react';
import {useGLTF} from '@react-three/drei'; 
import {RigidBody, CapsuleCollider, CuboidCollider} from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import * as THREE from "three";
import { useDinoAnimations } from "./dinoAnimations";
import { useDinoControls } from "./dinoControls";
import { usePlayerState } from "../../logic/PlayerState";

export const Dino = ({ 
    ref: bodyRef, 
    onRotationChange, 
    onCameraPitchChange,
    isNetworkedPlayer = false, 
    networkAnimationState,
    networkPosition,
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
    const { scene: armLeft } = useGLTF('/dino_parts1/left_arm.glb');
    const { scene: tail } = useGLTF('/dino_parts1/dino_tail.glb');
    const { scene: weapon } = useGLTF('/objects/game_glock.glb');
    
    // Clone models for each instance with pre-cloned mirrored parts
    const models = useMemo(() => {
        const bodyModel = Body.clone(true);
        const headModel = Head.clone(true);
        const leftLegModel = LeftLeg.clone(true);
        const rightLegModel = LeftLeg.clone(true); // Pre-clone for right leg
        const armLeftModel = armLeft.clone(true);
        const armRightModel = armLeft.clone(true); // Pre-clone for right arm
        const tailModel = tail.clone(true);
        const weaponLeftModel = weapon.clone(true);
        const weaponRightModel = weapon.clone(true); // Pre-clone for right weapon

        // Ensure shadows are set up for all cloned models
        const allModels = [
            bodyModel, headModel, leftLegModel, rightLegModel, 
            armLeftModel, armRightModel, tailModel, weaponLeftModel, weaponRightModel
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
            Tail: tailModel,
            WeaponLeft: weaponLeftModel,
            WeaponRight: weaponRightModel
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
    
    // Interpolation state for networked players
    const [targetPosition] = useState(new THREE.Vector3());
    const [targetRotation] = useState(new THREE.Quaternion());
    const currentPosition = useRef(new THREE.Vector3());
    const currentRotation = useRef(new THREE.Quaternion());
    const lerpFactor = 0.2;
    
    // Animation hook
    const { updateAdvancedAnimations } = useDinoAnimations();
    
    const isOnFloor = useRef(true);
    
    // Get controller logic - only for local players
    const controls = !isNetworkedPlayer ? useDinoControls(bodyRef, isOnFloor, setIsJumping) : null;
    
    // Get player state for health/stamina (only for local player)
    const { takeDamage } = !isNetworkedPlayer ? usePlayerState() : { takeDamage: () => {} };
    
    // Store previous velocity to detect hard landings
    const previousVelocity = useRef({ x: 0, y: 0, z: 0 });

    // Collision handlers
    const handleCollisionEnter = ({ other }) => {
        console.log("colliding with", other.rigidBodyObject?.name);
        if (other.rigidBodyObject?.name === "floor") {
            isOnFloor.current = true;
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
        if (other.rigidBodyObject?.name === "floor") {
            isOnFloor.current = false;
        }
    };

    // Game Frame Loop 
    useFrame((_, delta) => { 
        if (!bodyRef.current) return;

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
                quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), controls.characterRotation);
                bodyRef.current.setRotation(quaternion, true);
                
                if (onRotationChange) {
                    onRotationChange(controls.cameraRotation);
                }
                
                if (onCameraPitchChange) {
                    onCameraPitchChange(controls.cameraPitch);
                }
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
            <group ref={mainGroupRef} scale={[0.4, 0.4, 0.4]} rotation={[0, Math.PI, 0]}>
                {/* Main body */}
                <primitive object={models.Body} position={[0, 0, 0]} />
            
                {/* Colliders */}
                <CapsuleCollider args={[1, 1.5]} position={[0, 4.55, 2.2]} rotation={[0.8, 0, 0]} restitution={0} />
                <CapsuleCollider args={[0.8, 0.3]} position={[0, 5, -5.3]} rotation={[-1, 0, 0]} restitution={0} />
                <CuboidCollider args={[0.77, 0.6, 1.3]} position={[0, 8.6, 4.2]} rotation={[0, 0, 0]} restitution={0} />
                
                {/* Head */}
                <group ref={headRef} position={[0, 2.2, 1.3]}>
                    <primitive object={models.Head} />
                </group>
                
                {/* Left leg */}
                <group ref={legLeftRef} position={[1, 1, 1]}>
                    <primitive object={models.LeftLeg} position={[0, -1.3, -0.2]} />
                </group>

                {/* Right leg (pre-cloned and mirrored) */}
                <group ref={legRightRef} position={[-1, 1, 1]}>
                    <primitive object={models.RightLeg} scale={[-1, 1, 1]} position={[0, -1.3, -0.2]} />
                </group>

                {/* Left arm with weapon */}
                <group ref={armLeftRef} position={[-1.25, 1.3, 1.3]}>
                    <primitive object={models.ArmLeft} />
                    <primitive 
                        object={models.WeaponLeft} 
                        rotation={[0, -1.5, 0]} 
                        scale={[0.15, 0.15, 0.15]} 
                        position={[-0.2, 0.5, 1]}
                    />
                </group>

                {/* Right arm with weapon (pre-cloned and mirrored) */}
                <group ref={armRightRef} position={[1.25, 1.3, 1.3]}>
                    <primitive object={models.ArmRight} scale={[-1, 1, 1]} />
                    <primitive 
                        object={models.WeaponRight} 
                        rotation={[0, -1.5, 0]} 
                        scale={[0.15, 0.15, 0.15]} 
                        position={[0.2, 0.5, 1]}
                    />
                </group>

                {/* Tail */}
                <group ref={tailRef} position={[0, 0, 0]}>
                    <primitive object={models.Tail} />
                </group>
            </group>
        </RigidBody>
    );
};