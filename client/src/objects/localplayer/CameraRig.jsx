import React, { useMemo, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function CameraRig({
    targetRef,
    characterRotation = 0, // Character's yaw rotation
    cameraPitch = 0,       // Camera vertical look angle
    distance = 5,          // Distance behind character
    height = 2,            // Camera height above character
    heightOffset = 1,      // Look-at height offset
    stiffness = 0.08,      // Camera position smoothing
    lookStiffness = 0.12,  // Look-at smoothing
    isAiming = false       // Over-shoulder view toggle
}) {
    const { camera } = useThree()
    
    // Current and target positions for smooth interpolation
    const currentCameraPos = useRef(new THREE.Vector3())
    const currentLookAt = useRef(new THREE.Vector3())
    const idealCameraPos = useRef(new THREE.Vector3())
    const idealLookAt = useRef(new THREE.Vector3())

    useFrame(() => {
        if (!targetRef?.current) return;

        const pos = targetRef.current.translation();
        if (!pos) return;
        
        const characterPos = new THREE.Vector3(pos.x, pos.y, pos.z);
        
        // Adjust camera distance for aiming (closer when aiming)
        const activeDistance = isAiming ? distance * 0.4 : distance;
        const activeHeight = isAiming ? height * 0.82 : height;
        
        // Calculate camera offset with horizontal and vertical rotation
        const cameraOffset = new THREE.Vector3(0, 0, -activeDistance);
        cameraOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), characterRotation);
        
        // Apply vertical rotation around right axis
        const rightVector = new THREE.Vector3(1, 0, 0);
        rightVector.applyAxisAngle(new THREE.Vector3(0, 1, 0), characterRotation);
        cameraOffset.applyAxisAngle(rightVector, cameraPitch);
        
        // Set ideal camera position
        idealCameraPos.current
            .copy(characterPos)
            .add(cameraOffset)
            .setY(characterPos.y + activeHeight + cameraOffset.y);
    
        // FIXED: Use consistent look-at direction with shoulder offset
        // Calculate where the character is "looking" based on their rotation
        const forwardDirection = new THREE.Vector3(0, 0, 1); // Character's forward direction
        forwardDirection.applyAxisAngle(new THREE.Vector3(0, 1, 0), characterRotation);
        
        // Apply camera pitch to the look direction
        const pitchAdjustedForward = forwardDirection.clone();
        pitchAdjustedForward.applyAxisAngle(rightVector, cameraPitch);
        
        // Add horizontal shoulder offset (looking slightly to the side of character)
        const shoulderOffset = isAiming ? -0.66: -0.8; // Less offset when aiming for precision
        const shoulderShift = rightVector.clone().multiplyScalar(shoulderOffset);
        
        // Set look-at point in front of character with shoulder offset
        const lookDistance = 10; // How far ahead to look
        idealLookAt.current
            .copy(characterPos)
            .setY(characterPos.y + heightOffset)
            .add(shoulderShift) // Add the sideways shift
            .add(pitchAdjustedForward.multiplyScalar(lookDistance));
        
        // Initialize on first frame
        if (currentCameraPos.current.length() === 0) {
            currentCameraPos.current.copy(idealCameraPos.current);
            currentLookAt.current.copy(idealLookAt.current);
        }
        
        // Smooth interpolation
        currentCameraPos.current.lerp(idealCameraPos.current, stiffness);
        currentLookAt.current.lerp(idealLookAt.current, lookStiffness);
        
        camera.position.copy(currentCameraPos.current);
        camera.lookAt(currentLookAt.current);
    });

    return null;
}