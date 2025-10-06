// Collider configurations for different prop types
export const getColliderConfig = (propType) => {
  const colliderConfigs = {
    cactus: [
      { 
        type: 'capsule', //Main Stem
        position: [-0.06, 0.5, 0.055], 
        args: [2, 0.4] 
      },
      { 
        type: 'capsule', 
        position: [-0.06, 0.75, -0.6], 
        args: [0.2, 0.35], // height, radius
        rotation: [0, Math.PI / 2, Math.PI / 2] // horizontal
      },
      { 
        type: 'capsule', 
        position: [-0.03, 0.3, 1], 
        args: [0.3, 0.3], // height, radius
        rotation: [0, Math.PI / 2, Math.PI / 2] // horizontal
      }
    ],
    palmtree: [
      { 
        type: 'cuboid', 
        position: [-0.63, 2, -0.02], 
        args: [0.85, 8, 0.9] // trunk 
      }
    ],
    tree: [
      {
        type: 'cuboid',
        position: [-1.8, -2, -0.6], 
        args: [1.4, 6, 1.4]
      },
      { 
        type: 'ball', 
        position: [-1.8, 8, -0.6], 
        args: [7] // main canopy
      }
    ]
  };

  return colliderConfigs[propType] || [
    { type: 'cylinder', position: [0, 2, 0], args: [4, 1] }
  ];
};
