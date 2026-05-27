#!/bin/bash
# Renders /data/homeserver.yaml from environment variables on EVERY boot, so
# env changes (DB host, creds, domain) always take effect on redeploy without
# wiping the volume. Secrets (macaroon/form) and the signing key are persisted
# in the volume so identity and sessions stay stable across redeploys.
set -e

CONF=/data/homeserver.yaml

# Earlier file-mount deploys left empty directories at these paths (Docker
# creates a mountpoint dir when a bind-mount source is missing). Remove them
# so the files below can be written. rmdir only touches empty dirs, so real
# data is never deleted.
for stale in /data/homeserver.yaml /data/log.config /data/signing.key; do
  [ -d "$stale" ] && rmdir "$stale" 2>/dev/null || true
done

: "${SYNAPSE_SERVER_NAME:?SYNAPSE_SERVER_NAME is required}"
: "${REGISTRATION_SHARED_SECRET:?REGISTRATION_SHARED_SECRET is required}"
: "${POSTGRES_HOST:?POSTGRES_HOST is required - the Dokploy database internal host}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"
POSTGRES_USER="${POSTGRES_USER:-synapse}"
POSTGRES_DB="${POSTGRES_DB:-synapse}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"

# Persist these secrets across redeploys so existing sessions survive.
[ -f /data/.macaroon_secret ] || python3 -c "import secrets;print(secrets.token_hex(32))" > /data/.macaroon_secret
[ -f /data/.form_secret ]     || python3 -c "import secrets;print(secrets.token_hex(32))" > /data/.form_secret
MACAROON=$(cat /data/.macaroon_secret)
FORM=$(cat /data/.form_secret)

echo "[init] rendering $CONF from env (host=$POSTGRES_HOST db=$POSTGRES_DB user=$POSTGRES_USER)"
cat > "$CONF" <<EOF
server_name: "${SYNAPSE_SERVER_NAME}"
public_baseurl: "https://${SYNAPSE_SERVER_NAME}/"
pid_file: /data/homeserver.pid
report_stats: false
listeners:
  - port: 8008
    tls: false
    type: http
    x_forwarded: true
    bind_addresses: ['0.0.0.0']
    resources:
      - names: [client, federation]
        compress: false
database:
  name: psycopg2
  # Dokploy-managed DB is created with the cluster's default locale, not C.
  allow_unsafe_locale: true
  args:
    user: "${POSTGRES_USER}"
    password: "${POSTGRES_PASSWORD}"
    database: "${POSTGRES_DB}"
    host: "${POSTGRES_HOST}"
    port: ${POSTGRES_PORT}
    cp_min: 5
    cp_max: 10
log_config: "/data/log.config"
media_store_path: /data/media_store
enable_registration: true
enable_registration_without_verification: true
registration_shared_secret: "${REGISTRATION_SHARED_SECRET}"
macaroon_secret_key: "${MACAROON}"
form_secret: "${FORM}"
signing_key_path: "/data/signing.key"
trusted_key_servers:
  - server_name: "matrix.org"
EOF

cat > /data/log.config <<'LOGEOF'
version: 1
formatters:
  precise:
    format: '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
handlers:
  console:
    class: logging.StreamHandler
    formatter: precise
root:
  level: INFO
  handlers: [console]
disable_existing_loggers: false
LOGEOF

if [ ! -f /data/signing.key ]; then
  echo "[init] generating signing key"
  python3 -m synapse.app.homeserver --generate-keys -c "$CONF"
fi

chown -R 1000:1000 /data
echo "[init] starting synapse"
exec /start.py "$@"
