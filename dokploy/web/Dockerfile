# Next.js web app (monorepo workspace `web`), standalone output.
# Build context is the REPO ROOT (see docker-compose.yml) so npm workspaces
# and the local packages/matrix-client dependency resolve.

FROM node:22-alpine AS builder
WORKDIR /repo

# Install with the workspace manifests only, so the layer caches across
# source-only changes.
COPY package.json package-lock.json ./
COPY web/package.json web/
COPY packages/matrix-client/package.json packages/matrix-client/
RUN npm ci

COPY packages packages
COPY web web
RUN npm run build --workspace web

FROM node:22-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app

# Standalone output mirrors the monorepo layout (outputFileTracingRoot is the
# repo root), so server.js lives under web/.
COPY --from=builder --chown=node:node /repo/web/.next/standalone ./
COPY --from=builder --chown=node:node /repo/web/.next/static ./web/.next/static

USER node
ENV PORT=3000 HOSTNAME=0.0.0.0
EXPOSE 3000
CMD ["node", "web/server.js"]
