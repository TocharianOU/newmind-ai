# NewMind AI — Hub (Node.js / Express / Prisma)
# Multi-stage build: compiles the React SPA, then assembles the runtime image.
#
# Build context MUST be the monorepo root (set via docker-compose context: ..).
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Build the React SPA ─────────────────────────────────────────────
FROM node:20-alpine AS frontend

WORKDIR /build

# Copy only the files needed by `npm run build:web`
COPY package.json package-lock.json ./
COPY tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY vite.config.web.ts index.html ./
COPY .env.production* ./
COPY patches/ ./patches/
COPY src/    ./src/
COPY shared/ ./shared/
COPY types/  ./types/
COPY public/ ./public/

RUN npm install --ignore-scripts
RUN npx vite build --config vite.config.web.ts

# ── Stage 2: Build the Admin Console SPA ─────────────────────────────────────
FROM node:20-alpine AS dashboard

WORKDIR /build

COPY oaphub/frontend/package.json oaphub/frontend/package-lock.json ./
RUN npm install --ignore-scripts

COPY oaphub/frontend/ ./
RUN npx vite build

# ── Stage 3: Install Hub (server) dependencies ───────────────────────────────
FROM node:20-alpine AS deps

RUN apk add --no-cache openssl

WORKDIR /app

COPY oaphub/package*.json ./
COPY oaphub/prisma ./prisma/

RUN npm install --omit=dev && npx prisma generate

# ── Stage 4: Runtime image ───────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache openssl

WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nodejs && \
    mkdir -p /app/logs/audit && chown -R nodejs:nodejs /app/logs

# Hub server dependencies + Prisma client
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=nodejs:nodejs /app/prisma       ./prisma

# Hub application code
COPY --chown=nodejs:nodejs oaphub/src          ./src
COPY --chown=nodejs:nodejs oaphub/package.json ./
COPY --chown=nodejs:nodejs oaphub/integrations ./integrations
COPY --chown=nodejs:nodejs oaphub/system-prompt.txt ./system-prompt.txt

# Frontend SPA — built in stage 1
COPY --from=frontend --chown=nodejs:nodejs /build/dist-web ./app-dist

# Admin Console — built in stage 2
COPY --from=dashboard --chown=nodejs:nodejs /build/dist ./console-dist

# Startup script: runs Prisma migrations then starts the server
COPY --chown=nodejs:nodejs oaphub/docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health',(r)=>{process.exit(r.statusCode===200?0:1)})"

CMD ["./docker-entrypoint.sh"]
