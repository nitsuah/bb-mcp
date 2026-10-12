# ── Build image for bb-mcp promo rendering ────────────────────────────────────
FROM node:22-slim AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

RUN python3 -m venv /opt/venv && /opt/venv/bin/pip install --no-cache-dir numpy scipy

ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /repo

# ── Test stage ────────────────────────────────────────────────────────────────
FROM base AS test

COPY package.json package-lock.json ./
RUN npm ci

COPY promo/render.cjs ./promo/render.cjs

CMD ["npm", "test"]

# ── Promo render stage ────────────────────────────────────────────────────────
FROM base AS promo

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm install playwright && npx playwright install-deps chromium && npx playwright install chromium

COPY promo/render.cjs /repo/render.cjs
COPY promo/ /repo/promo/

CMD ["node", "/repo/render.cjs"]