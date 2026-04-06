# NewMind AI

AI-powered investigation and operations platform with MCP server integration.

## Architecture

```
Browser ─► Hub (Node.js :3000)
             ├── /app/        Chat SPA (React)
             ├── /console/    Admin Console (React)
             ├── /api/*       REST + MCP Host proxy
             └──► MCP Host (Python FastAPI :61990)
                    ├── LLM orchestration (LangChain/LangGraph)
                    ├── MCP plugin management
                    └── Chat / memory / config APIs

PostgreSQL ◄── Hub (Prisma ORM)
```

Three services: **PostgreSQL**, **Hub** (Node.js), **MCP Host** (Python).

---

## Docker Deployment (Recommended)

**Prerequisites**: Docker Engine 20+ with Docker Compose V2.

### 1. Clone & Configure

```bash
git clone -b starbucks-3 https://github.com/TocharianOU/attacktrace.git /opt/newmind-ai
cd /opt/newmind-ai/AttackTraceHub

cat > .env << 'EOF'
POSTGRES_PASSWORD=CHANGE_ME_pg
JWT_SECRET=CHANGE_ME_jwt
ATTACKTRACE_AUTH_TOKEN=CHANGE_ME_token
ADMIN_EMAIL=admin@yourcompany.com
ADMIN_PASSWORD=CHANGE_ME_admin
ALLOWED_ORIGINS=http://YOUR_SERVER_IP:23000
EOF
```

Generate secure values:

```bash
sed -i "s/CHANGE_ME_pg/$(openssl rand -hex 16)/" .env
sed -i "s/CHANGE_ME_jwt/$(openssl rand -hex 32)/" .env
sed -i "s/CHANGE_ME_token/$(openssl rand -hex 32)/" .env
```

> Replace `YOUR_SERVER_IP` and `CHANGE_ME_admin` with actual values.

### 2. Build & Start

```bash
docker compose --env-file .env build
docker compose --env-file .env up -d
```

### 3. Verify

```bash
docker compose --env-file .env ps -a          # all 3 healthy
docker compose --env-file .env logs hub --tail=20
docker compose --env-file .env logs mcp-host --tail=20
```

Access:
- Chat: `http://YOUR_SERVER_IP:23000/app/`
- Admin Console: `http://YOUR_SERVER_IP:23000/console/`

### Update Existing Deployment

```bash
cd /opt/newmind-ai
git pull origin starbucks-3
cd AttackTraceHub
docker compose --env-file .env build
docker compose --env-file .env up -d
```

### Full Reset (delete data)

```bash
cd /opt/newmind-ai/AttackTraceHub
docker compose --env-file .env down -v   # removes containers + volumes
docker compose --env-file .env build --no-cache
docker compose --env-file .env up -d
```

### Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `POSTGRES_PASSWORD` | Yes | — | PostgreSQL password |
| `JWT_SECRET` | Yes | — | JWT signing key |
| `ATTACKTRACE_AUTH_TOKEN` | Yes | — | Hub ↔ MCP Host shared secret |
| `ADMIN_EMAIL` | No | — | Auto-create admin on first boot |
| `ADMIN_PASSWORD` | No | — | Admin password (both needed) |
| `PORT` | No | `23000` | External published port |
| `ALLOWED_ORIGINS` | No | — | CORS origins (e.g. `http://IP:23000`) |
| `FORCE_HTTPS` | No | `false` | Set `true` behind TLS reverse proxy |
| `DEPLOYMENT_MODE` | No | `enterprise` | `enterprise` or `saas` |
| `SSO_ENABLED` | No | `false` | Enable OAuth2/SSO login |
| `LICENSE_ENABLED` | No | `false` | License-based access control |

Full example: [`AttackTraceHub/env.docker.example`](./AttackTraceHub/env.docker.example)

---

## Non-Docker Deployment (Manual)

### Prerequisites

- Node.js 20+
- Python 3.12+
- PostgreSQL 14+
- uv (Python package manager)

### 1. PostgreSQL

```bash
# Create database
createdb attacktrace
# Or via psql:
psql -c "CREATE DATABASE attacktrace;"
```

### 2. Hub (Node.js)

```bash
cd AttackTraceHub
npm install

# Generate Prisma client and run migrations
npx prisma generate
npx prisma migrate deploy

# Set required environment variables
export DATABASE_URL="postgresql://postgres:YOUR_PG_PASSWORD@localhost:5432/attacktrace"
export JWT_SECRET="$(openssl rand -hex 32)"
export MCP_HOST_URL="http://localhost:61990"
export MCP_HOST_INTERNAL_TOKEN="$(openssl rand -hex 32)"

# Start
node src/server.js
```

Hub listens on port **3000** by default.

### 3. MCP Host (Python)

```bash
cd mcp-host
uv sync --frozen

# Set required environment variables
export ATTACKTRACE_AUTH_TOKEN="$MCP_HOST_INTERNAL_TOKEN"   # same token as Hub
export RESOURCE_DIR="./data"
export ATTACKTRACE_CONFIG_DIR="./data"

# Start
source .venv/bin/activate
attacktrace_httpd --listen 0.0.0.0 --port 61990
```

### 4. Build Frontend (Web SPA)

```bash
# From project root
npm install --ignore-scripts
npx vite build --config vite.config.web.ts    # outputs dist-web/
cp -r dist-web AttackTraceHub/app-dist        # serve via Hub at /app/
```

### 5. Build Admin Console

```bash
cd AttackTraceHub/frontend
npm install --ignore-scripts
npx vite build                                # outputs dist/
cp -r dist ../console-dist                    # serve via Hub at /console/
```

Access: `http://localhost:3000/app/`

---

## Development

```bash
# Frontend (Electron dev mode)
npm install
npm run dev

# Hub
cd AttackTraceHub && npm run dev

# MCP Host
cd mcp-host && uv sync --frozen
source .venv/bin/activate && attacktrace_httpd

# Desktop build
npm run build:mac     # macOS
npm run build:win     # Windows
npm run build:linux   # Linux
```

## Project Structure

```
.
├── src/                    # Chat frontend (React + TypeScript)
├── AttackTraceHub/         # Hub server (Node.js + Express + Prisma)
│   ├── frontend/           # Admin Console (React)
│   ├── docker-compose.yml  # Docker orchestration
│   ├── Dockerfile          # Multi-stage Hub image
│   └── env.docker.example  # Environment template
├── mcp-host/               # MCP Host (Python + FastAPI)
│   └── Dockerfile          # MCP Host image
├── shared/                 # Shared TypeScript modules
└── types/                  # TypeScript type definitions
```

## License

Proprietary software. All rights reserved. See [LICENSE](./LICENSE).
