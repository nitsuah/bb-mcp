# ── Test stage ───────────────────────────────────────────────────────────────
FROM node:22-slim AS test

WORKDIR /app

COPY package.json ./
COPY package-lock.json ./
COPY tsconfig.json ./
COPY config/vitest.config.ts ./config/vitest.config.ts
COPY config/eslint.config.mjs ./config/eslint.config.mjs
COPY scripts ./scripts
COPY src ./src
COPY tests ./tests
RUN npm ci
RUN npm run build

CMD ["npm", "test"]
# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:22-slim AS builder

WORKDIR /app

COPY package.json ./
COPY package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:22-slim AS runtime

WORKDIR /app

# Only copy production deps + compiled output
COPY package.json ./
COPY package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 3100

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3100/health', (r) => { r.resume(); r.on('end', () => process.exit(r.statusCode === 200 ? 0 : 1)); }).on('error', () => process.exit(1))"

CMD ["node", "dist/index.js"]
