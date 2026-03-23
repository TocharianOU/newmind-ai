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
RUN npm run build:web

# ── Stage 2: Install Hub (server) dependencies ───────────────────────────────
FROM node:20-alpine AS deps

RUN apk add --no-cache openssl

WORKDIR /app

COPY AttackTraceHub/package*.json ./
COPY AttackTraceHub/prisma ./prisma/

RUN npm install --omit=dev && npx prisma generate

# ── Stage 3: Runtime image ───────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache openssl

WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nodejs

# Hub server dependencies + Prisma client
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=nodejs:nodejs /app/prisma       ./prisma

# Hub application code
COPY --chown=nodejs:nodejs AttackTraceHub/src          ./src
COPY --chown=nodejs:nodejs AttackTraceHub/package.json ./
COPY --chown=nodejs:nodejs AttackTraceHub/integrations ./integrations
COPY --chown=nodejs:nodejs AttackTraceHub/system-prompt.txt ./system-prompt.txt

# Frontend SPA — built in stage 1
COPY --from=frontend --chown=nodejs:nodejs /build/dist-web ./app-dist

# Startup script: runs Prisma migrations then starts the server
COPY --chown=nodejs:nodejs AttackTraceHub/docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health',(r)=>{process.exit(r.statusCode===200?0:1)})"

CMD ["./docker-entrypoint.sh"]
