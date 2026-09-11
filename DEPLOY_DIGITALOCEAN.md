# Deploy Rot Royale To A DigitalOcean Droplet

This guide deploys the React/Vite frontend and Nakama backend on one Ubuntu DigitalOcean Droplet.

The public site is served at `https://game.example.com`. Caddy serves the built frontend and proxies Nakama's REST and WebSocket endpoints through the same hostname. This matches the frontend's current connection logic: outside localhost it connects to the page hostname over HTTPS on port 443.

## What This Deploys

- `client/`: static production files built with Vite and served by Caddy.
- `rot-royale`: a Nakama 3.27.1 container with this repository's Go runtime plugin.
- `postgres`: Nakama's private PostgreSQL 13 database.
- Caddy: TLS certificates, static-file hosting, SPA fallback, and Nakama proxying.

Only ports 80 and 443 are public. Nakama, PostgreSQL, and the Nakama console remain private to Docker by default.

## Before You Start

You need:

1. A DigitalOcean Ubuntu 24.04 or 22.04 Droplet. Start with at least 2 GB RAM and 1 vCPU; 4 GB RAM is more comfortable while building the Nakama plugin on the server.
2. A domain or subdomain, for example `game.example.com`.
3. SSH access using a non-root sudo user.
4. This repository available from a Git remote that the Droplet can clone.

Do not point DNS at the Droplet until the Droplet has a public IPv4 address. Caddy needs the DNS record to issue its TLS certificate.

## 1. Create The Droplet And DNS Record

1. In DigitalOcean, create an Ubuntu Droplet in a region near your players.
2. Add your SSH key during creation. Disable password authentication later in this guide.
3. Note the public IPv4 address, referred to below as `DROPLET_IP`.
4. At your DNS provider, add an `A` record:

   ```text
   Host: game
   Type: A
   Value: DROPLET_IP
   TTL: 300
   ```

5. Wait for DNS to resolve:

   ```bash
   dig +short game.example.com
   ```

   The result must be the Droplet IP before starting Caddy.

## 2. Prepare Ubuntu

SSH to the Droplet and create a regular deployment user if you do not already have one:

```bash
ssh root@DROPLET_IP
adduser deploy
usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy
exit
ssh deploy@DROPLET_IP
```

Update the operating system and configure the firewall:

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y ca-certificates curl git gnupg ufw

sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

Do not open ports `5432`, `7350`, `7351`, or `7352` in DigitalOcean's cloud firewall or UFW. Caddy is the only public entry point.

## 3. Install Docker Compose

Install Docker Engine from Docker's Ubuntu repository:

```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"
exit
```

Reconnect so the new Docker group applies, then verify the installation:

```bash
ssh deploy@DROPLET_IP
docker version
docker compose version
```

## 4. Clone The Project

Choose a stable application directory and clone the repository:

```bash
sudo mkdir -p /opt/rot-royale
sudo chown deploy:deploy /opt/rot-royale
git clone YOUR_GIT_REMOTE /opt/rot-royale
cd /opt/rot-royale
```

For a private repository, configure a deploy key or use a GitHub fine-grained token with read-only repository access. Do not paste a personal access token into a tracked file.

## 5. Replace Development Secrets Before First Start

This repository currently contains development values that must not be used on a public server:

- PostgreSQL password: `localdb`.
- Nakama session and refresh encryption keys in `server/nakama/local.yml`.
- Console credentials and allowed origins in `server/.env`.

Generate URL-safe secrets:

```bash
DB_PASSWORD=$(openssl rand -hex 24)
SESSION_KEY=$(openssl rand -hex 32)
REFRESH_KEY=$(openssl rand -hex 32)
CONSOLE_PASSWORD=$(openssl rand -hex 24)

printf 'Database password: %s\n' "$DB_PASSWORD"
printf 'Console password: %s\n' "$CONSOLE_PASSWORD"
```

Store these values in a password manager. The database password is embedded in the current Docker and Nakama configuration, so change every `localdb` occurrence consistently before building:

```bash
cd /opt/rot-royale
grep -R --line-number --fixed-strings 'localdb' docker-compose.yml server
```

