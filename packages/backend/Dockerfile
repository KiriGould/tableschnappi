# ── Stage 1: install all deps (devDeps needed for tsc) ─────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
# npm ci needs the lockfile plus every workspace manifest it references, even
# when installing only one workspace. Copying manifests separately from source
# keeps this layer cached until a dependency actually changes.
COPY package.json package-lock.json ./
COPY packages/backend/package.json    ./packages/backend/
COPY packages/frontend/package.json   ./packages/frontend/
COPY packages/mcp-server/package.json ./packages/mcp-server/
RUN npm ci -w packages/backend --include-workspace-root

# ── Stage 2: compile TypeScript ────────────────────────────────────────────
FROM deps AS builder
COPY packages/backend/src ./packages/backend/src
COPY packages/backend/tsconfig.json ./packages/backend/
RUN npx tsc --project packages/backend/tsconfig.json

# ── Stage 3: lean production image ─────────────────────────────────────────
FROM node:20-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/backend/package.json    ./packages/backend/
COPY packages/frontend/package.json   ./packages/frontend/
COPY packages/mcp-server/package.json ./packages/mcp-server/
RUN npm ci -w packages/backend --include-workspace-root --omit=dev

COPY --from=builder /app/packages/backend/dist ./packages/backend/dist

# OpenShift runs pods as a random UID in group 0 — make files group-readable
RUN chown -R 1001:0 /app && chmod -R g=u /app

EXPOSE 3001
USER 1001
CMD ["node", "packages/backend/dist/index.js"]
