import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { CapsuleCollider, CylinderCollider, RigidBody } from '@react-three/rapier';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { usePlayerState } from '../../logic/PlayerState';
import { findPath, simplifyPath } from '../mapdata/navigation';

const ENEMY_SCALE = 1.4;
const CHASE_SPEED = 12;
const ATTACK_RANGE = 2.4;
const ATTACK_DAMAGE = 5;
const ATTACK_COOLDOWN = 2;
const JUMP_VELOCITY = 13;
const BLOCKED_DURATION = 0.2;
const MIN_PROGRESS_DISTANCE = 0.08;
const HITS_TO_DEFEAT = 5;
const PATH_RECALCULATION_INTERVAL = 1.25;
const WAYPOINT_REACHED_DISTANCE = 1.2;
const STEERING_RESPONSE = 7;
const HIT_FLASH_DURATION = 0.12;
const DEATH_FALL_DURATION = 0.65;

export function SkeletonVoxy({ targetRef, position = [40, -40, 20], takeDamage, onDefeated, navigationGrid }) {
  const bodyRef = useRef();
  const modelRef = useRef();
  const mixerRef = useRef();
  const actionsRef = useRef({});
  const activeActionRef = useRef();
  const attackEndsAtRef = useRef(0);
  const nextAttackAtRef = useRef(0);
  const jumpEndsAtRef = useRef(0);
  const nextJumpAtRef = useRef(0);
  const isGroundedRef = useRef(false);
  const isAliveRef = useRef(true);
  const isDyingRef = useRef(false);
  const hitsRemainingRef = useRef(HITS_TO_DEFEAT);
  const lastPositionRef = useRef();
  const lastProgressAtRef = useRef(0);
  const pathRef = useRef([]);
  const pathIndexRef = useRef(0);
  const nextPathUpdateAtRef = useRef(0);
  const stateClockRef = useRef(0);
  const hitFlashEndsAtRef = useRef(0);
  const isHitFlashActiveRef = useRef(false);
  const deathStartedAtRef = useRef(null);
  const deathReportedRef = useRef(false);
  const materialStatesRef = useRef(new Map());
  const [isAlive, setIsAlive] = useState(true);
  const target = useMemo(() => new THREE.Vector3(), []);
  const direction = useMemo(() => new THREE.Vector3(), []);
  const steeringDirection = useMemo(() => new THREE.Vector3(), []);
  const bodyRotation = useMemo(() => new THREE.Quaternion(), []);
  const { scene, animations } = useGLTF('/skeleton_voxy_anim.glb');
  const { registerLocalRaycastCallback, showHitMarker, unregisterLocalRaycastCallback } = usePlayerState();
  const model = useMemo(() => {
    const clonedModel = clone(scene);
    clonedModel.traverse((child) => {
      if (!child.isMesh) return;
      child.material = child.material.clone();
      child.material.metalness = 0;
      child.material.roughness = 0.8;
      child.material.side = THREE.DoubleSide;
      child.material.needsUpdate = true;
    });
    return clonedModel;
  }, [scene]);

  useEffect(() => {
    const mixer = new THREE.AnimationMixer(model);
    const actions = Object.fromEntries(
      animations.map((clip) => [clip.name.toLowerCase(), mixer.clipAction(clip)]),
    );

    mixerRef.current = mixer;
    actionsRef.current = actions;

    return () => mixer.stopAllAction();
  }, [animations, model]);

  const playAnimation = (name, loop = true) => {
    const nextAction = actionsRef.current[name];
    if (!nextAction || activeActionRef.current === nextAction) return;

    const currentAction = activeActionRef.current;
    nextAction.reset();
    nextAction.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    nextAction.clampWhenFinished = !loop;
    nextAction.fadeIn(0.15).play();
    currentAction?.fadeOut(0.15);
    activeActionRef.current = nextAction;
  };

  const startJump = (now) => {
    bodyRef.current?.setLinvel({
      x: 0,
      y: JUMP_VELOCITY,
      z: 0,
    }, true);
    const jump = actionsRef.current.jump;
    jumpEndsAtRef.current = now + (jump?.getClip().duration ?? 0.75);
    nextJumpAtRef.current = jumpEndsAtRef.current;
    playAnimation('jump', false);
  };

  const setHitFlash = (isActive) => {
    model.traverse((child) => {
      if (!child.isMesh) return;

      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        if (!material?.emissive) return;

        if (!materialStatesRef.current.has(material)) {
          materialStatesRef.current.set(material, {
            emissive: material.emissive.getHex(),
            emissiveIntensity: material.emissiveIntensity,
          });
        }

        const originalState = materialStatesRef.current.get(material);
        material.emissive.setHex(isActive ? 0xff0000 : originalState.emissive);
        material.emissiveIntensity = isActive ? 1.1 : originalState.emissiveIntensity;
        material.needsUpdate = true;
      });
    });
  };

  const handleGroundEnter = ({ other }) => {
    if (other.rigidBodyObject?.name === 'floor') {
      isGroundedRef.current = true;
      console.log('SkeletonVoxy foot sensor contacted the floor');
    }
  };

  const handleGroundExit = ({ other }) => {
    if (other.rigidBodyObject?.name === 'floor') {
      isGroundedRef.current = false;
      console.log('SkeletonVoxy foot sensor left the floor');
    }
  };

  const defeat = useCallback(() => {
    if (isDyingRef.current) return;

    isDyingRef.current = true;
    isGroundedRef.current = false;
    lastPositionRef.current = undefined;
    deathStartedAtRef.current = null;
  }, []);

  const receiveRaycastHit = useCallback(() => {
    if (!isAliveRef.current || isDyingRef.current) return;

    hitsRemainingRef.current -= 1;
    console.log(`SkeletonVoxy hit. ${hitsRemainingRef.current} hits remaining.`);
    showHitMarker();
    hitFlashEndsAtRef.current = stateClockRef.current + HIT_FLASH_DURATION;

    if (hitsRemainingRef.current <= 0) {
      defeat();
    }
  }, [defeat, showHitMarker]);

  const handlePlayerRaycast = useCallback((startPosition, endPosition) => {
    if (!isAliveRef.current || !modelRef.current) return;

    const rayStart = new THREE.Vector3(startPosition.x, startPosition.y, startPosition.z);
    const rayEnd = new THREE.Vector3(endPosition.x, endPosition.y, endPosition.z);
    const rayDirection = rayEnd.clone().sub(rayStart);
    const rayDistance = rayDirection.length();
    if (rayDistance === 0) return;

    rayDirection.normalize();
    const raycaster = new THREE.Raycaster(rayStart, rayDirection, 0, rayDistance);
    modelRef.current.updateWorldMatrix(true, true);

    const meshHit = raycaster.intersectObject(modelRef.current, true).length > 0;
    const hitCenter = modelRef.current.getWorldPosition(new THREE.Vector3());
    const projection = THREE.MathUtils.clamp(hitCenter.clone().sub(rayStart).dot(rayDirection), 0, rayDistance);
    const closestPoint = rayStart.addScaledVector(rayDirection, projection);
    const isNearEnemy = closestPoint.distanceTo(hitCenter) <= 1.5;

    if (meshHit || isNearEnemy) {
      receiveRaycastHit();
    }
  }, [receiveRaycastHit]);

  useEffect(() => {
    registerLocalRaycastCallback(handlePlayerRaycast);
    return () => unregisterLocalRaycastCallback(handlePlayerRaycast);
  }, [handlePlayerRaycast, registerLocalRaycastCallback, unregisterLocalRaycastCallback]);

  useFrame((state, delta) => {
    if (!isAliveRef.current) return;

    stateClockRef.current = state.clock.elapsedTime;
    mixerRef.current?.update(delta);

    const body = bodyRef.current;
    const targetBody = targetRef.current;
    if (!body || !targetBody) return;

    const isFlashing = state.clock.elapsedTime < hitFlashEndsAtRef.current;
    if (isFlashing !== isHitFlashActiveRef.current) {
      setHitFlash(isFlashing);
      isHitFlashActiveRef.current = isFlashing;
    }

    if (isDyingRef.current) {
      if (deathStartedAtRef.current === null) deathStartedAtRef.current = state.clock.elapsedTime;

      const fallProgress = Math.min(1, (state.clock.elapsedTime - deathStartedAtRef.current) / DEATH_FALL_DURATION);
      if (modelRef.current) {
        modelRef.current.rotation.x = fallProgress * Math.PI / 2;
      }
      body.setLinvel({ x: 0, y: body.linvel().y, z: 0 }, true);

      if (fallProgress >= 1 && !deathReportedRef.current) {
        deathReportedRef.current = true;
        isAliveRef.current = false;
        bodyRef.current = null;
        setIsAlive(false);
        onDefeated?.();
      }
      return;
    }

    const enemyPosition = body.translation();
    const playerPosition = targetBody.translation();
    const now = state.clock.elapsedTime;
    const playerDistance = Math.hypot(playerPosition.x - enemyPosition.x, playerPosition.z - enemyPosition.z);

    if (navigationGrid && now >= nextPathUpdateAtRef.current) {
      pathRef.current = simplifyPath(navigationGrid, findPath(navigationGrid, enemyPosition, playerPosition));
      pathIndexRef.current = pathRef.current.length > 1 ? 1 : 0;
      nextPathUpdateAtRef.current = now + PATH_RECALCULATION_INTERVAL;
    }

    const path = pathRef.current;
    let waypoint = path[pathIndexRef.current];
    if (waypoint && Math.hypot(waypoint.x - enemyPosition.x, waypoint.z - enemyPosition.z) <= WAYPOINT_REACHED_DISTANCE) {
      pathIndexRef.current = Math.min(pathIndexRef.current + 1, path.length - 1);
      waypoint = path[pathIndexRef.current];
    }

    target.set(waypoint?.x ?? playerPosition.x, enemyPosition.y, waypoint?.z ?? playerPosition.z);
    direction.subVectors(target, new THREE.Vector3(enemyPosition.x, enemyPosition.y, enemyPosition.z));
    const steeringDistance = direction.length();
    const attacking = now < attackEndsAtRef.current;
    const jumping = now < jumpEndsAtRef.current;
    const previousPosition = lastPositionRef.current;

    if (
      previousPosition &&
      Math.hypot(enemyPosition.x - previousPosition.x, enemyPosition.z - previousPosition.z) >= MIN_PROGRESS_DISTANCE
    ) {
      lastProgressAtRef.current = now;
    }
    lastPositionRef.current = { x: enemyPosition.x, z: enemyPosition.z };

    if (steeringDistance > 0.001) {
      direction.normalize();
      if (steeringDirection.lengthSq() === 0) {
        steeringDirection.copy(direction);
      } else {
        steeringDirection.lerp(direction, Math.min(1, delta * STEERING_RESPONSE)).normalize();
      }

      const facingAngle = Math.atan2(steeringDirection.x, steeringDirection.z);
      bodyRotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), facingAngle);
      body.setRotation(bodyRotation, true);

      if (modelRef.current) {
        modelRef.current.rotation.y = 0;
      }
    }

    if (playerDistance <= ATTACK_RANGE) {
      if (!jumping && !attacking && now >= nextAttackAtRef.current) {
        const attack = actionsRef.current.attack;
        attackEndsAtRef.current = now + (attack?.getClip().duration ?? 1);
        nextAttackAtRef.current = now + ATTACK_COOLDOWN;
        playAnimation('attack', false);
        takeDamage(ATTACK_DAMAGE, 'skeleton attack');
      } else if (!jumping && !attacking) {
        playAnimation('walk');
      }
      return;
    }

    if (!attacking) {
      const isBlocked = now - lastProgressAtRef.current >= BLOCKED_DURATION;
      const shouldStartJump = isGroundedRef.current && isBlocked && !jumping && now >= nextJumpAtRef.current;

      if (shouldStartJump) {
        startJump(now);
      }

      const shouldStopForGround = isGroundedRef.current || shouldStartJump;

      body.setLinvel({
        x: shouldStopForGround ? 0 : steeringDirection.x * CHASE_SPEED,
        y: body.linvel().y,
        z: shouldStopForGround ? 0 : steeringDirection.z * CHASE_SPEED,
      }, true);
      if (!jumping && !shouldStartJump) playAnimation('walk');
    }
  });

  return isAlive ? (
    <RigidBody
      ref={bodyRef}
      type="dynamic"
      position={position}
      colliders={false}
      enabledRotations={[false, false, false]}
      friction={0.5}
      gravityScale={2}
    >
      <CapsuleCollider args={[0.2, 1]} position={[0, 4, 0]} />
      <CylinderCollider
        sensor
        args={[0.15, 1]}
        position={[0, 3, 2.4]}
        onIntersectionEnter={handleGroundEnter}
        onIntersectionExit={handleGroundExit}
      />
      <group ref={modelRef} position={[0, 2.8, 0]} scale={ENEMY_SCALE} castShadow>
        <primitive object={model} />
      </group>
    </RigidBody>
  ) : null;
}

useGLTF.preload('/skeleton_voxy_anim.glb');