Update these files on the Droplet:

1. `docker-compose.yml`: replace the PostgreSQL `POSTGRES_PASSWORD` value.
2. `server/dockerfile`: replace both `localdb` occurrences in the PostgreSQL connection strings.
3. `server/nakama/local.yml`: replace its PostgreSQL password and both session encryption keys.

Use the generated values, not the example strings. The current container startup script uses `CONSOLE_USERNAME`, `CONSOLE_PASSWORD`, and `ALLOWED_ORIGINS` from `server/.env`; it does not currently consume the PostgreSQL variables listed in `.env.example`.

Create the production environment file from the example and edit it:

```bash
cp server/.env.example server/.env
chmod 600 server/.env
nano server/.env
```

Set at least these exact keys:

```dotenv
CONSOLE_USERNAME=admin
CONSOLE_PASSWORD=GENERATED_CONSOLE_PASSWORD
ALLOWED_ORIGINS=https://game.example.com
```

Important: the existing checked-in `server/.env` contains `AALLOWED_ORIGINS` with an extra `A`. Use `ALLOWED_ORIGINS` exactly as shown above. If you serve both `game.example.com` and another hostname, list both allowed HTTPS origins according to the comment in `server/.env.example`.

Do not commit the production `.env` or the Droplet-only secret edits. A future improvement should refactor the database and Nakama session secrets to environment-variable substitution so deploy configuration stays outside the repository.

## 6. Create The Shared Proxy Network

The production `docker-compose.yml` expects an external Docker network named `web-gateway`. Create it once:

```bash
docker network create web-gateway
```

If Docker reports that it already exists, continue. This network lets Caddy reach the private `rot-royale` service by Docker service name.

## 7. Build The Frontend

Build static frontend files on the Droplet:

```bash
cd /opt/rot-royale/client
npm ci
npm run build
test -f dist/index.html && echo 'Frontend build ready'
```

The result is `client/dist/`. Caddy will mount this directory read-only. Do not run the Vite development server in production.

## 8. Add Caddy For Frontend Hosting And Nakama Proxying

Create a proxy directory:

```bash
cd /opt/rot-royale
mkdir -p deploy
```

Create `deploy/Caddyfile` and replace `game.example.com` with your actual hostname:

```caddyfile
game.example.com {
    encode zstd gzip

    @nakama path /v2/* /ws /ws/* /healthcheck
    reverse_proxy @nakama rot-royale:7350

    root * /srv
    try_files {path} /index.html
    file_server

    header {
        -Server
        X-Content-Type-Options nosniff
        Referrer-Policy strict-origin-when-cross-origin
    }
}
```

Create `docker-compose.proxy.yml` in the repository root:

```yaml
services:
  caddy:
    image: caddy:2.8-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./deploy/Caddyfile:/etc/caddy/Caddyfile:ro
      - ./client/dist:/srv:ro
      - caddy_data:/data
      - caddy_config:/config
    networks:
      - web-gateway

volumes:
  caddy_data:
  caddy_config:

networks:
  web-gateway:
    external: true
```

Caddy automatically obtains and renews Let's Encrypt certificates after DNS resolves and ports 80 and 443 are reachable. The `reverse_proxy` directive supports Nakama WebSocket upgrades automatically.

## 9. Start Backend And Frontend

Start the complete stack:

```bash
cd /opt/rot-royale
docker compose -f docker-compose.yml -f docker-compose.proxy.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.proxy.yml ps
```

Watch startup logs until the database migration and Nakama module initialization complete:

```bash
docker compose logs --follow postgres rot-royale caddy
```

Look for the backend log message indicating that the custom runtime plugin loaded. Press `Ctrl+C` to stop following logs; it does not stop containers.

## 10. Verify The Deployment

Run these from the Droplet:

```bash
curl -I https://game.example.com
curl -fsS https://game.example.com/healthcheck
docker compose ps
```

Then verify in a browser:

1. Open `https://game.example.com`.
2. Confirm the page loads with no mixed-content or CORS errors in browser developer tools.
3. Create a guest account or sign in.
4. Confirm the Nakama WebSocket connects.
5. Start a game and test a match, health pickup, and round transition.

