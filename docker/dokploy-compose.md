# Deploy Synapse on Dokploy

Step-by-step guide for deploying `dokploy-compose.yml` as a Compose app on a Dokploy server.

## 1. DNS

Point an A record at your Dokploy server, e.g. `matrix.example.com → <server IP>`.

## 2. Create the app

Dokploy → your project → **Create Service** → **Compose** → name it (e.g. `matrix`).

## 3. Provider: Git or Raw

- **Git**: point it at this repo, set Compose Path to `docker/dokploy-compose.yml`.
- **Raw**: paste the contents of `docker/dokploy-compose.yml` into the editor.

## 4. Environment tab

Add:

```
SYNAPSE_DOMAIN=matrix.example.com
SYNAPSE_SERVER_NAME=matrix.example.com
POSTGRES_PASSWORD=<long random string>
REGISTRATION_SHARED_SECRET=<another long random string>
```

- `SYNAPSE_DOMAIN` — public hostname Traefik routes to Synapse.
- `SYNAPSE_SERVER_NAME` — identity baked into user IDs (`@alice:matrix.example.com`). Usually equal to `SYNAPSE_DOMAIN`. Don't change after first deploy.

## 5. Domains tab

Add `matrix.example.com`, service `synapse`, port `8008`, HTTPS on, Let's Encrypt.

This duplicates the Traefik labels in the compose file — pick one. If you use the UI, you can delete the `traefik.*` labels from the compose.

## 6. Deploy

Click **Deploy**. Synapse will fail the first time — that's expected, it has no config yet.

## 7. Generate config (one-time)

Dokploy → service → **Terminal** (or SSH to the server) and run:

```
docker compose run --rm synapse generate
```

## 8. Edit `homeserver.yaml`

From the same terminal:

```
docker compose run --rm synapse sh -c "vi /data/homeserver.yaml"
```

Replace the `database:` block and add registration settings:

```yaml
database:
  name: psycopg2
  args:
    user: synapse
    password: ${POSTGRES_PASSWORD}
    database: synapse
    host: postgres
    cp_min: 5
    cp_max: 10

enable_registration: true
enable_registration_without_verification: true
registration_shared_secret: "${REGISTRATION_SHARED_SECRET}"
```

Save.

## 9. Redeploy

Hit **Deploy** again. Wait for the healthcheck to go green.

## 10. Create first user

```
docker compose exec synapse register_new_matrix_user \
  -u alice -p alicepass -a \
  -c /data/homeserver.yaml http://localhost:8008
```

## 11. Verify

```
curl https://matrix.example.com/_matrix/client/versions
```

Should return JSON. Point your client at `https://matrix.example.com`.

## Prerequisites recap

- DNS A/AAAA record for `SYNAPSE_DOMAIN` pointing at the Dokploy server.
- Ports 80 + 443 reachable on the server (Let's Encrypt HTTP-01 challenge).
- `dokploy-network` exists on the server (created automatically by Dokploy on install).
