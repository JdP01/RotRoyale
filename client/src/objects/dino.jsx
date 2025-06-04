import React, {useState, useRef, useMemo, useEffect} from 'react';
import {useGLTF} from '@react-three/drei'; 
import {RigidBody, CapsuleCollider} from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import * as THREE from "three";
import { useDinoAnimations } from "./dinoAnimations";
import { useDinoControls } from "./dinoControls";

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
    const { scene: Body } = useGLTF('/dino_parts1/dino_body.glb');
    const { scene: Head } = useGLTF('/dino_parts1/dino_head.glb');
    const { scene: LeftLeg } = useGLTF('/dino_parts1/left_leg.glb'); 
    const { scene: armLeft } = useGLTF('/dino_parts1/left_arm.glb')
    const { scene: tail } = useGLTF('/dino_parts1/dino_tail.glb')
    const { scene: weapon } = useGLTF('/objects/game_glock.glb')
    
    useEffect(() => {
        Body.traverse((child)=> { 
            if(child.isMesh){
                Body.castShadow = true;
                Body.receiveShadow = true;
            }
        })
    }, [Body]);
    // Animation states
    const [isMoving, setIsMoving] = useState(false);
    const [isSprinting, setIsSprinting] = useState(false);
    const [isJumping, setIsJumping] = useState(false);
    
    // Animation hook
    const { updateAdvancedAnimations } = useDinoAnimations();

    const isOnFloor = useRef(true);
    
    // Get controller logic - now returns both camera and character rotations
    const { handleMovement, cameraRotation, characterRotation } = useDinoControls(bodyRef, isOnFloor, setIsJumping);

    // Game Frame Loop 
    useFrame((_, delta) => { 
        if (!bodyRef.current) return;
        
        handleMovement(delta, setIsMoving, setIsSprinting);
        
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
            
            // Use characterRotation for visual appearance
            const quaternion = new THREE.Quaternion();
            quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0), characterRotation);
            bodyRef.current.setRotation(quaternion, true);
            
            // Notify parent component of CAMERA rotation change for camera positioning
            if (onRotationChange) {
                onRotationChange(cameraRotation);
            }
        }
    });

    return( 
        <>
        <RigidBody ref={bodyRef}
            position={[2, 3, 0]} 
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
            colliders = "ball"
            interpolate={true}
            gravityScale={2}
        >

            <group ref={mainGroupRef} scale={[0.4, 0.4, 0.4]} rotation={[0, Math.PI, 0]} >

                <primitive object={Body} position={[0, 0, 0]}  metalness={0} roughness={1}/>
                
                <group ref={headRef} position={[0, 2.2, 1.3]} >
                    <primitive object={Head}  />
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