If login fails, inspect both proxy and Nakama logs:

```bash
docker compose logs --tail=200 caddy
docker compose logs --tail=200 rot-royale
```

## 11. Access The Nakama Console Safely

Do not publish port 7351 to the internet. To access the console temporarily, create a local-only compose override on the Droplet:

```bash
cat > docker-compose.console.yml <<'EOF'
services:
  rot-royale:
    ports:
      - "127.0.0.1:7351:7351"
EOF

docker compose -f docker-compose.yml -f docker-compose.proxy.yml -f docker-compose.console.yml up -d rot-royale
```

From your own computer, create an SSH tunnel:

```bash
ssh -L 7351:127.0.0.1:7351 deploy@DROPLET_IP
```

Open `http://127.0.0.1:7351` locally and sign in with the console credentials from `server/.env`. Remove the temporary override and recreate the backend without it when finished:

```bash
rm docker-compose.console.yml
docker compose -f docker-compose.yml -f docker-compose.proxy.yml up -d rot-royale
```

## 12. Deploy Updates

For a normal application update:

```bash
cd /opt/rot-royale
git fetch origin
git pull --ff-only

cd client
npm ci
npm run build
cd ..

docker compose -f docker-compose.yml -f docker-compose.proxy.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.proxy.yml ps
```

If you changed only frontend files, rebuild `client/dist` and restart Caddy to refresh its mounted files:

```bash
cd /opt/rot-royale/client
npm ci
npm run build
cd ..
docker compose -f docker-compose.yml -f docker-compose.proxy.yml restart caddy
```

Before `git pull`, preserve the Droplet-only secret modifications described in step 5. Do not overwrite your production `.env`, database password, or session keys.

## 13. Backup And Recovery

The named `pgdata` Docker volume contains player accounts, wallets, matches, and Nakama data. Back it up before updates that change Nakama or PostgreSQL versions:

```bash
mkdir -p /opt/rot-royale/backups
docker compose exec -T postgres pg_dump -U nakama nakama | gzip > /opt/rot-royale/backups/nakama-$(date +%F-%H%M%S).sql.gz
```

Copy backups off the Droplet with DigitalOcean Spaces, `scp`, or another backup provider. A backup stored only on the same Droplet does not protect against Droplet loss.

To restore a known backup, stop the application first and restore only after confirming the target database is the intended one:

```bash
gunzip -c /path/to/nakama-backup.sql.gz | docker compose exec -T postgres psql -U nakama -d nakama
```

## 14. Useful Operations

```bash
# Container status
docker compose -f docker-compose.yml -f docker-compose.proxy.yml ps

# Follow backend logs
docker compose -f docker-compose.yml -f docker-compose.proxy.yml logs -f rot-royale

# Restart only Nakama after a configuration change
docker compose -f docker-compose.yml -f docker-compose.proxy.yml up -d --build rot-royale

# Stop the stack without deleting database data
docker compose -f docker-compose.yml -f docker-compose.proxy.yml down

# Do not run this unless you intentionally want to erase all database data
docker compose -f docker-compose.yml -f docker-compose.proxy.yml down -v
```

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Caddy cannot obtain a certificate | Confirm DNS points to the Droplet and ports 80/443 are open in UFW and the DigitalOcean cloud firewall. |
| Frontend loads but login fails | Verify `ALLOWED_ORIGINS=https://game.example.com`, inspect `rot-royale` logs, and ensure Caddy proxies `/v2/*` and `/ws/*` to port 7350. |
| WebSocket disconnects | Confirm the browser uses HTTPS, Caddy is running, and the `@nakama` matcher includes `/ws` and `/ws/*`. |
| Backend restarts repeatedly | Run `docker compose logs rot-royale`; most first-start failures are an inconsistent database password or missing `CONSOLE_*` variables. |
| Database data is missing | Check that you did not run `docker compose down -v` and that the `pgdata` volume still exists with `docker volume ls`. |
| `web-gateway` network error | Run `docker network create web-gateway`, then start the compose stack again. |