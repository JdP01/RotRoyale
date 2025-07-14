import { useGLTF } from '@react-three/drei';

/**
 * Map loader utility that handles loading map data and assets
 */
export class MapLoader {
  static loadMapData(mapName) {
    switch (mapName) {
      case 'beach':
        return import('../instructions/beachmap.json').then(module => module.default);
      default:
        throw new Error(`Map '${mapName}' not found`);
    }
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
    // Preload the main map
    useGLTF.preload(mapData.mapFile);
    
    // Get unique asset types from instances
    const assetTypes = new Set(mapData.instances.map(instance => instance.type));
    
    // Preload each asset type
    assetTypes.forEach(type => {
      switch (type) {
        case 'cactus':
          useGLTF.preload('/objects/cactus.glb');
          break;
        case 'palmtree':
          useGLTF.preload('/objects/palmTree.glb');
          break;
        case 'tree':
          useGLTF.preload('/objects/game_tree.glb');
          break;
        default:
          console.warn(`Unknown asset type for preloading: ${type}`);
      }
    });
  }

  static getAssetPath(type) {
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
  }
}
