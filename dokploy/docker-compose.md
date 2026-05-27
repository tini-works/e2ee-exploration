# Deploy Synapse on Dokploy

Deploy `dokploy/docker-compose.yml` as a Compose app. Config is rendered from
env vars at startup, so there's nothing to generate or hand-edit.

## 1. DNS

Point an A record at the Dokploy server: `matrix.example.com → <server IP>`.

## 2. Create the app

Dokploy → project → **Create Service** → **Compose**. Point it at this repo,
Compose Path `dokploy/docker-compose.yml`.

## 3. Environment

```
SYNAPSE_DOMAIN=matrix.example.com
SYNAPSE_SERVER_NAME=matrix.example.com
POSTGRES_PASSWORD=<openssl rand -hex 32>
REGISTRATION_SHARED_SECRET=<openssl rand -hex 32>
```

`SYNAPSE_SERVER_NAME` is baked into user IDs (`@alice:matrix.example.com`) —
don't change it after the first deploy.

## 4. Deploy

Click **Deploy**. Dokploy builds the image, the entrypoint renders
`/data/homeserver.yaml` + signing key from the env vars, then synapse starts.
Wait for the healthcheck to go green.

## 5. Create the first user

Dokploy → service → **Terminal**:

```
register_new_matrix_user -u alice -p alicepass -a \
  -c /data/homeserver.yaml http://localhost:8008
```

## 6. Verify

```
curl https://matrix.example.com/_matrix/client/versions
```

Returns JSON. Point your client at `https://matrix.example.com`.

## Prerequisites

- DNS A record for `SYNAPSE_DOMAIN` at the Dokploy server.
- Ports 80 + 443 reachable (Let's Encrypt).
- `dokploy-network` exists (Dokploy creates it on install).
