import React, { useMemo, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function CameraRig({
    targetRef,
    characterRotation = 0, // Rotation passed from character
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
        
        // Use the character's rotation (from mouse movement) for camera positioning
        // Calculate ideal camera position behind the character
        const behindOffset = tempVec2.set(0, 0, -distance);
        behindOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), characterRotation);
        
        idealCameraPos.current.copy(characterPos)
            .add(behindOffset)
            .setY(characterPos.y + height);
    
        // Calculate ideal look-at position (slightly ahead and above the character)
        idealLookAt.current.copy(characterPos)
            .setY(characterPos.y + heightOffset);
        
        // Add a slight forward offset to the look-at point using character rotation
        const forwardOffset = new THREE.Vector3(0, 0, 2);
        forwardOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), characterRotation);
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