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

**Three runtime services (all managed by Docker Compose):**

| Service | Technology | Default Port |
|---------|-----------|-------------|
| `hub` | Node.js 20, Express, Prisma, PostgreSQL | 23000 (external) |
| `mcp-host` | Python 3.12, FastAPI, LangChain/LangGraph | 61990 (internal) |
| `postgres` | PostgreSQL 16 | 5432 (internal) |

---

## Quick Start (Docker)

### 1. Prerequisites

- Docker Engine 24+
- Docker Compose v2
- Git

### 2. Clone and configure

```bash
git clone https://github.com/TocharianOU/attacktrace.git newmind-ai
cd newmind-ai/oaphub
```

Create `.env` in `oaphub/`:

```env
# Database
POSTGRES_PASSWORD=your_strong_password_here

# JWT signing key (generate with: openssl rand -hex 32)
JWT_SECRET=your_jwt_secret_here

# Shared secret between Hub and MCP Host (generate with: openssl rand -hex 32)
OAP_AUTH_TOKEN=your_auth_token_here

# Initial admin account (created automatically on first boot)
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=your_admin_password

# Optional second admin / operator account
ADMIN2_EMAIL=operator@yourdomain.com
ADMIN2_PASSWORD=your_operator_password
ADMIN2_ROLE=ADMIN

# Networking
PORT=23000
ALLOWED_ORIGINS=https://yourdomain.com
HUB_FRONTEND_URL=https://yourdomain.com

# Feature flags
DEPLOYMENT_MODE=enterprise   # enterprise | saas
SSO_ENABLED=false
BILLING_ENABLED=false
INVITE_CODE_ENABLED=false
LICENSE_ENABLED=false
```

### 3. Create Docker volumes (first time only)

```bash
docker volume create oaphub_postgres_data
docker volume create oaphub_mcp_data
```

### 4. Build and start

```bash
# From the oaphub/ directory
docker compose build
docker compose up -d
```

### 5. Access

| URL | Description |
|-----|-------------|
| `http://your-server:23000/app/` | NewMind AI Chat UI |
| `http://your-server:23000/console/` | OAP Hub Admin Console |
| `http://your-server:23000/api/health` | Health check |

---

## Update / Redeploy

```bash
cd oaphub/
git pull
docker compose build --no-cache
docker compose up -d
```

Database migrations run automatically on startup via `prisma migrate deploy`.

---

## SSO Configuration

NewMind AI supports **Google**, **Azure AD**, **AWS Cognito**, and **WeCom (企业微信)** as SSO providers.

Set `SSO_ENABLED=true` in `.env` plus the provider-specific variables below.

### Google OAuth 2.0

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
2. Application type: **Web application**
3. Add Authorized redirect URI:
   ```
   https://yourdomain.com/api/auth/sso/google/callback
   ```
4. Add to `.env`:

```env
SSO_ENABLED=true
SSO_CALLBACK_BASE_URL=https://yourdomain.com
SSO_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
SSO_GOOGLE_CLIENT_SECRET=your_google_client_secret
```

---

### Azure Active Directory (Microsoft Entra ID)

