# Deploy Synapse on Dokploy

Config renders from env vars on every boot — no manual config or user setup.

1. **DNS** — point an A record at the Dokploy server: `matrix.example.com → <server IP>`.
2. **Database** — Dokploy → project → **Create Service** → **Database** → Postgres (user/db `synapse`). Copy its internal host + password.
3. **App** — **Create Service** → **Compose**, point at this repo, Compose Path `dokploy/synapse/docker-compose.yml`.
4. **Environment** tab:

   ```
   SYNAPSE_DOMAIN=matrix.example.com
   SYNAPSE_SERVER_NAME=matrix.example.com
   REGISTRATION_SHARED_SECRET=<openssl rand -hex 32>
   POSTGRES_HOST=<database internal host>
   POSTGRES_PASSWORD=<database password>
   ```

   `SYNAPSE_SERVER_NAME` is baked into user IDs — don't change it after the first deploy.

5. **Deploy** — wait for the healthcheck to go green.
6. **Verify** — `curl https://matrix.example.com/_matrix/client/versions` returns JSON.

Registration is open: create accounts from the app's sign-up screen.
