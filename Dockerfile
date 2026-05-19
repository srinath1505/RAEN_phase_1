# ─── Stage 1: install deps + generate Prisma client ─────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Copy package files first — Docker cache skips npm ci unless these change
COPY backend/package*.json ./backend/

# Install everything (prisma CLI is a devDep; needed for generate in next step)
RUN cd backend && npm ci

# Copy schema and generate @prisma/client
COPY backend/src/prisma ./backend/src/prisma/
RUN cd backend && npx prisma generate --schema src/prisma/schema.prisma

# Remove devDependencies — prisma CLI gone, @prisma/client stays (it's a prod dep)
RUN cd backend && npm prune --production

# ─── Stage 2: lean production image ──────────────────────────────────────────
FROM node:20-alpine AS production

# dumb-init: forwards signals (SIGTERM etc.) to Node so Railway shutdown is clean
RUN apk add --no-cache dumb-init wget

# Non-root user
RUN addgroup -S raen && adduser -S raen -G raen

WORKDIR /app

# Pruned node_modules + generated Prisma client from stage 1
COPY --from=deps --chown=raen:raen /app/backend/node_modules ./backend/node_modules

# Backend source
COPY --chown=raen:raen backend/src ./backend/src
COPY --chown=raen:raen backend/package*.json ./backend/

# Static frontend — Express serves this in production
COPY --chown=raen:raen stitch ./stitch

USER raen

ENV NODE_ENV=production

# Railway overrides PORT at runtime; 5000 is the local Docker default
EXPOSE 5000

# Health check — uses the /health endpoint already in app.js
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-5000}/health || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "backend/src/server.js"]
