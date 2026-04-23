# NewMind AI

An AI-powered operations and security intelligence platform. Combines a multi-provider LLM chat interface, an MCP (Model Context Protocol) tool orchestration layer, and an enterprise-grade management hub with SSO, multi-user, and project isolation.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                      Clients                             │
│   Browser (Web App)          Electron (Desktop App)      │
└────────────────┬─────────────────────────┬───────────────┘
                 │  HTTPS / WS             │  IPC + HTTP
                 ▼                         ▼
┌──────────────────────────────────────────────────────────┐
│                     OAP Hub  :3000                       │
│  • Auth (JWT + SSO)       • User / Project management    │
│  • Admin console          • Subscription & audit log     │
│  • LLM model proxy        • MCP tool proxy               │
│  • Serves Chat UI (/app)  • Serves Admin UI (/console)   │
│                  Node.js · Express · Prisma              │
└────────────┬────────────────────┬────────────────────────┘
             │  PostgreSQL 5432   │  HTTP :61990
             ▼                   ▼
    ┌─────────────────┐  ┌──────────────────────────────┐
    │  PostgreSQL 16  │  │        MCP Host :61990        │
    │  (users, chats, │  │  • LLM orchestration          │
    │   projects,     │  │  • LangGraph / LangChain      │
    │   audit logs)   │  │  • MCP tool plugins           │
    └─────────────────┘  │  • Chat memory (SQLite)       │
                         │  FastAPI · Python 3.12 · uv   │
                         └──────────────────────────────┘
```

| Service | Technology | Port |
|---------|-----------|------|
| `hub` | Node.js 20, Express, Prisma | 23000 (external) |
| `mcp-host` | Python 3.12, FastAPI, LangChain | 61990 (internal) |
| `postgres` | PostgreSQL 16 | 5432 (internal) |

---

## Server Deployment (Docker)

### First-time setup

```bash
# 1. Create persistent volumes
docker volume create oaphub_postgres_data
docker volume create oaphub_mcp_data
```

Create `oaphub/.env`:

```env
# Required
POSTGRES_PASSWORD=your_strong_password_here
JWT_SECRET=your_jwt_secret_here          # openssl rand -hex 32
OAP_AUTH_TOKEN=your_auth_token_here      # openssl rand -hex 32

# Bootstrap admin (auto-created on first boot)
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=your_admin_password

# Networking
PORT=23000
ALLOWED_ORIGINS=https://yourdomain.com
HUB_FRONTEND_URL=https://yourdomain.com

# SSO (disabled by default)
SSO_ENABLED=false
DEPLOYMENT_MODE=enterprise
```

```bash
# 2. Build and start
cd oaphub/
docker compose build
docker compose up -d
```

| URL | Description |
|-----|-------------|
| `:23000/app/` | NewMind AI Chat UI |
| `:23000/console/` | OAP Hub Admin Console |
| `:23000/api/health` | Health check |

### Update / Redeploy

```bash
cd oaphub/
docker compose build --no-cache
docker compose up -d
```

### Common commands

```bash
docker compose logs -f hub          # live logs
docker compose down                 # stop
docker compose down -v              # stop + wipe data
```

---

## SSO Configuration

Set `SSO_ENABLED=true` in `.env` plus the provider variables below.

### Google OAuth 2.0

1. [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials** → **Create OAuth 2.0 Client ID**
2. Redirect URI: `https://yourdomain.com/api/auth/sso/google/callback`

```env
SSO_CALLBACK_BASE_URL=https://yourdomain.com
SSO_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
SSO_GOOGLE_CLIENT_SECRET=xxxx
```

### Azure AD (Microsoft Entra ID)

1. [Azure Portal](https://portal.azure.com/) → **App registrations** → **New registration**
2. Redirect URI: `https://yourdomain.com/api/auth/sso/azure/callback`
3. Note the **Application (client) ID**, **Directory (tenant) ID**, and create a client secret.

```env
SSO_CALLBACK_BASE_URL=https://yourdomain.com
SSO_AZURE_ENABLED=true
SSO_AZURE_TENANT_ID=your_tenant_id
SSO_AZURE_CLIENT_ID=your_client_id
SSO_AZURE_CLIENT_SECRET=your_client_secret
```

### AWS Cognito

1. **AWS Console** → **Cognito** → **User Pools** → **App integration** → create App client
2. Callback URL: `https://yourdomain.com/api/auth/sso/aws/callback`

```env
SSO_CALLBACK_BASE_URL=https://yourdomain.com
SSO_AWS_ENABLED=true
SSO_AWS_REGION=us-east-1
SSO_AWS_USER_POOL_ID=us-east-1_xxxxxxxxx
SSO_AWS_CLIENT_ID=your_client_id
SSO_AWS_CLIENT_SECRET=your_client_secret
```

### WeCom (企业微信)

1. 企业微信管理后台 → **应用管理** → 选择应用，获取 **AgentId** 和 **Secret**
2. 设置网页授权回调域名为你的服务器域名，从**企业信息**获取 **CorpID**

```env
SSO_CALLBACK_BASE_URL=https://yourdomain.com
SSO_WECHATWORK_ENABLED=true
SSO_WECHATWORK_CORP_ID=your_corp_id
SSO_WECHATWORK_AGENT_ID=your_agent_id
SSO_WECHATWORK_SECRET=your_app_secret
```

> On first SSO login, an account is created automatically. Existing accounts are linked by matching email. Use `HTTP_PROXY` / `HTTPS_PROXY` if the server needs a proxy to reach SSO providers.

---

## Desktop App Packaging

The Electron app bundles a self-contained Python runtime, `uv`, and MCP Host — no dependencies required on the end user's machine.

**Prerequisites:** Node.js 20+, run `npm install` first.

### macOS

```bash
# Unsigned build (arm64 + x64 DMG + ZIP)
npm run package:darwin:unsigned

# Single arch
npm run package:darwin-dmg:arm64:unsigned
npm run package:darwin-dmg:x64:unsigned
```

Output: `release/<version>/NewMind AI-<version>-mac-arm64.dmg`

### Linux

```bash
npm run package:linux-appImage   # → AppImage
npm run package:linux-tar        # → tar.gz
```

Output: `release/<version>/NewMind AI-<version>-linux-x64.AppImage`

### Windows

```bash
npm run docker:build-win         # cross-compile via Docker (on Linux host)
# or natively on Windows:
npm run package:windows
```

Output: `release/<version>/NewMind AI-<version>-win-x64-setup.exe`

---

## Project Structure

```
newmind-ai/
├── src/                  # Chat UI — React + TypeScript (Vite)
├── oaphub/
│   ├── src/              # Hub server — Express + Prisma
│   ├── frontend/         # Admin Console — React (Vite)
│   ├── prisma/           # Database schema + migrations
│   ├── integrations/     # Third-party MCP integration configs
│   ├── Dockerfile
│   └── docker-compose.yml
├── mcp-host/
│   ├── oap_mcp_host/     # Python MCP host package
│   └── Dockerfile
├── electron/             # Electron main process
└── public/               # Static assets
```

---

## License

Proprietary — © 2025 NewMind AI. All rights reserved.
