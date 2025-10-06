import React, { useMemo, useEffect, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { RigidBody, CuboidCollider, CylinderCollider, BallCollider, CapsuleCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { getColliderConfig } from './colliders';

// Object type to file mapping - covers all objects in public/objects
const OBJECT_PATHS = {
  barn1: '/objects/barn1.glb',
  bush1: '/objects/bush1.glb',
  bush2: '/objects/bush2.glb',
  cactus: '/objects/cactus.glb',
  castle: '/objects/castle.glb',
  flag1: '/objects/flag1.glb',
  flag_stand: '/objects/flag_stand.glb',
  game_tree: '/objects/game_tree.glb',
  tree: '/objects/game_tree.glb', // Alias for backward compatibility
  map2: '/objects/map2.glb',
  palmtree: '/objects/palmTree.glb', // Alias for backward compatibility
  palmTree: '/objects/palmTree.glb',
  tree1: '/objects/tree1.glb'
};

// Get object path by type
export const getObjectPath = (type) => {
  return OBJECT_PATHS[type] || null;
};

// Preload assets dynamically based on map data
const preloadAssets = (mapData) => {
  // Preload the main map file
  useGLTF.preload(mapData.mapFile);
  
  // Get unique object types from instances and preload them
  const objectTypes = new Set(mapData.instances.map(instance => instance.type));
  objectTypes.forEach(type => {
    const path = getObjectPath(type);
    if (path) {
      useGLTF.preload(path);
    } else {
      console.warn(`Unknown object type for preloading: ${type}`);
    }
  });
};

// Preload all objects function for complete preloading
export const preloadAllObjects = () => {
  Object.values(OBJECT_PATHS).forEach(path => {
    useGLTF.preload(path);
  });
};

const InstancedProps = ({ propType, instances }) => {
  const instancedMeshRef = useRef();
  
  // Get the object path for this prop type
  const objectPath = getObjectPath(propType);
  
  // Load scene dynamically
  const scene = useMemo(() => {
    if (!objectPath) {
      console.warn(`No object path found for type: ${propType}`);
      return null;
    }
    try {
      return useGLTF(objectPath).scene;
    } catch (error) {
      console.error(`Failed to load object: ${objectPath}`, error);
      return null;
    }
  }, [objectPath]);

  const { geometry, material } = useMemo(() => {
    if (!scene) return { geometry: null, material: null };
    
    let geometry = null, material = null;
    scene.traverse((child) => {
      if (child.isMesh && !geometry) {
        geometry = child.geometry;
        material = child.material;
      }
    });
    return { geometry, material };
  }, [scene]);

  useEffect(() => {
    if (!instancedMeshRef.current || !geometry || !material) return;

    const mesh = instancedMeshRef.current;
    const tempMatrix = new THREE.Matrix4();
    
    instances.forEach((instance, index) => {
      tempMatrix.compose(
        new THREE.Vector3(...instance.position),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(...instance.rotation)),
        new THREE.Vector3(...instance.scale)
      );
      mesh.setMatrixAt(index, tempMatrix);
    });
    
    mesh.instanceMatrix.needsUpdate = true;
    
    // CRITICAL FIX: Compute bounding sphere to prevent frustum culling issues
    mesh.computeBoundingSphere();
    
    // OPTIONAL: Disable frustum culling entirely if instances cover large area
    // This prevents disappearing instances when camera moves fast
    mesh.frustumCulled = false;
    
  }, [instances, geometry, material]);

  if (!geometry || !material || instances.length === 0) return null;

  return (
    <instancedMesh
      ref={instancedMeshRef}
      args={[geometry, material, instances.length]}
      castShadow
      receiveShadow
      frustumCulled={false} // Prevent culling issues with spread-out instances
    />
  );
};

const InstancedPropsWithPhysics = ({ propType, instances }) => {
  if (instances.length === 0) return null;

  const propColliders = getColliderConfig(propType);
  
  // If no colliders defined, just render the visual mesh without physics
  if (!propColliders || propColliders.length === 0) {
    return <InstancedProps propType={propType} instances={instances} />;
  }
  
  // Check if this object type uses trimesh colliders
  const usesTrimesh = propColliders.some(collider => collider.type === 'trimesh');

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
      case 'trimesh':
        // For trimesh, we don't render a separate collider - it's handled by the RigidBody
        return null;
      case 'cuboid':
      default:
        return <CuboidCollider key={index} {...commonProps} />;
    }
  };

  // For trimesh colliders, we need to render each instance with its own trimesh collider
  if (usesTrimesh) {
    return (
      <>
        {instances.map((instance) => {
          // Get the object path to load the mesh for trimesh collider
          const objectPath = getObjectPath(propType);
          const { scene: objectScene } = useGLTF(objectPath);
          
          return (
            <RigidBody
              key={instance.id}
              type="fixed"
              position={instance.position}
              rotation={instance.rotation}
              scale={instance.scale}
              colliders="trimesh"
              friction={1}
              restitution={0}
            >
              <primitive 
                object={objectScene.clone()} 
                castShadow 
                receiveShadow 
              />
            </RigidBody>
          );
        })}
      </>
    );
  }

  // For regular colliders
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

