import { useKeyboardControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useRapier } from '@react-three/rapier';
import * as THREE from "three";
import { Controls } from "../world/GameCanvas";
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { usePlayerState } from "../../logic/PlayerState";

export const useDinoControls = (bodyRef, setIsJumping, maxDistance = 0.16) => {
    const { camera } = useThree();
    const { stamina, isExhausted, consumeStamina, regenerateStamina, fireRaycast } = usePlayerState();
    const { rapier, world } = useRapier();

    // Refs for performance optimization
    const lastRegenTime = useRef(0);
    const sprintKeyPressed = useRef(false);
    const sprintKeyValidated = useRef(false);
    const staminaDepletionTime = useRef(0);
    const regenerationDelayActive = useRef(false);
    const [jumpTriggered, setJumpTriggered] = useState(false);

    // Memoized vectors to avoid recreation
    const vectors = useMemo(() => ({
        dir: new THREE.Vector3(),
        forward: new THREE.Vector3(),
        right: new THREE.Vector3(),
        raycast: new THREE.Raycaster(),
        ndcCenter: new THREE.Vector2(0, 0)
    }), []);

    // State
    const [cameraRotation, setCameraRotation] = useState(0);
    const [cameraPitch, setCameraPitch] = useState(0);
    const [characterRotation, setCharacterRotation] = useState(0);
    const [isAiming, setIsAiming] = useState(false);
    const [isCurrentlySprinting, setIsCurrentlySprinting] = useState(false);

    // Keyboard controls - using individual selectors to avoid infinite loops
    const jumpPressed = useKeyboardControls((state) => state[Controls.jump]);
    const forwardPressed = useKeyboardControls((state) => state[Controls.forward]);
    const backPressed = useKeyboardControls((state) => state[Controls.back]);
    const leftPressed = useKeyboardControls((state) => state[Controls.left]);
    const rightPressed = useKeyboardControls((state) => state[Controls.right]);
    const sprintPressed = useKeyboardControls((state) => state[Controls.sprint]);

    // Button states for networking
    const [buttonStates, setButtonStates] = useState({
        forward: false, back: false, left: false, 
        right: false, jump: false, sprint: false
    });

    // Optimized ground detection
    const isNearGround = useCallback(() => {
        const body = bodyRef.current;
        if (!body) return false;

        const pos = body.translation();
        const ray = new rapier.Ray(pos, { x: 0, y: -10, z: 0 });
        const hit = world.castRay(ray, maxDistance, true, undefined, undefined, body.collider(0));
        
        return !!hit;
    }, [bodyRef, rapier, world, maxDistance]);

    // Optimized jump function
    const jump = useCallback(() => {
        if (!bodyRef.current) return;
        setIsJumping(true);
        bodyRef.current.applyImpulse({ x: 0, y: 25, z: 0 });
    }, [bodyRef, setIsJumping]);

    // Sprint validation logic
    useEffect(() => {
        const wasPressed = sprintKeyPressed.current;
        sprintKeyPressed.current = sprintPressed;

        if (!wasPressed && sprintPressed) {
            sprintKeyValidated.current = stamina >= 20 && !regenerationDelayActive.current;
        } else if (wasPressed && !sprintPressed) {
            sprintKeyValidated.current = false;
        }

        setButtonStates({
            forward: forwardPressed, back: backPressed, left: leftPressed,
            right: rightPressed, jump: jumpPressed, sprint: sprintPressed
        });
    }, [forwardPressed, backPressed, leftPressed, rightPressed, jumpPressed, sprintPressed, stamina]);

    // Pointer lock and mouse controls
    useEffect(() => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return;

        const sensitivity = 0.002;

        const handlePointerLockChange = () => {
            // Pointer lock change handler
        };

        const handleMouseMove = (e) => {
            if (document.pointerLockElement !== canvas) return;
            setCameraRotation(prev => prev - e.movementX * sensitivity);
            setCameraPitch(prev => Math.max(-Math.PI / 2, Math.min(Math.PI / 2, prev + e.movementY * sensitivity)));
        };

        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && document.pointerLockElement === canvas) {
                document.exitPointerLock();
            }
        };

        const handleMouseDown = (e) => {
            if (e.button === 0) {
                if (document.pointerLockElement !== canvas) {
                    canvas.requestPointerLock();
                } else {
                    vectors.raycast.setFromCamera(vectors.ndcCenter, camera);
                    const { origin, direction } = vectors.raycast.ray;
                    const rayEnd = origin.clone().add(direction.clone().multiplyScalar(100));
                    fireRaycast(origin, rayEnd);
                }
            } else if (e.button === 2 && document.pointerLockElement === canvas) {
                setIsAiming(true);
            }
        };

        const handleMouseUp = (e) => {
            if (e.button === 2) setIsAiming(false);
        };

        const handleContextMenu = (e) => e.preventDefault();

        // Add listeners
        document.addEventListener('pointerlockchange', handlePointerLockChange);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('keydown', handleKeyDown);
        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('mouseup', handleMouseUp);
        canvas.addEventListener('contextmenu', handleContextMenu);

        return () => {
            document.removeEventListener('pointerlockchange', handlePointerLockChange);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('keydown', handleKeyDown);
            canvas.removeEventListener('mousedown', handleMouseDown);
            canvas.removeEventListener('mouseup', handleMouseUp);
            canvas.removeEventListener('contextmenu', handleContextMenu);
        };
    }, [camera, vectors, fireRaycast]);

    // Optimized movement handler
    const handleMovement = useCallback((delta, setIsMoving, setIsSprinting) => {
        if (!bodyRef.current) return;

        const currentTime = Date.now();
        let moving = false;
        let sprinting = false;

        // Stamina depletion check
        if (stamina <= 0 && !regenerationDelayActive.current) {
            staminaDepletionTime.current = currentTime;
            regenerationDelayActive.current = true;
            sprintKeyValidated.current = false;
        }

        // Reset delay after 3 seconds
        if (regenerationDelayActive.current && currentTime - staminaDepletionTime.current >= 3000) {
            regenerationDelayActive.current = false;
        }

        // Sprint state management
        const canStartSprint = sprintKeyValidated.current && stamina >= 20 && 
                              !isExhausted && !regenerationDelayActive.current && !isCurrentlySprinting;

        if (canStartSprint) setIsCurrentlySprinting(true);
        if (isCurrentlySprinting && (!sprintPressed || stamina <= 0)) {
            setIsCurrentlySprinting(false);
            if (stamina <= 0) sprintKeyValidated.current = false;
        }

        // Sprint stamina consumption
        if (isCurrentlySprinting && stamina > 0) {
            sprinting = true;
            consumeStamina(50 * delta);
        }

        // Movement calculation
        vectors.dir.set(0, 0, 0);
        vectors.forward.set(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraRotation);
        vectors.right.set(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraRotation);

        let targetRotation = cameraRotation;

        // Apply movement inputs
        if (forwardPressed) {
            vectors.dir.add(vectors.forward);
            moving = true;
            targetRotation = cameraRotation;
        }
        if (backPressed) {
            vectors.dir.sub(vectors.forward);
            moving = true;
            targetRotation = cameraRotation + Math.PI;
        }
        if (leftPressed) {
            vectors.dir.add(vectors.right);
            moving = true;
            targetRotation = cameraRotation + Math.PI / 2;
        }
        if (rightPressed) {
            vectors.dir.sub(vectors.right);
            moving = true;
            targetRotation = cameraRotation - Math.PI / 2;
        }

        // Diagonal movement adjustments
        if ((forwardPressed || backPressed) && (leftPressed || rightPressed)) {
            if (forwardPressed && leftPressed && !rightPressed) targetRotation = cameraRotation + Math.PI / 4;
            else if (forwardPressed && rightPressed && !leftPressed) targetRotation = cameraRotation - Math.PI / 4;
            else if (backPressed && leftPressed && !rightPressed) targetRotation = cameraRotation + 3 * Math.PI / 4;
            else if (backPressed && rightPressed && !leftPressed) targetRotation = cameraRotation - 3 * Math.PI / 4;
        }

        // Smooth character rotation
        let angleDiff = targetRotation - characterRotation;
        if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
        setCharacterRotation(characterRotation + angleDiff * Math.min(1, delta * 10));

        // Jump logic
        if (jumpPressed && isNearGround() && !jumpTriggered) {
            setJumpTriggered(true);
            jump();
        }
        if (!isNearGround()) setJumpTriggered(false);

        // Stamina regeneration
        if (!sprinting && !regenerationDelayActive.current && stamina < 100 && 
            currentTime - lastRegenTime.current >= 1500) {
            regenerateStamina(10);
            lastRegenTime.current = currentTime;
        }

        // Apply movement
        if (moving) {
            vectors.dir.normalize();
            const moveSpeed = (sprinting && !isExhausted) ? 15 : 10;
            vectors.dir.multiplyScalar(moveSpeed);
        }

        const vel = bodyRef.current.linvel();
        bodyRef.current.setLinvel({ x: vectors.dir.x, y: vel.y, z: vectors.dir.z }, true);

        setIsMoving(moving);
        setIsSprinting(sprinting && !isExhausted);
    }, [bodyRef, stamina, isExhausted, consumeStamina, regenerateStamina, cameraRotation, 
        characterRotation, jumpPressed, forwardPressed, backPressed, leftPressed, 
        rightPressed, sprintPressed, isCurrentlySprinting, jumpTriggered, isNearGround, jump, vectors]);

    return {
        handleMovement,
        cameraRotation,
        cameraPitch,
        characterRotation,
        isAiming,
        buttonStates,
        jumpPressed,
        forwardPressed,
        backPressed,
        leftPressed,
        rightPressed,
        sprintPressed
    };
};