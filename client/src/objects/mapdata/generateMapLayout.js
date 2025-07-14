/**
 * Map Layout Generator Utility
 * 
 * This utility helps generate random prop layouts for maps.
 * Usage: node generateMapLayout.js > newmap.json
 */

const fs = require('fs');

// Configuration for prop generation
const PROP_TYPES = ['cactus', 'palmtree', 'tree'];
const MAP_BOUNDS = {
  x: [-80, 80],
  z: [-80, 80],
  y: -40.1 // Fixed Y position for props
};

const PROP_COUNTS = {
  cactus: { min: 5, max: 12 },
  palmtree: { min: 4, max: 8 },
  tree: { min: 6, max: 10 }
};

const PROP_SCALES = {
  cactus: { min: 0.25, max: 0.4 },
  palmtree: { min: 0.8, max: 1.2 },
  tree: { min: 0.9, max: 1.3 }
};

// Helper functions
const randomBetween = (min, max) => Math.random() * (max - min) + min;
const randomInt = (min, max) => Math.floor(randomBetween(min, max));

const generateRandomPosition = () => [
  randomBetween(MAP_BOUNDS.x[0], MAP_BOUNDS.x[1]),
  MAP_BOUNDS.y,
  randomBetween(MAP_BOUNDS.z[0], MAP_BOUNDS.z[1])
];

const generateRandomRotation = () => [
  0,
  randomBetween(0, Math.PI * 2),
  0
];

const generateRandomScale = (propType) => {
  const scaleRange = PROP_SCALES[propType];
  const scale = randomBetween(scaleRange.min, scaleRange.max);
  return [scale, scale, scale];
};

const generateMapLayout = (mapName = 'Generated Map') => {
  const instances = [];
  let instanceCounter = 1;

  // Generate instances for each prop type
  PROP_TYPES.forEach(propType => {
    const countRange = PROP_COUNTS[propType];
    const count = randomInt(countRange.min, countRange.max + 1);

    for (let i = 0; i < count; i++) {
      const instance = {
        id: `${propType}_${String(instanceCounter).padStart(3, '0')}`,
        type: propType,
        position: generateRandomPosition(),
        rotation: generateRandomRotation(),
        scale: generateRandomScale(propType)
      };

      instances.push(instance);
      instanceCounter++;
    }
  });

  // Sort instances by type for better organization
  instances.sort((a, b) => a.type.localeCompare(b.type));

  return {
    mapName,
    mapFile: '/objects/Map2.glb',
    mapScale: [4.5, 4.5, 4.5],
    instances
  };
};

// Generate and output the map layout
const mapLayout = generateMapLayout('Generated Beach Map');
console.log(JSON.stringify(mapLayout, null, 2));

// If running as a script, also save to file
if (require.main === module) {
  const outputFile = './generated_map.json';
  fs.writeFileSync(outputFile, JSON.stringify(mapLayout, null, 2));
  console.error(`\nMap layout saved to ${outputFile}`);
  console.error(`Total instances: ${mapLayout.instances.length}`);
  
  // Count by type
  const typeCounts = {};
  mapLayout.instances.forEach(instance => {
    typeCounts[instance.type] = (typeCounts[instance.type] || 0) + 1;
  });
  
  console.error('Instances by type:');
  Object.entries(typeCounts).forEach(([type, count]) => {
    console.error(`  ${type}: ${count}`);
  });
}

module.exports = { generateMapLayout };
