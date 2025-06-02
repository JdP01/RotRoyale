import { useRef } from 'react';

export const useDinoAnimations = () => {
    // Animation state refs - using refs for performance optimization
    const legAngle = useRef(0);
    const headBobAngle = useRef(0);
    const tailAngle = useRef(0);
    const armAngle = useRef(0);
    const bodyBobAngle = useRef(0);
    const bodyBobHeight = useRef(0);
    
    // Previous state tracking for smooth transitions
    const prevMovingState = useRef({ isMoving: false, isJumping: false });

    const updateAdvancedAnimations = (delta, animationState, refs) => {
        const { isMoving, isSprinting, isJumping } = animationState;
        const { 
            legLeftRef, 
            legRightRef, 
            headRef, 
            tailRef, 
            armLeftRef, 
            armRightRef, 
            mainGroupRef 
        } = refs;

        // Determine animation speeds based on sprint status
        const legAnimationSpeed = isSprinting ? 25 : 15;
        const headBobSpeed = isSprinting ? 12 : 7;
        const headBobIntensity = isSprinting ? 0.05 : 0.025;
        const armAnimationSpeed = isSprinting ? 22 : 13;
        const bodyBobSpeed = isSprinting ? 20 : 12;
        const bodyBobIntensity = isSprinting ? 0.1 : 0.06;
        
        // Handle body tilt during jumping
        if (mainGroupRef.current) {
            if (isJumping) {
                // Apply lerping to body rotation for smoother transitions
                const targetRotX = -0.2;
                mainGroupRef.current.rotation.x += (targetRotX - mainGroupRef.current.rotation.x) * 0.15;
            } else {
                mainGroupRef.current.rotation.x += (0 - mainGroupRef.current.rotation.x) * 0.15;
            }
        }
        
        // Track state changes for smoother transitions
        const startedMoving = !prevMovingState.current.isMoving && isMoving;
        const stoppedMoving = prevMovingState.current.isMoving && !isMoving;
        
        // Update animation angles only when moving
        if (isMoving) {
            // Update ref values directly instead of using setState
            legAngle.current = (legAngle.current + delta * legAnimationSpeed) % (Math.PI * 2);
            headBobAngle.current = (headBobAngle.current + delta * headBobSpeed) % (Math.PI * 2);
            tailAngle.current = (tailAngle.current + delta * (isSprinting ? 12 : 7)) % (Math.PI * 2);
            armAngle.current = (armAngle.current + delta * armAnimationSpeed) % (Math.PI * 2);
            bodyBobAngle.current = (bodyBobAngle.current + delta * bodyBobSpeed) % (Math.PI * 2);
            
            // Calculate body bob height - only when not jumping
            if (!isJumping) {
                const targetBobHeight = Math.abs(Math.sin(bodyBobAngle.current)) * bodyBobIntensity;
                bodyBobHeight.current += (targetBobHeight - bodyBobHeight.current) * 0.2;
            } else {
                bodyBobHeight.current *= 0.9;
            }
            
            // Apply animation to legs with smooth transitions
            if (legLeftRef.current && legRightRef.current) {
                const legAmplitude = isSprinting ? 0.8 : 0.5;
                
                const targetLeftLegRotation = Math.sin(legAngle.current) * legAmplitude;
                const targetRightLegRotation = Math.sin(legAngle.current + Math.PI) * legAmplitude;
                
                legLeftRef.current.rotation.x += (targetLeftLegRotation - legLeftRef.current.rotation.x) * 0.3;
                legRightRef.current.rotation.x += (targetRightLegRotation - legRightRef.current.rotation.x) * 0.3;
            }
            
            // Apply arm animations - opposite phase to the legs for natural cross-body motion
            if (armLeftRef.current && armRightRef.current) {
                const armAmplitude = isSprinting ? 0.5 : 0.3;
                
                const targetLeftArmRotation = Math.sin(armAngle.current + Math.PI) * armAmplitude;
                const targetRightArmRotation = Math.sin(armAngle.current) * armAmplitude;
                
                armLeftRef.current.rotation.x += (targetLeftArmRotation - armLeftRef.current.rotation.x) * 0.25;
                armRightRef.current.rotation.x += (targetRightArmRotation - armRightRef.current.rotation.x) * 0.25;
            }
            
            // Apply head bobbing - only when not jumping
            if (headRef.current && !isJumping) {
                const headCurve = Math.sin(headBobAngle.current) * headBobIntensity;
                headRef.current.rotation.x += (headCurve - headRef.current.rotation.x) * 0.2;
            }
            
            // Apply tail animation
            if (tailRef.current) {
                const tailSwingHorizontal = Math.sin(tailAngle.current) * (isSprinting ? 0.2 : 0.15);
                const tailSwingVertical = Math.sin(tailAngle.current * 2) * 0.05;
                
                tailRef.current.rotation.y += (tailSwingHorizontal - tailRef.current.rotation.y) * 0.15;
                tailRef.current.rotation.x += (tailSwingVertical - tailRef.current.rotation.x) * 0.1;
                
                // During jumps, add upward tail motion
                if (isJumping) {
                    const jumpTailLift = 0.2;
                    tailRef.current.rotation.x += (jumpTailLift - tailRef.current.rotation.x) * 0.2;
                }
            }
        } else {
            // If just stopped moving, smoothly reset positions
            if (stoppedMoving || !isMoving) {
                // Reset leg positions with lerping when not moving
                if (legLeftRef.current && legRightRef.current) {
                    legLeftRef.current.rotation.x += (0 - legLeftRef.current.rotation.x) * 0.2;
                    legRightRef.current.rotation.x += (0 - legRightRef.current.rotation.x) * 0.2;
                }
                
                // Reset arm positions with lerping when not moving
                if (armLeftRef.current && armRightRef.current) {
                    armLeftRef.current.rotation.x += (0 - armLeftRef.current.rotation.x) * 0.2;
                    armRightRef.current.rotation.x += (0 - armRightRef.current.rotation.x) * 0.2;
                }
                
                // Reset head rotation gradually when stopping
                if (headRef.current) {
                    headRef.current.rotation.x += (0 - headRef.current.rotation.x) * 0.2;
                }
                
                // For tail when idle, have subtle idle animation
                if (tailRef.current) {
                    tailAngle.current = (tailAngle.current + delta * 2) % (Math.PI * 2);
                    const idleTailMotion = Math.sin(tailAngle.current) * 0.05;
                    
                    tailRef.current.rotation.y += (idleTailMotion - tailRef.current.rotation.y) * 0.05;
                    tailRef.current.rotation.x += (0 - tailRef.current.rotation.x) * 0.1;
                }
                
                // For arms when idle, very subtle motion
                if (armLeftRef.current && armRightRef.current) {
                    armAngle.current = (armAngle.current + delta) % (Math.PI * 2);
                    const idleArmMotion = Math.sin(armAngle.current) * 0.03;
                    
                    armLeftRef.current.rotation.z += (idleArmMotion - armLeftRef.current.rotation.z) * 0.03;
                    armRightRef.current.rotation.z += (-idleArmMotion - armRightRef.current.rotation.z) * 0.03;
                }
                
                // Gradually reduce body bob when stopping
                bodyBobHeight.current *= 0.9;
            }
        }
        
        // Always reset head rotation during jumps to avoid conflicts
        if (isJumping && headRef.current) {
            headRef.current.rotation.x += (0 - headRef.current.rotation.x) * 0.2;
        }
        
        // During jumps, animate arms to extend forward slightly
        if (isJumping && armLeftRef.current && armRightRef.current) {
            const jumpArmPose = -0.3;
            armLeftRef.current.rotation.x += (jumpArmPose - armLeftRef.current.rotation.x) * 0.15;
            armRightRef.current.rotation.x += (jumpArmPose - armRightRef.current.rotation.x) * 0.15;
        }
        
        // Update previous state tracking
        prevMovingState.current = { isMoving, isJumping };

        // Return the current body bob height for positioning
        return bodyBobHeight.current;
    };

    return {
        updateAdvancedAnimations
    };
};