import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, useGLTF } from '@react-three/drei';
import { BallCollider, RigidBody } from '@react-three/rapier';
import * as THREE from 'three';

const CONSUME_HOLD_DURATION = 3;
const INTERACTION_DISTANCE = 4.5;

const PICKUP_CONFIG = {
  apple: {
    assetPath: '/objects/apple_vox.glb',
    glowColor: '#ff3b30',
    health: 5,
  },
  banana: {
    assetPath: '/objects/banana_vox.glb',
    glowColor: '#ffe44d',
    health: 20,
  },
};

const HealthPickup = ({ pickup, playerBody, onConsumed }) => {
  const bodyRef = useRef();
  const visualRef = useRef();
  const consumedRef = useRef(false);
  const holdProgressRef = useRef(0);
  const isPlayerNearbyRef = useRef(false);
  const [isPlayerNearby, setIsPlayerNearby] = useState(false);
  const [isInteractHeld, setIsInteractHeld] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const config = PICKUP_CONFIG[pickup.type];
  const { scene } = useGLTF(config.assetPath);

  const fruitModel = useMemo(() => {
    const model = scene.clone(true);
    const glowColor = new THREE.Color(config.glowColor);

    model.traverse((child) => {
      if (!child.isMesh) return;

      const hasMaterialArray = Array.isArray(child.material);
      const materials = hasMaterialArray ? child.material : [child.material];
      const glowingMaterials = materials.map((material) => {
        const glowingMaterial = material.clone();
        if (glowingMaterial.emissive) {
          glowingMaterial.emissive.copy(glowColor);
          glowingMaterial.emissiveIntensity = 0.18;
        }
        return glowingMaterial;
      });
      child.material = hasMaterialArray ? glowingMaterials : glowingMaterials[0];
      child.castShadow = true;
      child.receiveShadow = true;
    });

    return model;
  }, [config.glowColor, scene]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.code === 'KeyE' && isPlayerNearbyRef.current) setIsInteractHeld(true);
    };
    const handleKeyUp = (event) => {
      if (event.code === 'KeyE') setIsInteractHeld(false);
    };
    const handleWindowBlur = () => setIsInteractHeld(false);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, []);

  useFrame((_, delta) => {
    if (!visualRef.current) return;
    visualRef.current.rotation.y += delta * 1.6;
    visualRef.current.position.y = 0.3 + Math.sin(performance.now() * 0.003) * 0.18;

    const playerPosition = playerBody.current?.translation();
    const pickupPosition = bodyRef.current?.translation();
    const playerIsNearby = Boolean(playerPosition && pickupPosition) && Math.hypot(
      playerPosition.x - pickupPosition.x,
      playerPosition.z - pickupPosition.z,
    ) <= INTERACTION_DISTANCE;

    if (playerIsNearby !== isPlayerNearbyRef.current) {
      isPlayerNearbyRef.current = playerIsNearby;
      setIsPlayerNearby(playerIsNearby);
      if (!playerIsNearby) setIsInteractHeld(false);
    }

    if (!isPlayerNearby || !isInteractHeld || consumedRef.current) {
      if (holdProgressRef.current !== 0) {
        holdProgressRef.current = 0;
        setHoldProgress(0);
      }
      return;
    }

    holdProgressRef.current += delta;
    setHoldProgress(Math.min(holdProgressRef.current / CONSUME_HOLD_DURATION, 1));
    if (holdProgressRef.current >= CONSUME_HOLD_DURATION) {
      consumedRef.current = true;
      onConsumed(pickup.id, config.health);
    }
  });

  const progressDegrees = Math.round(holdProgress * 360);

  return (
    <RigidBody
      ref={bodyRef}
      type="dynamic"
      position={pickup.position}
      colliders={false}
      enabledRotations={[false, false, false]}
      friction={1}
      restitution={0}
      linearDamping={0.8}
    >
      <BallCollider args={[0.7]} friction={1} restitution={0} />
      <group ref={visualRef}>
        <primitive object={fruitModel} scale={0.65} />
        <pointLight color={config.glowColor} intensity={0.8} distance={5} decay={2} position={[0, -1, 0]} />
      </group>
      {isPlayerNearby && (
        <Html position={[0, 2.3, 0]} center>
          <div style={{ alignItems: 'center', color: '#ffffff', display: 'flex', fontFamily: 'monospace', fontSize: '12px', fontWeight: 700, gap: '8px', pointerEvents: 'none', textShadow: '0 1px 3px #000000', whiteSpace: 'nowrap' }}>
            <div style={{ alignItems: 'center', background: `conic-gradient(${config.glowColor} ${progressDegrees}deg, rgba(0, 0, 0, 0.55) ${progressDegrees}deg)`, border: '1px solid rgba(255, 255, 255, 0.8)', borderRadius: '50%', display: 'flex', height: '28px', justifyContent: 'center', width: '28px' }}>
              <div style={{ background: 'rgba(0, 0, 0, 0.72)', borderRadius: '50%', height: '20px', width: '20px' }} />
            </div>
            <span>HOLD E TO EAT</span>
          </div>
        </Html>
      )}
    </RigidBody>
  );
};

export const HealthPickups = ({ pickups, playerBody, onConsumed }) => (
  <>
    {pickups.map((pickup) => (
      <HealthPickup
        key={pickup.id}
        pickup={pickup}
        playerBody={playerBody}
        onConsumed={onConsumed}
      />
    ))}
  </>
);

useGLTF.preload(PICKUP_CONFIG.apple.assetPath);
useGLTF.preload(PICKUP_CONFIG.banana.assetPath);