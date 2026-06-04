# Deploy the web app on Dokploy

1. **DNS** — point an A record at the Dokploy server: `app.example.com → <server IP>`.
2. **App** — Dokploy → project → **Create Service** → **Compose**, point at this repo, Compose Path `dokploy/web/docker-compose.yml`.
3. **Environment** tab:

   ```
   WEB_DOMAIN=app.example.com
   S3_BUCKET=<bucket for encrypted attachments>
   AWS_ACCESS_KEY_ID=<key>
   AWS_SECRET_ACCESS_KEY=<secret>
   S3_ENDPOINT=<optional, S3-compatible store>
   ```

4. **Deploy** — wait for the healthcheck to go green.
5. **Verify** — open `https://app.example.com`, log in against your Synapse homeserver.

The S3 bucket needs CORS allowing PUT/GET from `https://app.example.com` and exposing the `ETag` header (multipart uploads).
