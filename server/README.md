# Rot Royale Server Deployment

This module is self-contained and intended to run behind the shared Nginx gateway on the external Docker network `web-gateway`.

## Architecture

- `postgres`: private database, reachable only on the module's internal Docker network.
- `nakama`: game backend, reachable internally on port `7350` and attached to `web-gateway` for the gateway proxy.
- No service in this module publishes host ports.

## Required setup

1. Create the shared network once on the host:
   `docker network create web-gateway`
2. Copy `.env.example` to `.env` and set strong production credentials.
3. Start the module:
   `docker compose up -d --build`

## Gateway target

The Nginx gateway should proxy the Rot Royale API domain to:

- Upstream host: `nakama`
- Upstream port: `7350`

If you need Nakama runtime HTTP endpoints instead, proxy to port `7352` explicitly on a separate route.

## Notes

- Nakama console traffic on `7351` is not published to the host in this production shape.
- Because `nakama` is also attached to `web-gateway`, the shared gateway container can resolve it by service name.
- Postgres remains isolated on the module's internal network.
