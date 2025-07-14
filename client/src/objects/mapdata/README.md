# 3D Map System with Instanced Meshing

This document describes the 3D map system that uses instanced meshing for optimized rendering of props and objects.

## System Overview

The map system is designed to efficiently render multiple instances of the same 3D models (props) using THREE.js InstancedMesh for optimal performance. Each prop type is defined once and then instantiated multiple times with different positions, rotations, and scales.

## Directory Structure

```
src/objects/mapdata/
├── maps/
│   └── beachmap.js          # Main beach map implementation
├── props/
│   ├── cactus_1.js          # Cactus prop definition
│   ├── palmtree_1.js        # Palm tree prop definition
│   └── tree_1.js            # Tree prop definition
├── instructions/
│   └── beachmap.json        # Map layout data
└── maploader.js             # Utility functions for loading assets
```

## Prop Definition Files

Each prop file (e.g., `cactus_1.js`) exports functions to get geometry and materials from GLTF models:

```javascript
import { useGLTF } from '@react-three/drei';

export const getCactusGeometry = () => { /* ... */ };
export const getCactusMaterial = () => { /* ... */ };
```

### Available Props
- **Cactus**: `/objects/cactus.glb`
- **Palm Tree**: `/objects/palmTree.glb`
- **Tree**: `/objects/game_tree.glb`

## Map Layout File

The `beachmap.json` file defines:
- Map metadata (name, file, scale)
- Array of instance definitions with:
  - `id`: Unique identifier
  - `type`: Prop type (cactus, palmtree, tree)
  - `position`: [x, y, z] coordinates
  - `rotation`: [x, y, z] Euler angles
  - `scale`: [x, y, z] scale factors

### Example Instance Definition
```json
{
  "id": "cactus_001",
  "type": "cactus",
  "position": [-20, -40.1, -40],
  "rotation": [0, 1.047, 0],
  "scale": [0.3, 0.3, 0.3]
}
```

## Performance Features

### Instanced Rendering
- Props of the same type are batched into a single `InstancedMesh`
- Dramatically reduces draw calls
- Supports hundreds of instances with minimal performance impact

### Physics Optimization
- Each instance has its own physics body for collision detection
- Invisible collision meshes for physics
- Visible instanced meshes for rendering

### Asset Preloading
- All GLTF models are preloaded for smooth performance
- Geometry and materials are cloned to avoid conflicts

## Usage

### In GameEnvironment.jsx
```javascript
import BeachMap from '../mapdata/maps/beachmap.js';

const GameEnvironment = () => {
  return (
    <>
      {/* Lighting setup */}
      <BeachMap />
    </>
  );
};
```

### Adding New Props
1. Create a new prop definition file in `props/`
2. Add the model file to `public/objects/`
3. Update `MapLoader.getAssetPath()` to include the new type
4. Add instances to the JSON layout file

### Adding New Maps
1. Create a new JSON layout file in `instructions/`
2. Create a new map implementation in `maps/`
3. Import and use the map in `GameEnvironment.jsx`

## Current Statistics

- **Total Instances**: 23 objects
  - 8 Cacti (instanced as 1 mesh)
  - 6 Palm Trees (instanced as 1 mesh)
  - 8 Trees (instanced as 1 mesh)
- **Draw Calls**: Reduced from 23 to 3 (plus main map)
- **Physics Bodies**: 23 individual collision bodies

## Benefits

1. **Performance**: Significantly reduced draw calls
2. **Memory Efficiency**: Shared geometry and materials
3. **Scalability**: Easy to add hundreds of instances
4. **Maintainability**: Clean separation of data and logic
5. **Flexibility**: Easy to modify positions, rotations, and scales
6. **Physics Integration**: Full collision detection for each instance

## Technical Details

### Instance Matrix Updates
Each instance's transformation is stored as a 4x4 matrix in the InstancedMesh, allowing the GPU to handle positioning, rotation, and scaling efficiently.

### Shadow Support
All instanced meshes support both casting and receiving shadows for realistic lighting.

### Material Cloning
Materials are cloned to prevent shared state issues between different prop types.
