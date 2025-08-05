import React, { useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

export const RaycastVisualizer = ({ isVisible, startPosition, endPosition, duration = 5000, color = "red" }) => {
  const lineRef = useRef();
  const materialRef = useRef();
  const [opacity, setOpacity] = useState(1);
  const startTime = useRef(null);

  useEffect(() => {
    if (isVisible) {
      setOpacity(1);
      startTime.current = Date.now();
    }
  }, [isVisible]);

  useFrame(() => {
    if (!isVisible || !startTime.current) return;

    const elapsed = Date.now() - startTime.current;
    const progress = elapsed / duration;

    if (progress >= 1) {
      setOpacity(0);
      startTime.current = null;
    } else {
      // Fade out the line over time, but keep it visible longer
      const newOpacity = 1 - (progress * 0.7); // Slower fade
      setOpacity(Math.max(0.3, newOpacity)); // Keep more opacity
    }

    // Update material opacity
    if (materialRef.current) {
      materialRef.current.opacity = opacity;
    }
  });

  if (!isVisible || !startPosition || !endPosition) {
    return null;
  }

  // Create line geometry
  const points = [
    new THREE.Vector3(startPosition.x, startPosition.y, startPosition.z),
    new THREE.Vector3(endPosition.x, endPosition.y, endPosition.z)
  ];
  const geometry = new THREE.BufferGeometry().setFromPoints(points);

  return (
    <line ref={lineRef} geometry={geometry}>
      <lineBasicMaterial
        ref={materialRef}
        color={color}
        linewidth={5}
        transparent={true}
        opacity={opacity}
      />
    </line>
  );
};

export default RaycastVisualizer;
