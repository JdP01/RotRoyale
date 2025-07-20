import { useKeyboardControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from "three";
import { Controls } from "../world/GameCanvas";
import { useEffect, useRef, useState } from 'react';
import { usePlayerState } from "../../logic/PlayerState";

export const useDinoControls = (bodyRef, isOnFloor, setIsJumping) => {
    // Get camera reference
    const { camera } = useThree();
    
    // Get player state for stamina management
    const { stamina, isExhausted, consumeStamina, regenerateStamina, fireRaycast } = usePlayerState();

    // Movement controls 
    const jump = () => {
        bodyRef.current.applyImpulse({x: 0, y: 25, z: 0});
        setIsJumping(true);
    }

    const jumpPressed = useKeyboardControls((state) => state[Controls.jump]);
    const forwardPressed = useKeyboardControls((state) => state[Controls.forward]);
    const backPressed = useKeyboardControls((state) => state[Controls.back]);
    const leftPressed = useKeyboardControls((state) => state[Controls.left]);
    const rightPressed = useKeyboardControls((state) => state[Controls.right]);
    const sprintPressed = useKeyboardControls((state) => state[Controls.sprint]);
    //const shootPressed = useKeyboardControls((state) => state[Controls.shoot]);
    
    const dir = new THREE.Vector3();
    const [cameraRotation, setCameraRotation] = useState(0); // Camera/mouse rotation (yaw)
    const [cameraPitch, setCameraPitch] = useState(0); // Camera pitch (up/down)
    const [characterRotation, setCharacterRotation] = useState(0); // Visual character rotation
    const [isAiming, setIsAiming] = useState(false); // Right-click aiming state
    const sensitivity = 0.002;

    // Pointer lock setup
    // Replace both the onMouseDown function and the separate shooting useEffect with this single handler:

    useEffect(() => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return;

        const onPointerLockChange = () => {
            if (document.pointerLockElement === canvas) {
                // Pointer lock is active
            } else {
                // Pointer lock is inactive
            }
        };

        const onMouseMove = (event) => {
            if (document.pointerLockElement !== canvas) return;
            
            // Update camera rotation based on horizontal mouse movement (yaw)
            setCameraRotation(prev => prev - event.movementX * sensitivity);
            
            // Update camera pitch based on vertical mouse movement (pitch)
            setCameraPitch(prev => {
                const newPitch = prev + event.movementY * sensitivity;
                // Clamp pitch to prevent over-rotation (looking too far up or down)
                return Math.max(-Math.PI / 2, Math.min(Math.PI / 2, newPitch));
            });
        };

        const onKeyDown = (event) => {
            if (event.key === 'Escape' && document.pointerLockElement === canvas) {
                document.exitPointerLock();
            }
        };

        // COMBINED mouse handler - handles both pointer lock AND shooting
        const onMouseDown = (event) => {
            if (event.button === 0) { // Left mouse button
                if (document.pointerLockElement !== canvas) {
                    // Not locked yet - request pointer locsk
                    canvas.requestPointerLock();
                } else {
                    // Already locked - handle shooting
                    console.log("🔫 SHOOTING!");
                    
                    // Raycast from camera center
                    if (bodyRef.current && camera) {
                        // Get camera position as the start point
                        const cameraPosition = camera.position.clone();
                        
                        // Get camera's forward direction
                        const cameraDirection = new THREE.Vector3();
                        camera.getWorldDirection(cameraDirection);
                        
                        // Calculate end point of the ray (100 units forward from camera)
                        const rayEnd = cameraPosition.clone().add(cameraDirection.clone().multiplyScalar(100));
                        
                        // Trigger raycast visualization from camera center
                        fireRaycast(cameraPosition, rayEnd);
                    }
                }
            } else if (event.button === 2) { // Right mouse button
                if (document.pointerLockElement === canvas) {
                    setIsAiming(true);
                }
            }
        };

        const onMouseUp = (event) => {
            if (event.button === 2) { // Right mouse button release
                setIsAiming(false);
            }
        };

        // Prevent context menu on right click
        const onContextMenu = (event) => {
            event.preventDefault();
        };

        // Add event listeners
        document.addEventListener('pointerlockchange', onPointerLockChange);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('keydown', onKeyDown);
        canvas.addEventListener('mousedown', onMouseDown);
        canvas.addEventListener('mouseup', onMouseUp);
        canvas.addEventListener('contextmenu', onContextMenu);

        // Cleanup
        return () => {
            document.removeEventListener('pointerlockchange', onPointerLockChange);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('keydown', onKeyDown);
            canvas.removeEventListener('mousedown', onMouseDown);
            canvas.removeEventListener('mouseup', onMouseUp);
            canvas.removeEventListener('contextmenu', onContextMenu);
        };
    }, [camera]); // Update dependencies to include camera

// REMOVE the separate shooting useEffect completely - delete lines ~113-120
    
    const handleMovement = (delta, setIsMoving, setIsSprinting) => { 
        dir.set(0, 0, 0);
        let moving = false;
        let sprinting = false;
        
        // Check if can sprint (need stamina and not exhausted)
        const canSprint = sprintPressed && stamina && !isExhausted;
        
        // Calculate forward and right vectors based on camera rotation (for movement)
        const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraRotation);
        const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraRotation);
        
        // Determine character visual rotation based on movement
        let targetCharacterRotation = cameraRotation;
        
        // Apply movement based on camera orientation
        if (forwardPressed) {
            dir.add(forward);
            moving = true;
            targetCharacterRotation = cameraRotation;
            // Face forward direction
        }
        if (backPressed) {
            dir.sub(forward);
            moving = true;
            targetCharacterRotation = cameraRotation + Math.PI;
            // Face backward direction
            
        }
        if (leftPressed) {
            dir.add(right);
            moving = true;
            targetCharacterRotation = cameraRotation + Math.PI / 2;
            // Face left direction
        }
        if (rightPressed) {
            dir.sub(right);
            moving = true;
            // Face right direction
            targetCharacterRotation = cameraRotation - Math.PI / 2;
        }
        if (canSprint) {
                sprinting = true;
                // Consume stamina while sprinting
                consumeStamina(50 * delta); // 50 stamina per second
            }

        // Regenerate stamina when not sprinting
        if (!sprinting && stamina < 100) {
            regenerateStamina(20 * delta); // 25 stamina per second
        }
        
        // ...existing code for diagonal movement...
        // Handle diagonal movement - face the actual movement direction
        if ((forwardPressed || backPressed) && (leftPressed || rightPressed)) {
            let diagonalRotation = cameraRotation;
            if(forwardPressed && (leftPressed && rightPressed)) {
                // If both left and right are pressed with forward, no diagonal movement
                diagonalRotation = cameraRotation + Math.PI;
            }
            else if (backPressed && (leftPressed && rightPressed)) {
                // If both left and right are pressed with backward, no diagonal movement
                diagonalRotation = cameraRotation;
            }
            else if (forwardPressed && leftPressed) {
                // Forward + Left = 45° left of forward
                diagonalRotation = cameraRotation + Math.PI / 4;
            } else if (forwardPressed && rightPressed) {
                // Forward + Right = 45° right of forward
                diagonalRotation = cameraRotation - Math.PI / 4;
            } else if (backPressed && leftPressed) {
                // Backward + Left = 45° left of backward
                diagonalRotation = cameraRotation + Math.PI - Math.PI / 4;
                
            } else if (backPressed && rightPressed) {
                // Backward + Right = 45° right of backward
                diagonalRotation = cameraRotation + Math.PI + Math.PI / 4;
            }
            
            targetCharacterRotation = diagonalRotation;
        }
        
        // Smoothly interpolate character rotation for natural turning
        if (true) {
            // Handle angle wrapping for smooth rotation
            let angleDiff = targetCharacterRotation - characterRotation;
            if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
            if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
            
            const rotationSpeed = 10; // Adjust this to control turning speed
            const newRotation = characterRotation + angleDiff * Math.min(1, delta * rotationSpeed);
            setCharacterRotation(newRotation);
        }
        
        if (jumpPressed && isOnFloor.current) {
            jump();
            console.log("🦖 Jumping!");
        }

        
        setIsMoving(moving);
        setIsSprinting(sprinting && !isExhausted); // Only sprint if not exhausted
        
        if (moving) {
            // Normalize direction and apply speed
            dir.normalize();
            const moveSpeed = (sprinting && !isExhausted) ? 15 : 10; // Fast if sprinting and not exhausted
            dir.multiplyScalar(moveSpeed);
        }

        const vel = bodyRef.current.linvel();
        bodyRef.current.setLinvel({x: dir.x, y: vel.y, z: dir.z}, true);
    };

    return {
        handleMovement,
        cameraRotation,     // For camera positioning (yaw)
        cameraPitch,        // For camera pitch (up/down)
        characterRotation,  // For character visual rotation
        isAiming,          // For aiming state
        jumpPressed,
        forwardPressed,
        backPressed,
        leftPressed,
        rightPressed,
        sprintPressed
    };
};