# Synapse image with an entrypoint that renders homeserver.yaml from env vars.
# Keeps secrets out of git and avoids inline compose scripts (which Dokploy's
# variable-substitution pass mangles).
FROM matrixdotorg/synapse:latest

COPY synapse-entrypoint.sh /synapse-entrypoint.sh
RUN chmod +x /synapse-entrypoint.sh

ENTRYPOINT ["/synapse-entrypoint.sh"]
