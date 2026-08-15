import { useRef } from 'react';
// DEPRECATED LEGACY CODE OUT OF USE
// DEPRECATED LEGACY CODE OUT OF USE
// DEPRECATED LEGACY CODE OUT OF USE
// DEPRECATED LEGACY CODE OUT OF USE
// DEPRECATED LEGACY CODE OUT OF USE
// DEPRECATED LEGACY CODE OUT OF USE
// DEPRECATED LEGACY CODE OUT OF USE
// DEPRECATED LEGACY CODE OUT OF USE
// DEPRECATED LEGACY CODE OUT OF USE
// DEPRECATED LEGACY CODE OUT OF USE
// DEPRECATED LEGACY CODE OUT OF USE
// DEPRECATED LEGACY CODE OUT OF USE
// DEPRECATED LEGACY CODE OUT OF USE
// DEPRECATED LEGACY CODE OUT OF USE
export const useBasicAnimations = () => {
    // Animation state refs - using refs for performance optimization
    const legAngle = useRef(0);
    const headBobAngle = useRef(0);
    const tailAngle = useRef(0);
    const armAngle = useRef(0);
    const bodyBobAngle = useRef(0);
    const bodyBobHeight = useRef(0);
    
    // Previous state tracking for smooth transitions
    const prevMovingState = useRef({ isMoving: false, isJumping: false });

    const updateAdvancedAnimations = (delta, animationState, refs, animConfig = {}) => {
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

        // Use configuration values or defaults
        const config = {
            walkSpeed: animConfig.walkSpeed || 1.0,
            runSpeed: animConfig.runSpeed || 1.5,
            jumpSpeed: animConfig.jumpSpeed || 1.0,
            idleSpeed: animConfig.idleSpeed || 1.0,
            bobHeight: animConfig.bobHeight || 0.1,
            bobSpeed: animConfig.bobSpeed || 5.0,
            armSwingAmount: animConfig.armSwingAmount || 0.5,
            legSwingAmount: animConfig.legSwingAmount || 0.8,
            tailSwingAmount: animConfig.tailSwingAmount || 0.2,
            tailSwingSpeed: animConfig.tailSwingSpeed || 1.0,
            headBobIntensity: animConfig.headBobIntensity || 1.0,
            jumpBodyTilt: animConfig.jumpBodyTilt || -0.1,
            ...animConfig
        };

        // Determine animation speeds based on sprint status and config
        const legAnimationSpeed = isSprinting ? (25 * config.runSpeed) : (15 * config.walkSpeed);
        const headBobSpeed = isSprinting ? (12 * config.runSpeed) : (7 * config.walkSpeed);
        const headBobIntensity = (isSprinting ? 0.05 : 0.025) * config.bobHeight * config.headBobIntensity;
        const armAnimationSpeed = isSprinting ? (22 * config.runSpeed) : (13 * config.walkSpeed);
        const bodyBobSpeed = isSprinting ? (20 * config.bobSpeed) : (12 * config.bobSpeed);
        const bodyBobIntensity = (isSprinting ? 0.1 : 0.06) * config.bobHeight;
        const tailSpeed = isSprinting ? (12 * config.tailSwingSpeed) : (7 * config.tailSwingSpeed);
        
        // Handle body tilt during jumping
        if (mainGroupRef && mainGroupRef.current) {
            if (isJumping) {
                // Apply lerping to body rotation for smoother transitions
                const targetRotX = config.jumpBodyTilt;
                mainGroupRef.current.rotation.x += (targetRotX - mainGroupRef.current.rotation.x) * 0.5;
            } else {
                mainGroupRef.current.rotation.x += (0 - mainGroupRef.current.rotation.x) * 0.6;
            }
        }
        
        // Track state changes for smoother transitions
        const stoppedMoving = prevMovingState.current.isMoving && !isMoving;
        
        // Update animation angles only when moving
        if (isMoving) {
            // Update ref values directly instead of using setState
            legAngle.current = (legAngle.current + delta * legAnimationSpeed) % (Math.PI * 2);
            headBobAngle.current = (headBobAngle.current + delta * headBobSpeed) % (Math.PI * 2);
            if (tailRef && tailRef.current) {
                tailAngle.current = (tailAngle.current + delta * tailSpeed) % (Math.PI * 2);
            }
            armAngle.current = (armAngle.current + delta * armAnimationSpeed) % (Math.PI * 2);
            bodyBobAngle.current = (bodyBobAngle.current + delta * bodyBobSpeed) % (Math.PI * 2);
            
            // Calculate body bob height - only when not jumping
            if (!isJumping) {
                const targetBobHeight = Math.abs(Math.sin(bodyBobAngle.current)) * bodyBobIntensity;
                bodyBobHeight.current += (targetBobHeight - bodyBobHeight.current) * 0.2;
            } else {
                bodyBobHeight.current *= 0.9;
            }
            
            // Apply animation to legs with smooth transitions (only if refs exist)
            if (legLeftRef && legLeftRef.current && legRightRef && legRightRef.current) {
                const legAmplitude = (isSprinting ? 0.8 : 0.5) * config.legSwingAmount;
                
                const targetLeftLegRotation = Math.sin(legAngle.current) * legAmplitude;
                const targetRightLegRotation = Math.sin(legAngle.current + Math.PI) * legAmplitude;
                
                legLeftRef.current.rotation.x += (targetLeftLegRotation - legLeftRef.current.rotation.x) * 0.3;
                legRightRef.current.rotation.x += (targetRightLegRotation - legRightRef.current.rotation.x) * 0.3;
            }
            
            // Apply arm animations - opposite phase to the legs for natural cross-body motion (only if refs exist)
            if (armLeftRef && armLeftRef.current && armRightRef && armRightRef.current) {
                const armAmplitude = (isSprinting ? 0.5 : 0.3) * config.armSwingAmount;
                
                const targetLeftArmRotation = Math.sin(armAngle.current + Math.PI) * armAmplitude;
                const targetRightArmRotation = Math.sin(armAngle.current) * armAmplitude;
                
                armLeftRef.current.rotation.x += (targetLeftArmRotation - armLeftRef.current.rotation.x) * 0.25;
                armRightRef.current.rotation.x += (targetRightArmRotation - armRightRef.current.rotation.x) * 0.25;
            }
            
            // Apply head bobbing - only when not jumping (only if ref exists)
            if (headRef && headRef.current && !isJumping) {
                const headCurve = Math.sin(headBobAngle.current) * headBobIntensity;
                headRef.current.rotation.x += (headCurve - headRef.current.rotation.x) * 0.2;
            }
            
            // Apply tail animation (only if tail exists)
            if (tailRef && tailRef.current) {
                const tailSwingHorizontal = Math.sin(tailAngle.current) * (isSprinting ? 0.2 : 0.15) * config.tailSwingAmount;
                const tailSwingVertical = Math.sin(tailAngle.current * 2) * 0.05 * config.tailSwingAmount;
                
                tailRef.current.rotation.y += (tailSwingHorizontal - tailRef.current.rotation.y) * 0.15;
                tailRef.current.rotation.x += (tailSwingVertical - tailRef.current.rotation.x) * 0.1;
                
                // During jumps, add upward tail motion
                if (isJumping) {
                    const jumpTailLift = 0.2 * config.tailSwingAmount;
                    tailRef.current.rotation.x += (jumpTailLift - tailRef.current.rotation.x) * 0.2;
                }
            }
                } else {
            // If just stopped moving, smoothly reset positions
            if (stoppedMoving || !isMoving) {
                // Reset leg positions with lerping when not moving (only if refs exist)
                if (legLeftRef && legLeftRef.current && legRightRef && legRightRef.current) {
                    legLeftRef.current.rotation.x += (0 - legLeftRef.current.rotation.x) * 0.2;
                    legRightRef.current.rotation.x += (0 - legRightRef.current.rotation.x) * 0.2;
                }
                
                // Reset arm positions with lerping when not moving (only if refs exist)
                if (armLeftRef && armLeftRef.current && armRightRef && armRightRef.current) {
                    armLeftRef.current.rotation.x += (0 - armLeftRef.current.rotation.x) * 0.2;
                }
                
                // Reset head rotation gradually when stopping (only if ref exists)
                if (headRef && headRef.current) {
                    headRef.current.rotation.x += (0 - headRef.current.rotation.x) * 0.2;
                }
                
                // For tail when idle, have subtle idle animation (only if tail exists)
                if (tailRef && tailRef.current) {
                    tailAngle.current = (tailAngle.current + delta * config.idleSpeed) % (Math.PI * 2);
                    const idleTailMotion = Math.sin(tailAngle.current) * 0.05 * config.tailSwingAmount;
                    
                    tailRef.current.rotation.y += (idleTailMotion - tailRef.current.rotation.y) * 0.05;
                    tailRef.current.rotation.x += (0 - tailRef.current.rotation.x) * 0.1;
                }
                
                // For arms when idle, very subtle motion (only if refs exist)
                if (armLeftRef && armLeftRef.current && armRightRef && armRightRef.current) {
                    armAngle.current = (armAngle.current + delta * config.idleSpeed) % (Math.PI * 2);
                    const idleArmMotion = Math.sin(armAngle.current) * 0.03;
                    
                    armLeftRef.current.rotation.z += (idleArmMotion - armLeftRef.current.rotation.z) * 0.03;
                    armRightRef.current.rotation.z += (-idleArmMotion - armRightRef.current.rotation.z) * 0.03;
                }
                
                // Gradually reduce body bob when stopping
                bodyBobHeight.current *= 0.9;
            }
        } 
        
        // Always reset head rotation during jumps to avoid conflicts (only if ref exists)
        if (isJumping && headRef && headRef.current) {
            headRef.current.rotation.x += (0 - headRef.current.rotation.x) * 0.2;
        }
        
        // During jumps, animate arms to extend forward slightly (only if refs exist)
        if (isJumping && armLeftRef && armLeftRef.current && armRightRef && armRightRef.current) {
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