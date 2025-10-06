# Map Data

This directory contains map data and loaders for the game.

## Usage

### Loading a specific map:
```jsx
import BeachMap from './maps/colliderInstancing';
// Use BeachMap component directly - it loads beachmap.json automatically
```

### Using the generic map renderer:
```jsx
import { MapLoader } from './maploader';
import { MapRenderer } from './maps/colliderInstancing';

// Create a map component from any JSON file
const MyCustomMap = MapLoader.createMapFromJSON('../instructions/mymap.json');

// Or load map data and pass it to MapRenderer directly
const mapData = await MapLoader.loadMapData('beach');
<MapRenderer mapData={mapData} />
```

### Available Object Types:
The system now supports all objects in `/public/objects/`:
- `barn1`, `bush1`, `bush2`, `cactus`, `castle`
- `flag1`, `flag_stand`, `game_glock`, `game_tree`, `tree` (alias)
- `map2`, `palmtree`, `palmTree`, `tree1`

### JSON Structure:
Maps should follow this structure in their JSON files:
```json
{
  "mapName": "Map Name",
  "mapFile": "/objects/map.glb",
  "mapScale": [1, 1, 1],
  "mapPosition": [0, 0, 0],
  "instances": [
    {
      "id": "unique_id",
      "type": "cactus", // Any type from available objects
      "position": [x, y, z],
      "rotation": [rx, ry, rz],
      "scale": [sx, sy, sz]
    }
  ],
  "water": {
    "position": [0, -2, 0],
    "rotation": [-1.5708, 0, 0],
    "args": [1000, 1000],
    "color": "#0074ad",
    "opacity": 0.8,
    "metalness": 0.1,
    "roughness": 1,
    "envMapIntensity": 0.8
  },
  "walls": [
    { "position": [58, 0, 0], "args": [1, 100, 115] }
  ]
}
```

### Adding New Objects:
1. Add your `.glb` file to `/public/objects/`
2. Update `OBJECT_PATHS` in `colliderInstancing.jsx`
3. Add collider configuration in `colliders.js`
4. Use the object type in your JSON files

## File Structure:
- `maploader.js` - Utility functions for loading maps and assets
- `maps/colliderInstancing.jsx` - Contains both MapRenderer (generic) and BeachMap (specific) components
- `maps/colliders.js` - Collider configuration for different object types
- `instructions/` - JSON files containing map data