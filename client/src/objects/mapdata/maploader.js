import React, { useState, useEffect } from 'react';
import { useGLTF } from '@react-three/drei';

/**
 * Map loader utility that handles loading map data and assets
 */
export class MapLoader {
  static loadMapData(mapName) {
    switch (mapName) {
      case 'beach':
        return import('../instructions/maptest.json').then(module => module.default);
      default:
        throw new Error(`Map '${mapName}' not found`);
    }
  }

  static async getMapComponent(mapName) {
    switch (mapName) {
      case 'beach':
        const { default: BeachMap } = await import('./maps/colliderInstancing');
        return BeachMap;
      default:
        throw new Error(`Map component '${mapName}' not found`);
    }
  }

  // Generic map loader that can create a map component from any JSON file
  static createMapFromJSON(jsonPath) {
    return ({ customMapData }) => {
      const [mapData, setMapData] = useState(customMapData || null);
      const [loading, setLoading] = useState(!customMapData);

      useEffect(() => {
        if (customMapData) return;

        const loadMapData = async () => {
          try {
            const data = await import(jsonPath);
            setMapData(data.default);
          } catch (error) {
            console.error(`Failed to load map data from ${jsonPath}:`, error);
          } finally {
            setLoading(false);
          }
        };

        loadMapData();
      }, [customMapData]);

      if (loading) return null;
      if (!mapData) return React.createElement('div', null, 'Failed to load map data');

      const { MapRenderer } = require('./maps/colliderInstancing');
      return React.createElement(MapRenderer, { mapData });
    };
  }

  static getAssetData(path) {
    const { scene } = useGLTF(path);
    let geometry = null;
    let material = null;
    
    scene.traverse((child) => {
      if (child.isMesh && !geometry) {
        geometry = child.geometry.clone(); // Clone to avoid sharing between instances
        material = child.material.clone(); // Clone material as well
        
        // Ensure proper shadow settings
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    
    return { geometry, material, scene: scene.clone() };
  }

  static preloadAssets(mapData) {
    // Import the object paths and preload function from colliderInstancing
    const { preloadAllObjects } = require('./maps/colliderInstancing');
    
    // Preload the main map
    useGLTF.preload(mapData.mapFile);
    
    // Preload all available objects
    preloadAllObjects();
  }

  static getAssetPath(type) {
    // Import the object path getter from colliderInstancing
    const { getObjectPath } = require('./maps/colliderInstancing');
    
    const path = getObjectPath(type);
    if (!path) {
      throw new Error(`Unknown asset type: ${type}`);
    }
    return path;
  }
}