1. Go to [Azure Portal](https://portal.azure.com/) → **Azure Active Directory** → **App registrations** → **New registration**
2. Set redirect URI:
   ```
   https://yourdomain.com/api/auth/sso/azure/callback
   ```
3. Note the **Application (client) ID** and **Directory (tenant) ID**
4. Go to **Certificates & secrets** → create a new client secret
5. Add to `.env`:

```env
SSO_ENABLED=true
SSO_CALLBACK_BASE_URL=https://yourdomain.com
SSO_AZURE_ENABLED=true
SSO_AZURE_TENANT_ID=your_tenant_id
SSO_AZURE_CLIENT_ID=your_application_client_id
SSO_AZURE_CLIENT_SECRET=your_client_secret
```

Azure uses standard OIDC discovery (`/.well-known/openid-configuration`) — no extra endpoint configuration needed.

---

### AWS Cognito

1. Go to **AWS Console** → **Cognito** → **User Pools** → your pool → **App integration**
2. Create an **App client** with OAuth 2.0 enabled
3. Set callback URL:
   ```
   https://yourdomain.com/api/auth/sso/aws/callback
   ```
4. Add to `.env`:

```env
SSO_ENABLED=true
SSO_CALLBACK_BASE_URL=https://yourdomain.com
SSO_AWS_ENABLED=true
SSO_AWS_REGION=us-east-1
SSO_AWS_USER_POOL_ID=us-east-1_xxxxxxxxx
SSO_AWS_CLIENT_ID=your_cognito_app_client_id
SSO_AWS_CLIENT_SECRET=your_cognito_app_client_secret
```

---

### WeCom / WeChatWork (企业微信)

1. 登录[企业微信管理后台](https://work.weixin.qq.com/wework_admin/) → **应用管理** → 创建或选择应用
2. 在应用详情中找到 **AgentId** 和 **Secret**
3. 设置网页授权回调域名为你的服务器域名
4. 在**企业信息**中获取 **企业 CorpID**
5. 添加到 `.env`：

```env
SSO_ENABLED=true
SSO_CALLBACK_BASE_URL=https://yourdomain.com
SSO_WECHATWORK_ENABLED=true
SSO_WECHATWORK_CORP_ID=your_corp_id
SSO_WECHATWORK_AGENT_ID=your_agent_id
SSO_WECHATWORK_SECRET=your_app_secret
```

---

### SSO Notes

- When SSO is enabled, users can log in via the SSO button on the login page. On first login, a new account is automatically created and linked to the SSO identity.
- Existing email/password accounts can also be linked to an SSO identity automatically if the email matches.
- SSO-only users have no password set and can only log in via SSO.
- If you use a proxy server, set `HTTP_PROXY` or `HTTPS_PROXY` in the Hub environment — the Google and OIDC providers will automatically route through it.

---

## Environment Variables Reference

### Required

| Variable | Description |
|----------|-------------|
| `POSTGRES_PASSWORD` | PostgreSQL superuser password |
| `JWT_SECRET` | Secret key for signing JWT tokens (min 32 chars) |
| `OAP_AUTH_TOKEN` | Shared secret between Hub and MCP Host |

### Networking

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `23000` | External port for the Hub |
| `ALLOWED_ORIGINS` | _(empty)_ | Comma-separated CORS allowed origins |
| `HUB_FRONTEND_URL` | _(empty)_ | Public base URL, used for SSO callbacks |
| `FORCE_HTTPS` | `false` | Redirect HTTP → HTTPS |

### Bootstrap Users

| Variable | Description |
|----------|-------------|
| `ADMIN_EMAIL` | Email for the primary admin (created on first boot) |
| `ADMIN_PASSWORD` | Password for the primary admin |
| `ADMIN2_EMAIL` | Email for a second user (optional) |
| `ADMIN2_PASSWORD` | Password for the second user |
| `ADMIN2_ROLE` | Role for the second user: `ADMIN` or `USER` |

### Feature Flags

| Variable | Default | Description |
|----------|---------|-------------|
| `DEPLOYMENT_MODE` | `enterprise` | `enterprise` (all features, no billing) or `saas` |
| `SSO_ENABLED` | `false` | Enable SSO login |
| `BILLING_ENABLED` | `false` | Enable Stripe billing |
| `INVITE_CODE_ENABLED` | `false` | Require invite code for registration |
| `LICENSE_ENABLED` | `false` | Enable license key enforcement |

### SSO

| Variable | Description |
|----------|-------------|
| `SSO_CALLBACK_BASE_URL` | Public base URL for OAuth callbacks (e.g. `https://yourdomain.com`) |
| `SSO_GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `SSO_GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `SSO_AZURE_ENABLED` | Enable Azure AD SSO (`true`/`false`) |
| `SSO_AZURE_TENANT_ID` | Azure tenant ID |
| `SSO_AZURE_CLIENT_ID` | Azure app client ID |
| `SSO_AZURE_CLIENT_SECRET` | Azure app client secret |
| `SSO_AWS_ENABLED` | Enable AWS Cognito SSO |
| `SSO_AWS_REGION` | AWS region |
| `SSO_AWS_USER_POOL_ID` | Cognito user pool ID |
| `SSO_AWS_CLIENT_ID` | Cognito app client ID |
| `SSO_AWS_CLIENT_SECRET` | Cognito app client secret |
| `SSO_WECHATWORK_ENABLED` | Enable WeCom SSO |
| `SSO_WECHATWORK_CORP_ID` | WeCom Corp ID |
| `SSO_WECHATWORK_AGENT_ID` | WeCom Agent ID |
| `SSO_WECHATWORK_SECRET` | WeCom app secret |

---

## Development

### Hub (Node.js)

```bash
cd oaphub/
npm install
# Set DATABASE_URL in .env, then:
npx prisma migrate dev
npm run dev
```

### MCP Host (Python)

```bash
cd mcp-host/
uv sync
uv run oap_httpd --port 61990
```

### Chat UI (React)

```bash
# Web mode (connects to Hub at /api)
npm run dev:web

# Electron desktop mode
npm run dev
```

---

## Project Structure

```
newmind-ai/
├── src/                  # Chat UI — React + TypeScript (Vite)
├── oaphub/
│   ├── src/              # Hub server — Express + Prisma
│   ├── frontend/         # Admin Console — React (Vite)
│   ├── prisma/           # Database schema + migrations
│   ├── integrations/     # Third-party integration configs
│   ├── Dockerfile        # Multi-stage build (hub + UI)
│   └── docker-compose.yml
├── mcp-host/
│   ├── oap_mcp_host/     # Python MCP host package
│   └── Dockerfile
├── electron/             # Electron main process
├── shared/               # Shared utilities
├── types/                # TypeScript type definitions
└── public/               # Static assets
```

---

## License

Proprietary — © 2025 NewMind AI. All rights reserved.
