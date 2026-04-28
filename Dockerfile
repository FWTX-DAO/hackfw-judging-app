# syntax=docker/dockerfile:1.7
# ─── Stage 1: install + build ──────────────────────────────────────────
FROM oven/bun:1 AS build
WORKDIR /app

# Install deps with the lockfile so the build is reproducible
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Build the Vite frontend into ./dist
COPY tsconfig.json vite.config.ts hackathon.config.ts ./
COPY src ./src
RUN bun run build

# ─── Stage 2: runtime ──────────────────────────────────────────────────
FROM oven/bun:1
WORKDIR /app

# Copy installed deps + source + built frontend
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/src ./src
COPY --from=build /app/hackathon.config.ts ./
COPY --from=build /app/package.json ./
COPY --from=build /app/tsconfig.json ./

# Persistent state lives here — mount a volume to /data in production.
# We run as root (default in oven/bun:1) because Fly volumes are root-owned
# at mount time; isolation is provided by the microVM, not by uid drop.
RUN mkdir -p /data

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_FILE=/data/hackathon.db
EXPOSE 3000

# Bun runs the TS entry directly. SESSION_SECRET + ADMIN_PIN must be set
# in the environment — the server refuses to boot in prod without them.
CMD ["bun", "src/server/index.ts"]
