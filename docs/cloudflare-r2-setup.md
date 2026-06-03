# Cloudflare R2 setup

## Steps

1. **R2 → Create bucket** (private). e.g. `matrix-e2e-emr`.
2. **R2 → Manage R2 API Tokens → Create** (Object Read & Write). Copy the
   Access Key ID + Secret, and your endpoint `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.
3. **Bucket → Settings → CORS** — allow your origin, expose `ETag`:

   ```json
   [
     {
       "AllowedOrigins": ["http://localhost:3000"],
       "AllowedMethods": ["PUT", "GET"],
       "AllowedHeaders": ["*"],
       "ExposeHeaders": ["ETag"]
     }
   ]
   ```

4. **`web/.env.local`:**

   ```bash
   S3_BUCKET=matrix-e2e-emr
   S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
   S3_REGION=auto
   AWS_ACCESS_KEY_ID=<R2 Access Key ID>
   AWS_SECRET_ACCESS_KEY=<R2 Secret Access Key>
   ```

5. Restart `npm run dev`. Attach a file in a patient's timeline to verify.
