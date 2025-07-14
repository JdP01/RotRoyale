import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

// Preload the GLTF model
useGLTF.preload('/objects/cactus.glb');

export const CactusProp = () => {
  const { scene, materials } = useGLTF('/objects/cactus.glb');
  
  // Clone the scene to avoid modifying the original
  const clonedScene = scene.clone();
  
  // Extract geometry and material from the first mesh found
  let geometry = null;
  let material = null;
  
  clonedScene.traverse((child) => {
    if (child.isMesh && !geometry) {
      geometry = child.geometry;
      material = child.material;
      
      // Ensure proper shadow settings
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  
  return {
    geometry,
    material,
    scale: [0.3, 0.3, 0.3], // Default scale
    boundingBox: new THREE.Box3().setFromObject(clonedScene)
  };
};

export const getCactusGeometry = () => {
  const { scene } = useGLTF('/objects/cactus.glb');
  const clonedScene = scene.clone();
  
  let geometry = null;
  clonedScene.traverse((child) => {
    if (child.isMesh && !geometry) {
      geometry = child.geometry;
    }
  });
  
  return geometry;
};

export const getCactusMaterial = () => {
  const { scene } = useGLTF('/objects/cactus.glb');
  const clonedScene = scene.clone();
  
  let material = null;
  clonedScene.traverse((child) => {
    if (child.isMesh && !material) {
      material = child.material;
    }
  });
  
  return material;
};
