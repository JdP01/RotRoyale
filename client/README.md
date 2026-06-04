# Rot Royale Client

This client supports two modes:

- `full game mode`: login + matchmaking + multiplayer backend integration.
- `portfolio showcase mode`: backend-free single-player 3D demo for embedding in a portfolio tab.

## Portfolio showcase mode

Showcase mode skips login and matchmaking and opens a lightweight intro page with character selection and a button to launch the 3D demo.

### Enable with environment variable

Create `.env` (or `.env.production`) in `client/`:

```bash
VITE_PORTFOLIO_MODE=true
```

Then run/build as normal.

### Enable with URL parameter

You can also keep normal mode as default and open showcase mode only on demand:

```text
https://your-domain.example/rot-royale?showcase=1
```

## Embedding inside a portfolio tab

Recommended approach:

1. Deploy this client as a standalone app route (for example `/rot-royale`).
2. In your portfolio site, add a tab that loads that route in an `iframe` or links to it in the same SPA route shell.
3. Run Rot Royale in showcase mode (`VITE_PORTFOLIO_MODE=true` or `?showcase=1`) to avoid backend dependencies.

This keeps your portfolio app lean while still presenting the full 3D interaction stack.

## Controls

- `WASD`: move
- `Shift`: sprint
- `Space`: jump
- `Mouse`: look/aim
