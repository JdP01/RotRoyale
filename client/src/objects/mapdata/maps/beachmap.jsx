import React, { useMemo, useEffect, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { RigidBody, CuboidCollider, CylinderCollider, BallCollider, CapsuleCollider } from '@react-three/rapier';
import * as THREE from 'three';
import mapData from '../instructions/beachmap.json';

const InstancedProps = ({ propType, instances }) => {
  const instancedMeshRef = useRef();
  
  // Load scenes directly
  const scenes = {
    cactus: useGLTF('/objects/cactus.glb').scene,
    palmtree: useGLTF('/objects/palmTree.glb').scene,
    tree: useGLTF('/objects/game_tree.glb').scene
  };

  const { geometry, material } = useMemo(() => {
    const scene = scenes[propType];
    if (!scene) return { geometry: null, material: null };
    
    let geometry = null, material = null;
    scene.traverse((child) => {
      if (child.isMesh && !geometry) {
        geometry = child.geometry;
        material = child.material;
      }
    });
    return { geometry, material };
  }, [propType]);

  useEffect(() => {
    if (!instancedMeshRef.current || !geometry || !material) return;

    const tempMatrix = new THREE.Matrix4();
    instances.forEach((instance, index) => {
      tempMatrix.compose(
        new THREE.Vector3(...instance.position),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(...instance.rotation)),
        new THREE.Vector3(...instance.scale)
      );
      instancedMeshRef.current.setMatrixAt(index, tempMatrix);
    });
    instancedMeshRef.current.instanceMatrix.needsUpdate = true;
  }, [instances, geometry, material]);

  if (!geometry || !material || instances.length === 0) return null;

  return (
    <instancedMesh
      ref={instancedMeshRef}
      args={[geometry, material, instances.length]}
      castShadow
      receiveShadow
    />
  );
};

const InstancedPropsWithPhysics = ({ propType, instances }) => {
  if (instances.length === 0) return null;

  // Define multiple colliders with different shapes for each prop type
  const colliderConfigs = {
    cactus: [
      { 
        type: 'capsule', //Main Stem
        position: [-0.06, 0.5, 0.055], 
        args: [2, 0.4] 
      },
      { 
        type: 'capsule', 
        position: [-0.06, 0.75, -0.6], 
        args: [0.2, 0.35], // height, radius
        rotation: [0, Math.PI / 2, Math.PI / 2] // horizontal
      },
      { 
        type: 'capsule', 
        position: [-0.03, 0.3,1], 
        args: [0.3, 0.3], // height, radius
        rotation: [0, Math.PI / 2, Math.PI / 2] // horizontal
      }
    ],
    palmtree: [
      { 
        type: 'cuboid', 
        position: [-0.63, 2, -0.02], 
        args: [0.85, 8, 0.9] // trunk 
      }
    ],
    tree: [
      {
        type: 'cuboid',
        position: [-1.8, -2, -0.6], 
        args: [1.4,6,1.4]
      },
      { 
        type: 'ball', 
        position: [-1.8, 8, -0.6], 
        args: [7] // main canopy
      }
    ]
  };

  const propColliders = colliderConfigs[propType] || [
    { type: 'cylinder', position: [0, 2, 0], args: [4, 1] }
  ];

  // Render the appropriate collider component based on type
  const renderCollider = (collider, index) => {
    const commonProps = {
      position: collider.position,
      rotation: collider.rotation,
      args: collider.args
    };

    switch (collider.type) {
      case 'cylinder':
        return <CylinderCollider key={index} {...commonProps} />;
      case 'ball':
        return <BallCollider key={index} {...commonProps} />;
      case 'capsule':
        return <CapsuleCollider key={index} {...commonProps} />;
      case 'cuboid':
      default:
        return <CuboidCollider key={index} {...commonProps} />;
    }
  };

  return (
    <>
      {instances.map((instance) => (
        <RigidBody
          key={instance.id}
          type="fixed"
          position={instance.position}
          rotation={instance.rotation}
          friction={1}
          restitution={0}
        >
          {propColliders.map((collider, index) => renderCollider(collider, index))}
        </RigidBody>
      ))}
      <InstancedProps propType={propType} instances={instances} />
    </>
  );
};

const BeachMap = () => {
  const { scene: gameMap } = useGLTF(mapData.mapFile);

  const groupedInstances = useMemo(() => {
    const groups = {};
    mapData.instances.forEach((instance) => {
      if (!groups[instance.type]) groups[instance.type] = [];
      groups[instance.type].push(instance);
    });
    return groups;
  }, []);

  useEffect(() => {
    gameMap.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [gameMap]);

  const walls = [
    { pos: [58, 0, 0], args: [1, 100, 115] },
    { pos: [-58, 0, 0], args: [1, 100, 115] },
    { pos: [0, 0, 58], args: [115, 100, 1] },
    { pos: [0, 0, -58], args: [115, 100, 1] },
    { pos: [0, 50.5,0], args: [115, 1, 115] }
  ];

  return (
    <>
      <RigidBody colliders="trimesh" type="fixed" name="floor" friction={1} restitution={0}>
        <primitive 
          object={gameMap} 
          scale={mapData.mapScale}
          position={mapData.mapPosition || [0, 0, 0]}
          castShadow 
          receiveShadow 
        />
      </RigidBody>

      {walls.map((wall, i) => (
        <RigidBody key={i} type="fixed" colliders="cuboid" position={wall.pos}>
          <mesh>
            <boxGeometry args={wall.args} />
            <meshStandardMaterial color="purple" transparent opacity={0.1} depthWrite={false}/>
          </mesh>
        </RigidBody>
      ))}

      <mesh position={[0, -2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1000, 1000]} />
        <meshStandardMaterial 
          color="#0074ad" 
          transparent 
          opacity={0.8}
          metalness={0.1} 
          roughness={1} 
          envMapIntensity={0.8} 
        />
      </mesh>

      {Object.entries(groupedInstances).map(([propType, instances]) => (
        <InstancedPropsWithPhysics
          key={propType}
          propType={propType}
          instances={instances}
        />
      ))}
    </>
  );
};

export default BeachMap;