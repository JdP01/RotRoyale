import React, { useMemo, useEffect, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { RigidBody } from '@react-three/rapier';
import * as THREE from 'three';

// Import map layout data
import mapData from '../instructions/beachmap.json';

// Preload all models
useGLTF.preload('/objects/Map2.glb');
useGLTF.preload('/objects/cactus.glb');
useGLTF.preload('/objects/palmTree.glb');
useGLTF.preload('/objects/game_tree.glb');

// Helper function to get asset path
const getAssetPath = (type) => {
  switch (type) {
    case 'cactus':
      return '/objects/cactus.glb';
    case 'palmtree':
      return '/objects/palmTree.glb';
    case 'tree':
      return '/objects/game_tree.glb';
    default:
      throw new Error(`Unknown asset type: ${type}`);
  }
};

// Helper function to extract geometry and material from GLTF
const getAssetData = (path) => {
  const { scene } = useGLTF(path);
  let geometry = null;
  let material = null;
  
  scene.traverse((child) => {
    if (child.isMesh && !geometry) {
      geometry = child.geometry.clone();
      material = child.material.clone();
      
      // Ensure proper shadow settings
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  
  return { geometry, material };
};

const InstancedProps = ({ propType, instances }) => {
  const instancedMeshRef = useRef();
  
  const { geometry, material } = useMemo(() => {
    try {
      const assetPath = getAssetPath(propType);
      return getAssetData(assetPath);
    } catch (error) {
      console.warn(`Error loading asset for ${propType}:`, error);
      return { geometry: null, material: null };
    }
  }, [propType]);

  const instanceCount = instances.length;

  // Create transformation matrices for each instance
  useEffect(() => {
    if (!instancedMeshRef.current || !geometry || !material) return;

    const tempMatrix = new THREE.Matrix4();
    const tempPosition = new THREE.Vector3();
    const tempRotation = new THREE.Euler();
    const tempScale = new THREE.Vector3();

    instances.forEach((instance, index) => {
      // Set position, rotation, and scale
      tempPosition.set(...instance.position);
      tempRotation.set(...instance.rotation);
      tempScale.set(...instance.scale);

      // Create transformation matrix
      tempMatrix.compose(
        tempPosition,
        new THREE.Quaternion().setFromEuler(tempRotation),
        tempScale
      );

      // Apply matrix to instance
      instancedMeshRef.current.setMatrixAt(index, tempMatrix);
    });

    // Update the instanced mesh
    instancedMeshRef.current.instanceMatrix.needsUpdate = true;
  }, [instances, geometry, material]);

  if (!geometry || !material || instanceCount === 0) {
    return null;
  }

  return (
    <instancedMesh
      ref={instancedMeshRef}
      args={[geometry, material, instanceCount]}
      castShadow
      receiveShadow
    />
  );
};

const InstancedPropsWithPhysics = ({ propType, instances }) => {
  if (instances.length === 0) return null;

  const { geometry } = useMemo(() => {
    try {
      const assetPath = getAssetPath(propType);
      return getAssetData(assetPath);
    } catch (error) {
      console.warn(`Error loading physics geometry for ${propType}:`, error);
      return { geometry: null };
    }
  }, [propType]);

  return (
    <>
      {instances.map((instance) => (
        <RigidBody
          key={instance.id}
          colliders="hull"
          type="fixed"
          name={`${propType}_${instance.id}`}
          position={instance.position}
          rotation={instance.rotation}
          friction={1}
          restitution={0}
        >
          {/* Invisible mesh for physics collision */}
          <mesh visible={false} scale={instance.scale}>
            {geometry && <primitive object={geometry} />}
          </mesh>
        </RigidBody>
      ))}
      
      {/* Visible instanced mesh for rendering */}
      <InstancedProps propType={propType} instances={instances} />
    </>
  );
};

const BeachMap = () => {
  const { scene: gameMap } = useGLTF(mapData.mapFile);

  // Group instances by prop type for efficient rendering
  const groupedInstances = useMemo(() => {
    const groups = {};
    
    mapData.instances.forEach((instance) => {
      if (!groups[instance.type]) {
        groups[instance.type] = [];
      }
      groups[instance.type].push(instance);
    });

    console.log('Grouped instances for instanced rendering:', groups);
    return groups;
  }, []);

  // Set up shadows on the main map
  useEffect(() => {
    gameMap.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [gameMap]);

  return (
    <>
      {/* Main map mesh with physics */}
      <RigidBody
        colliders="trimesh"
        type="fixed"
        name="floor"
        interpolate={true}
        friction={1}
        restitution={0}
      >
        <primitive 
          object={gameMap} 
          scale={mapData.mapScale} 
          castShadow 
          receiveShadow 
        />
      </RigidBody>

      {/* Water mesh */}
      <mesh position={[0, -41.9, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial 
          color="#0074ad" 
          transparent 
          opacity={0.8}
          metalness={0.1} 
          roughness={1} 
          envMapIntensity={0.8} 
        />
      </mesh>

      {/* Render all prop types using instanced meshes */}
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