// MapRenderer component that accepts mapData as prop
export const MapRenderer = ({ mapData }) => {
  // Validate mapData
  if (!mapData) {
    console.error('MapRenderer: mapData is required');
    return null;
  }
  
  // Preload assets when component mounts
  useMemo(() => {
    if (mapData) preloadAssets(mapData);
  }, [mapData]);
  
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
        // Ensure material supports shadows
        if (child.material) {
          child.material.shadowSide = THREE.DoubleSide;
        }
      }
    });
  }, [gameMap]);

  // Use walls from mapData or fallback to default
  const walls = mapData.walls || [
    { position: [58, 0, 0], args: [1, 100, 115] },
    { position: [-58, 0, 0], args: [1, 100, 115] },
    { position: [0, 0, 58], args: [115, 100, 1] },
    { position: [0, 0, -58], args: [115, 100, 1] },
    { position: [0, 50.5, 0], args: [115, 1, 115] }
  ];

  // Use water config from mapData or fallback to default
  const waterConfig = mapData.water || {
    position: [0, -2, 0],
    rotation: [-Math.PI / 2, 0, 0],
    args: [1000, 1000],
    color: "#0074ad",
    opacity: 0.8,
    metalness: 0.1,
    roughness: 1,
    envMapIntensity: 0.8
  };

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
        <RigidBody key={i} type="fixed" colliders="cuboid" position={wall.position}>
          <mesh>
            <boxGeometry args={wall.args} />
            <meshStandardMaterial color="purple" transparent opacity={0.1} depthWrite={false}/>
          </mesh>
        </RigidBody>
      ))}

      {/* Water plane */}
      <mesh 
        position={waterConfig.position} 
        rotation={waterConfig.rotation} 
        receiveShadow
      >
        <planeGeometry args={waterConfig.args} />
        <meshStandardMaterial 
          color={waterConfig.color}
          transparent 
          opacity={waterConfig.opacity}
          metalness={waterConfig.metalness}
          roughness={waterConfig.roughness}
          envMapIntensity={waterConfig.envMapIntensity}
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

// BeachMap component that loads beachmap.json automatically
const BeachMap = () => {
  const [mapData, setMapData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const loadMapData = async () => {
      try {
        const data = await import('../instructions/maptest.json');
        setMapData(data.default);
      } catch (error) {
        console.error('Failed to load beach map data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadMapData();
  }, []);

  if (loading) return null;
  if (!mapData) return React.createElement('div', null, 'Failed to load map data');

  return React.createElement(MapRenderer, { mapData });
};

export default BeachMap;