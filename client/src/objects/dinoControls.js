import { useKeyboardControls } from '@react-three/drei';
import * as THREE from "three";
import { Controls } from "./GameCanvas";
import { useEffect, useRef, useState } from 'react';

export const useDinoControls = (bodyRef, isOnFloor, setIsJumping) => {
    const [isInJumpAction, setIsInJumpAction] = useState(false);

    // Movement controls 
    const jump = () => {
        bodyRef.current.applyImpulse({x: 0, y: 25, z: 0});
        setIsJumping(true);
        setIsInJumpAction(true);
    }

    useEffect(() => {
        let frameCount = 0;
        
        const checkLanding = () => {
            if (isInJumpAction) {
                const vel = bodyRef.current.linvel();
                // Only reset jump state when we're moving downward and near ground
                if (vel.y <= 0 && isOnFloor.current) {
                    setIsInJumpAction(false);
                    setIsJumping(false);
                }
            }
        };

        const interval = setInterval(checkLanding, 16);
        return () => clearInterval(interval);
    }, [isInJumpAction]);

    const jumpPressed = useKeyboardControls((state) => state[Controls.jump]);
    const forwardPressed = useKeyboardControls((state) => state[Controls.forward]);
    const backPressed = useKeyboardControls((state) => state[Controls.back]);
    const leftPressed = useKeyboardControls((state) => state[Controls.left]);
    const rightPressed = useKeyboardControls((state) => state[Controls.right]);
    const sprintPressed = useKeyboardControls((state) => state[Controls.sprint]);
    
    const dir = new THREE.Vector3();
    const [cameraRotation, setCameraRotation] = useState(0); // Camera/mouse rotation
    const [characterRotation, setCharacterRotation] = useState(0); // Visual character rotation
    const sensitivity = 0.002;

    // Pointer lock setup
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
            
            // Update camera rotation based on horizontal mouse movement
            setCameraRotation(prev => prev - event.movementX * sensitivity);
        };

        const onKeyDown = (event) => {
            if (event.key === 'Escape' && document.pointerLockElement === canvas) {
                document.exitPointerLock();
            }
        };

        const onClick = () => {
            if (document.pointerLockElement !== canvas) {
                canvas.requestPointerLock();
            }
        };

        // Add event listeners
        document.addEventListener('pointerlockchange', onPointerLockChange);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('keydown', onKeyDown);
        canvas.addEventListener('click', onClick);

        // Cleanup
        return () => {
            document.removeEventListener('pointerlockchange', onPointerLockChange);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('keydown', onKeyDown);
            canvas.removeEventListener('click', onClick);
        };
    }, []);
    
    const handleMovement = (delta, setIsMoving, setIsSprinting) => { 
        dir.set(0, 0, 0);
        let moving = false;
        
        // Calculate forward and right vectors based on camera rotation (for movement)
        const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraRotation);
        const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraRotation);
        
        // Determine character visual rotation based on movement
        let targetCharacterRotation = cameraRotation;
        
        // Apply movement based on camera orientation
        if (forwardPressed) {
            dir.add(forward);
            moving = true;
            // Face forward direction
            targetCharacterRotation = cameraRotation + Math.PI;
        }
        if (backPressed) {
            dir.sub(forward);
            moving = true;
            // Face backward direction
            targetCharacterRotation = cameraRotation;
        }
        if (leftPressed) {
            dir.add(right);
            moving = true;
            // Face left direction
            targetCharacterRotation = cameraRotation - Math.PI / 2;
        }
        if (rightPressed) {
            dir.sub(right);
            moving = true;
            // Face right direction
            targetCharacterRotation = cameraRotation + Math.PI / 2;
        }
        
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
                diagonalRotation = cameraRotation + Math.PI + Math.PI / 4;
            } else if (forwardPressed && rightPressed) {
                // Forward + Right = 45° right of forward
                diagonalRotation = cameraRotation + Math.PI - Math.PI / 4;
            } else if (backPressed && leftPressed) {
                // Backward + Left = 45° left of backward
                diagonalRotation = cameraRotation - Math.PI / 4;
            } else if (backPressed && rightPressed) {
                // Backward + Right = 45° right of backward
                diagonalRotation = cameraRotation + Math.PI / 4;
            }
            
            targetCharacterRotation = diagonalRotation;
        }
        
        // Smoothly interpolate character rotation for natural turning
        if (moving) {
            // Handle angle wrapping for smooth rotation
            let angleDiff = targetCharacterRotation - characterRotation;
            if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
            if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
            
            const rotationSpeed = 10; // Adjust this to control turning speed
            const newRotation = characterRotation + angleDiff * Math.min(1, delta * rotationSpeed);
            setCharacterRotation(newRotation);
        }
        
        if (jumpPressed && !isInJumpAction && isOnFloor.current) {
            jump();
        }

        
        setIsMoving(moving);
        setIsSprinting(sprintPressed && moving);
        
        if (moving) {
            // Normalize direction and apply speed
            dir.normalize();
            const moveSpeed = (sprintPressed && moving) ? 15 : 10;
            dir.multiplyScalar(moveSpeed);
        }

        const vel = bodyRef.current.linvel();
        bodyRef.current.setLinvel({x: dir.x, y: vel.y, z: dir.z}, true);
    };

    return {
        handleMovement,
        cameraRotation,     // For camera positioning
        characterRotation,  // For character visual rotation
        jumpPressed,
        forwardPressed,
        backPressed,
        leftPressed,
        rightPressed,
        sprintPressed
    };
};