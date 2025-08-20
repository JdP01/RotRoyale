# Character System

This directory contains the standardized character system that supports multiple character types through JSON configuration.

## Usage

### BasicCharacter Component

The `BasicCharacter` component is the main standardized character component that accepts a `characterType` parameter:

```jsx
import { BasicCharacter } from './basic';

// For Bear character
<BasicCharacter
  characterType="bear"
  ref={bodyRef}
  onRotationChange={onRotationChange}
  onCameraPitchChange={onCameraPitchChange}
  onAimingChange={onAimingChange}
  onButtonStatesChange={onButtonStatesChange}
  isNetworkedPlayer={false}
  networkButtonStates={null}
  networkPosition={null}
  networkRotation={null}
/>

// For Dino character
<BasicCharacter
  characterType="dino"
  // ... same props
/>
```

### Legacy Components

For backward compatibility, the old component names are still available:

```jsx
import { Bear, Dino } from './basic';

// These automatically use the correct characterType
<Bear {...props} />
<Dino {...props} />
```

## Configuration

Character configurations are defined in `basicDef.json`. Each character type has:

### Body Parts
- `body`: Main body model path
- `head`: Head model path
- `leftLeg`, `rightLeg`: Leg model paths
- `leftArm`, `rightArm`: Arm model paths
- `tail`: Tail model path (optional)
- `weapon`: Weapon model path

### Scale Settings
- `main`: Overall character scale
- Individual scales for each body part

### Positions
- Position offsets for each body part
- Weapon attachment positions

### Rotations
- Rotation values for each body part

### Physics
- Rapier physics settings
- Collider configurations
- Gravity and friction settings

### Movement
- Speed and sprint multipliers
- Jump force and fall damage settings
- Animation interpolation settings

### Animations
- Speed multipliers for different animation states
- Bob height and swing amounts
- Animation rate settings

## Adding New Characters

To add a new character type:

1. Add a new entry to `basicDef.json` with all required configuration
2. Place the 3D model files in the appropriate directory structure
3. Use `BasicCharacter` with the new `characterType`

Example:
```jsx
<BasicCharacter characterType="robot" {...props} />
```

## Error Handling

The component gracefully handles missing body parts by checking if models exist before rendering them. If a character type is not found in the configuration, it will log an error and return null.
