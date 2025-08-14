import { useKeyboardControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import {useRapier} from '@react-three/rapier';
import * as THREE from "three";
import { Controls } from "../world/GameCanvas";
import { useEffect, useRef, useState } from 'react';
import { usePlayerState } from "../../logic/PlayerState";

export const useDinoControls = (bodyRef, setIsJumping, maxDistance = 0.16) => {
    // Get camera reference
    const { camera } = useThree();
    
    // Get player state for stamina management
    const { stamina, isExhausted, consumeStamina, regenerateStamina, fireRaycast } = usePlayerState();

    // Stamina regeneration state
    const lastRegenTime = useRef(0);
    const canSprintAfterExhaustion = useRef(true);
    const sprintKeyPressed = useRef(false);
    const sprintKeyValidated = useRef(false);
    const staminaDepletionTime = useRef(0);
    const regenerationDelayActive = useRef(false);

    // Movement controls 
    const jump = () => {
        if (!bodyRef.current) return;
        setIsJumping(true);
        bodyRef.current.applyImpulse({x: 0, y: 25, z: 0});
    }

    // Raycasting for ground detection
    const {rapier,world} = useRapier();

    const isNearGround = () => {
        const body = bodyRef.current; 
        if (!body) return false;

        const pos = body.translation();
        const rayOrigin = { x: pos.x, y: pos.y, z: pos.z };
        const rayDir = { x: 0, y: -10, z: 0 };
        const ray = new rapier.Ray(rayOrigin, rayDir);

        // Exclude the character's own collider
        const characterCollider = body.collider(0);
        const hit = world.castRay(ray, maxDistance, true, undefined, undefined, characterCollider);

        if (hit) {
            const collider = world.getCollider(hit);
            const parentRigidBody = collider?.parent();
            const objectInfo = parentRigidBody?.userData?.name || "Unnamed object";
            
            //console.log("HIT DETECTED!");
            //console.log("- Object:", objectInfo);
            //console.log("- Distance (toi):", hit.toi);
            //console.log("- Hit collider handle:", collider.handle);
            return true;
            
        }

        console.log("No hit detected");
        return false;
    };


    const jumpPressed = useKeyboardControls((state) => state[Controls.jump]);
    const forwardPressed = useKeyboardControls((state) => state[Controls.forward]);
    const backPressed = useKeyboardControls((state) => state[Controls.back]);
    const leftPressed = useKeyboardControls((state) => state[Controls.left]);
    const rightPressed = useKeyboardControls((state) => state[Controls.right]);
    const sprintPressed = useKeyboardControls((state) => state[Controls.sprint]);
    
    // Track button states for networking
    const [buttonStates, setButtonStates] = useState({
        forward: false,
        back: false,
        left: false,
        right: false,
        jump: false,
        sprint: false
    });
    
    // Update button states when keys change
    useEffect(() => {
        // Track sprint key state changes for validation
        const wasPressed = sprintKeyPressed.current;
        sprintKeyPressed.current = sprintPressed;
        
        // Sprint key validation logic
        if (!wasPressed && sprintPressed) {
            // Key just pressed - validate if sprinting is allowed
            if (stamina >= 20 && !regenerationDelayActive.current) {
                sprintKeyValidated.current = true;
            } else {
                sprintKeyValidated.current = false; // Key press ignored
            }
        } else if (wasPressed && !sprintPressed) {
            // Key just released - reset validation
            sprintKeyValidated.current = false;
        }
        
        setButtonStates({
            forward: forwardPressed,
            back: backPressed,
            left: leftPressed,
            right: rightPressed,
            jump: jumpPressed,
            sprint: sprintPressed
        });
    }, [forwardPressed, backPressed, leftPressed, rightPressed, jumpPressed, sprintPressed, stamina]);
    const [isCurrentlySprinting, setIsCurrentlySprinting] = useState(false); 

    const dir = new THREE.Vector3();
    const [cameraRotation, setCameraRotation] = useState(0); // Camera/mouse rotation (yaw)
    const [cameraPitch, setCameraPitch] = useState(0); // Camera pitch (up/down)
    const [characterRotation, setCharacterRotation] = useState(0); // Visual character rotation
    const [isAiming, setIsAiming] = useState(false); // Right-click aiming state
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

        // once, reuse this
        const raycaster = new THREE.Raycaster();
        const ndcCenter = new THREE.Vector2(0, 0); // screen center

        const onMouseDown = (event) => {
        if (event.button === 0) {
            if (document.pointerLockElement !== canvas) {
            canvas.requestPointerLock();
            } else {
            // ensure controls/camera are up-to-date this frame

            // Build ray from the camera's *view center*
            raycaster.setFromCamera(ndcCenter, camera);
            const origin = raycaster.ray.origin.clone();
            const dir = raycaster.ray.direction.clone(); // already normalized

            // 100 units forward
            const rayEnd = origin.clone().add(dir.multiplyScalar(100));

            fireRaycast(origin, rayEnd);
            }
        }
        if (event.button === 2 && document.pointerLockElement === canvas) {
            setIsAiming(true);
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
    
    const handleMovement = (delta, setIsMoving, setIsSprinting) => { 
        if (!bodyRef.current) return; // Safety check
        
        dir.set(0, 0, 0);
        let moving = false;
        let sprinting = false;
        
        // Advanced sprint validation system
        const currentTime = Date.now();
        
        // Check if stamina just hit 0
        if (stamina <= 0 && !regenerationDelayActive.current) {
            staminaDepletionTime.current = currentTime;
            regenerationDelayActive.current = true;
            sprintKeyValidated.current = false; // Force sprint key re-press
        }
        
        // Check if 3-second delay has passed since stamina depletion
        if (regenerationDelayActive.current && 
            currentTime - staminaDepletionTime.current >= 3000) {
            regenerationDelayActive.current = false;
        }
        
        // Check if we can start sprinting (fresh key press with sufficient stamina)
        const canStartSprint = sprintKeyValidated.current && 
                              stamina >= 20 && 
                              !isExhausted && 
                              !regenerationDelayActive.current &&
                              !isCurrentlySprinting;

        // Start sprinting if conditions are met
        if (canStartSprint) {
            setIsCurrentlySprinting(true);
        }

        // Stop sprinting if key is released or stamina is depleted
        if (isCurrentlySprinting && (!sprintPressed || stamina <= 0)) {
            setIsCurrentlySprinting(false);
            if (stamina <= 0) {
                sprintKeyValidated.current = false; // Force key re-press
            }
        }

        // Sprint logic
        if (isCurrentlySprinting && stamina > 0) {
            sprinting = true;
            // Consume stamina while sprinting at normal pace
            consumeStamina(50 * delta); // 50 stamina per second
        }
        
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

        // Chunked stamina regeneration - only if no delay and not sprinting
        if (!sprinting && !regenerationDelayActive.current && stamina < 100) {
            if (currentTime - lastRegenTime.current >= 1500) { // 1.5 second interval
                regenerateStamina(10); // Regenerate 10 stamina at once
                lastRegenTime.current = currentTime;
            }
        }
        
        // Handle diagonal movement - face the actual movement direction
        if ((forwardPressed || backPressed) && (leftPressed || rightPressed)) {
            let diagonalRotation = cameraRotation;
            
            if (forwardPressed && (leftPressed && rightPressed)) {
                // If both left and right are pressed with forward, no diagonal movement
                diagonalRotation = cameraRotation;
            } else if (backPressed && (leftPressed && rightPressed)) {
                // If both left and right are pressed with backward, no diagonal movement
                diagonalRotation = cameraRotation + Math.PI;
            } else if (forwardPressed && leftPressed) {
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
        
       
        // Handle angle wrapping for smooth rotation
        let angleDiff = targetCharacterRotation - characterRotation;
        if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
        
        const rotationSpeed = 10; // Adjust this to control turning speed
        const newRotation = characterRotation + angleDiff * Math.min(1, delta * rotationSpeed);
        setCharacterRotation(newRotation); //comment out for free camera move 
        
        
        // Jump logic - always works when jump is pressed
        if (jumpPressed && isNearGround() && !jumpTriggered) { // && !jumpTriggered
            setJumpTriggered(true); // Reset right-click aiming when jumping
            jump();
            console.log("🦖 Jumping!");
        }

        if(!isNearGround()) { //made jumping triggered is only set to false when the player actually jumps 
            setJumpTriggered(false); 
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
        buttonStates,      // Current button states for networking
        jumpPressed,
        forwardPressed,
        backPressed,
        leftPressed,
        rightPressed,
        sprintPressed
    };
};