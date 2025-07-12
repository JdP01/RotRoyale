import React, { useMemo, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function CameraRig({
    targetRef,
    characterRotation = 0, // Rotation passed from character (yaw)
    cameraPitch = 0,       // Pitch passed from character (up/down)
    distance = 5,          // How far behind the character
    height = 2,            // How high above the character  
    heightOffset = 1,      // How much higher to look than the character
    stiffness = 0.08,      // Camera movement smoothness
    lookStiffness = 0.12   // Look-at smoothness
}) {
    const { camera } = useThree()
    
    // Camera state refs
    const currentCameraPos = useRef(new THREE.Vector3())
    const currentLookAt = useRef(new THREE.Vector3())
    const idealCameraPos = useRef(new THREE.Vector3())
    const idealLookAt = useRef(new THREE.Vector3())
    
    // Temporary vectors for calculations
    const tempVec = useMemo(() => new THREE.Vector3(), [])
    const tempVec2 = useMemo(() => new THREE.Vector3(), [])

    useFrame(() => {
        if (!targetRef || !targetRef.current) return;

        // Get character position
        const pos = targetRef.current.translation();
        if (!pos) return; // Safety check for translation
        
        const characterPos = tempVec.set(pos.x, pos.y, pos.z);
        
        // Calculate camera position with orbital movement (both horizontal and vertical)
        // Start with base offset behind the character
        const cameraOffset = tempVec2.set(0, 0, -distance);
        
        // Apply horizontal rotation (yaw) around Y axis
        cameraOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), characterRotation);
        
        // Apply vertical rotation (pitch) - orbit around the character
        // Create a right vector for the current camera orientation
        const rightVector = new THREE.Vector3(1, 0, 0);
        rightVector.applyAxisAngle(new THREE.Vector3(0, 1, 0), characterRotation);
        
        // Rotate the camera offset around the right axis to create vertical orbiting
        cameraOffset.applyAxisAngle(rightVector, cameraPitch);
        
        // Position camera relative to character
        idealCameraPos.current.copy(characterPos)
            .add(cameraOffset)
            .setY(characterPos.y + height + cameraOffset.y); // Add the vertical offset from pitch
    
        // Create offset look-at target to position character in lower-left quadrant
        // Calculate forward and right vectors relative to camera orientation
        const forwardVector = new THREE.Vector3(0, 0, 1);
        forwardVector.applyAxisAngle(new THREE.Vector3(0, 1, 0), characterRotation);
        forwardVector.applyAxisAngle(rightVector, cameraPitch);
        
        const upVector = new THREE.Vector3(0, 1, 0);
        const rightCameraVector = new THREE.Vector3().crossVectors(forwardVector, upVector).normalize();
        const upCameraVector = new THREE.Vector3().crossVectors(rightCameraVector, forwardVector).normalize();
        
        // Offset the look-at target to position character in lower-left quadrant
        const horizontalOffset = 2; // Positive values move character to the left of screen
        const verticalOffset = 1;  // Negative values move character to bottom of screen
        
        idealLookAt.current.copy(characterPos)
            .setY(characterPos.y + heightOffset)
            .add(rightCameraVector.clone().multiplyScalar(horizontalOffset))
            .add(upCameraVector.clone().multiplyScalar(verticalOffset));
        
        // Initialize camera position on first frame
        if (currentCameraPos.current.length() === 0) {
            currentCameraPos.current.copy(idealCameraPos.current);
            currentLookAt.current.copy(idealLookAt.current);
        }
        
        // Smooth camera position interpolation (keep some smoothing for position)
        currentCameraPos.current.lerp(idealCameraPos.current, stiffness);
        
        // Make look-at more responsive for precise aiming - use higher interpolation or direct assignment
        const responsiveLookStiffness = Math.min(lookStiffness * 1.5, 0.95); // Boost responsiveness
        currentLookAt.current.lerp(idealLookAt.current, responsiveLookStiffness);
        
        // Apply to camera
        camera.position.copy(currentCameraPos.current);
        camera.lookAt(currentLookAt.current);
    });

    return null;
}