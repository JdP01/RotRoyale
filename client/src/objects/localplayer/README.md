# Local Player Folder

This folder is the local player character system. It handles the character model, movement, camera, and animation for the user-controlled avatar.

## Big picture

- `basic.jsx` builds the actual character
- `basicDef.json` tells the game how each character looks and behaves
- `controls.js` handles keyboard input, movement, sprinting, jumping, and aiming
- `CameraRig.jsx` makes the camera follow the player smoothly
- `basicAnimation.js` animates the body while moving

## Files

### `basic.jsx`
Main player character component.

- Creates the 3D player body and loads the correct models for the chosen character type
- Supports both bear and dino through the `characterType` prop
- Sets up refs for body parts like arms, legs, head, tail, and main group
- Keeps movement state like walking, sprinting, and jumping
- Connects movement logic and animation updates
- Exposes a wrapper export for `Bear` and `Dino`

### `basicAnimation.js`
Shared animation logic for the local player.

- Handles walk/run animation timing
- Moves legs and arms in opposite phases for natural motion
- Adds body bobbing and head motion
- Supports jump pose and idle reset behavior
- Can be tuned with config values for each character type

### `bearAnimation.js`
Older or experimental bear-specific animation hook.

- Looks similar to the main animation system
- Not actively used in the current app flow
- Likely leftover code from an earlier version

### `basicDef.json`
Character configuration file.

- Stores body model paths for each character type
- Defines scaling, positions, rotations, and physics data
- Includes movement settings like speed, sprint, jump, and camera lerp
- Includes animation tuning values for bear and dino
- This is the main place to adjust a character without rewriting logic

### `controls.js`
Player input and movement controller.

- Reads keyboard input
- Handles forward/back/left/right movement
- Tracks sprint stamina and exhaustion
- Handles jumping and ground checks
- Updates button states for networking
- Controls aiming and mouse-based camera rotation

### `CameraRig.jsx`
Camera follow system.

- Keeps the camera behind the player
- Smooths camera motion for a nicer feel
- Adjusts distance and height while aiming
- Makes the camera look toward the character and forward direction

## Notes

- This folder is for the local player only.
- The shared game logic for other players usually lives elsewhere.
- If you want to change a character, start with `basicDef.json` and then tweak animation or movement logic in the matching files.
