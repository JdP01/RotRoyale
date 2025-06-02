import React, { useMemo, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function CameraRig({
    targetRef,
    characterRotation = 0, // Rotation passed from character
    distance = 8,          // How far behind the character
    height = 4,            // How high above the character  
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
    
    // Fixed camera rotation (doesn't follow character rotation for strafe movement)
    const fixedCameraRotation = useRef(0)
    
    // Temporary vectors for calculations
    const tempVec = useMemo(() => new THREE.Vector3(), [])
    const tempVec2 = useMemo(() => new THREE.Vector3(), [])

    useFrame(() => {
        if (!targetRef || !targetRef.current) return;

        // Get character position
        const pos = targetRef.current.translation();
        if (!pos) return; // Safety check for translation
        
        const characterPos = tempVec.set(pos.x, pos.y, pos.z);
        
        // Only update camera rotation when character is moving forward/backward
        // Don't update when strafing (left/right movement)
        
        // Calculate ideal camera position using the fixed rotation
        const behindOffset = tempVec2.set(0, 0, -distance);
        behindOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), fixedCameraRotation.current);
        
        idealCameraPos.current.copy(characterPos)
            .add(behindOffset)
            .setY(characterPos.y + height);
    
        // Calculate ideal look-at position (slightly ahead and above the character)
        idealLookAt.current.copy(characterPos)
            .setY(characterPos.y + heightOffset);
        
        // Add a slight forward offset to the look-at point using the fixed rotation
        const forwardOffset = new THREE.Vector3(0, 0, 2);
        forwardOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), fixedCameraRotation.current);
        idealLookAt.current.add(forwardOffset);
        
        // Initialize camera position on first frame
        if (currentCameraPos.current.length() === 0) {
            currentCameraPos.current.copy(idealCameraPos.current);
            currentLookAt.current.copy(idealLookAt.current);
        }
        
        // Smooth camera position interpolation
        currentCameraPos.current.lerp(idealCameraPos.current, stiffness);
        currentLookAt.current.lerp(idealLookAt.current, lookStiffness);
        
        // Apply to camera
        camera.position.copy(currentCameraPos.current);
        camera.lookAt(currentLookAt.current);
    });

    return null;
}