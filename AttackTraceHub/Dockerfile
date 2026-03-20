# NewMind AI — Hub (Node.js / Express / Prisma)
FROM node:20-alpine AS base

RUN apk add --no-cache openssl

# ── Install dependencies ──────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install --omit=dev && npx prisma generate

# ── Runtime image ─────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nodejs

# Runtime app files
COPY --from=deps  --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=deps  --chown=nodejs:nodejs /app/prisma      ./prisma
COPY --chown=nodejs:nodejs ./src         ./src
COPY --chown=nodejs:nodejs package*.json ./

# Pre-built web SPA — produced by the CI step before docker build
# (run `npm run build:web` in the repo root first)
COPY --chown=nodejs:nodejs ./app-dist    ./app-dist

# Startup script: migrate then serve
COPY --chown=nodejs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health',(r)=>{process.exit(r.statusCode===200?0:1)})"

CMD ["./docker-entrypoint.sh"]
