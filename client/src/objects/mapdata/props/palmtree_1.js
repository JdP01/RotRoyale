import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

// Preload the GLTF model
useGLTF.preload('/objects/palmTree.glb');

export const PalmTreeProp = () => {
  const { scene, materials } = useGLTF('/objects/palmTree.glb');
  
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
    scale: [1.0, 1.0, 1.0], // Default scale
    boundingBox: new THREE.Box3().setFromObject(clonedScene)
  };
};

export const getPalmTreeGeometry = () => {
  const { scene } = useGLTF('/objects/palmTree.glb');
  const clonedScene = scene.clone();
  
  let geometry = null;
  clonedScene.traverse((child) => {
    if (child.isMesh && !geometry) {
      geometry = child.geometry;
    }
  });
  
  return geometry;
};

export const getPalmTreeMaterial = () => {
  const { scene } = useGLTF('/objects/palmTree.glb');
  const clonedScene = scene.clone();
  
  let material = null;
  clonedScene.traverse((child) => {
    if (child.isMesh && !material) {
      material = child.material;
    }
  });
  
  return material;
};
