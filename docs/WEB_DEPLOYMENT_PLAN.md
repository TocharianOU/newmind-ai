# AttackTrace Web 部署方案

> 在不破坏现有 Electron 桌面端架构的前提下，新增 Web 浏览器访问模式。
> 聊天 SPA 作为静态产物集成进 AttackTraceHub，共用同一套登录、用户管理和域名。

## 架构总览

```
用户浏览器
├── /                  → Hub 管理台（Login / Dashboard / Settings / Admin）
└── /app/*             → AttackTrace 聊天 SPA（dist-web/ 静态托管）
         ↕ 同域 API（无 CORS 问题）
AttackTraceHub (Node.js)
├── /api/auth/*        → 登录 / SSO / token 刷新（现有）
├── /api/v1/*          → 用户 / 项目 / 计费 / 审计（现有）
└── /api/v1/mcp/*      → 新增：反向代理到 MCP Host，注入 user/auth header
         ↕ Internal HTTP
MCP Host (FastAPI, 独立部署)
         ↕ Streamable HTTP
MCP Servers（远程部署：Kibana, CloudTrail, CloudWatch...）
```

Desktop 模式代码路径零改动，两种模式通过 `VITE_PLATFORM=web` 构建标识区分。

---

## 模块拆分 & TODO

### 1. Vite Web 构建

新增 `vite.config.web.ts`，纯 SPA 构建，不引入 `vite-plugin-electron`，产物输出到 `dist-web/`。

- [ ] 创建 `vite.config.web.ts`（base 设为 `/app/`）
- [ ] `package.json` 新增 `dev:web` / `build:web` script
- [ ] `dist-web/` 产物由 Hub Express 静态托管（见模块 5）

### 2. IPC Web 适配层

`src/ipc/web-adapter/` — 为每个 IPC 模块提供 Web HTTP 替代实现。所有请求同域发出，无需跨域配置。

| 模块 | Web 实现 |
|------|---------|
| `oap.ts` | 调 Hub `/api/auth/*`，token 存 localStorage，含自动 refresh |
| `project.ts` | 调 Hub `/api/v1/projects/*` |
| `config.ts` | 调 Hub → MCP Host 代理的 `/api/v1/mcp/config/*` |
| `host.ts` | 调 MCP Host 代理的 reload endpoint |
| `llm.ts` | 调 MCP Host 代理的 `/api/v1/mcp/config/model` |
| `keychain.ts` | 凭证存入 MCP Host per-project config（复用现有 `env` 字段）|
| `system.ts` | noop（无窗口控制） |
| `util.ts` | 浏览器原生：`window.open`、`navigator.clipboard` 等 |

- [ ] 创建 `src/ipc/web-adapter/` 目录
- [ ] 实现 `oap.ts` — Hub 登录/登出/token 刷新/getMe，token 存 localStorage
- [ ] 实现 `project.ts` — 项目 CRUD 走 Hub `/api/v1/projects/*`
- [ ] 实现 `config.ts` — 模型/MCP 配置读写，走 Hub MCP 代理
- [ ] 实现 `host.ts` — refreshConfig / restartHost（走代理）
- [ ] 实现 `llm.ts` — 模型列表
- [ ] 实现 `keychain.ts` — 写入 MCP config env 字段，或 noop
- [ ] 实现 `system.ts` — 全 noop 桩
- [ ] 实现 `util.ts` — 浏览器原生替代
- [ ] `src/ipc/index.ts` 条件导出：`isElectron` → IPC，否则 → web-adapter
- [ ] `src/ipc/env.ts` 新增 `isWeb` 标识（`VITE_PLATFORM === 'web'`）

### 3. 前端 UI 适配

条件隐藏 Electron-only 的 UI 组件，用 `isWeb` 判断。

- [ ] `WindowControls` — Web 模式隐藏
- [ ] Auto-update 相关弹窗 / hooks — Web 模式隐藏
- [ ] Settings 中 Auto-launch / Minimal-to-tray 选项 — Web 模式隐藏
- [ ] MCP 集成市场 — 过滤掉 `transport: "stdio"` 的本地工具，只展示 Streamable HTTP 工具
- [ ] 登录入口 — Web 模式跳转到 Hub 登录页（`/login`），登录成功后回到 `/app`

### 4. MCP Host 多用户 / 独立部署

MCP Host 从 Electron 子进程改为可独立部署的多用户服务，通过 Hub 注入的请求头识别用户。

- [ ] `AuthMiddleware` 新增 `AUTH_MODE=internal` 模式：验证来自 Hub 的内部固定 token（比 JWT 模式简单，Hub 已做鉴权）
- [ ] `default_state` 中间件改为从 `X-User-ID` 请求头读取 user（Hub 转发时注入），而非仅从环境变量
- [ ] `X-Project-ID` 继续沿用，Hub 从 JWT 解出 userId 后做 project 归属校验再转发
- [ ] 新增启动参数 `--listen 0.0.0.0` 支持非 localhost 绑定
- [ ] CORS 限制为 Hub 内网地址（不对外暴露）
- [ ] 文件路径隔离：`~/.attacktrace/users/{user_id}/projects/{project_id}/`（现有逻辑已部分支持）

### 5. Hub 静态托管 + 反向代理

Hub Express 服务器承担两件事：静态托管聊天 SPA、反向代理 MCP Host 请求。

**静态托管（`server.js`）：**
- [ ] `app.use('/app', express.static(path.join(__dirname, '../app-dist')))` 托管 `dist-web/`
- [ ] `app.get('/app/*', (req, res) => res.sendFile('.../app-dist/index.html'))` SPA fallback

**反向代理（新增 `src/routes/mcp-proxy.js`）：**
- [ ] 路由前缀 `/api/v1/mcp/*` → 转发到内部 MCP Host
- [ ] 转发前验证 JWT（复用现有 `authenticateToken` 中间件）
- [ ] 注入内部 header：`X-User-ID`、`X-Project-ID`、`X-Auth-Token`（内部固定 token）
- [ ] SSE 流式响应透传（`Content-Type: text/event-stream`，禁用 response buffer）

**Hub 登录页适配（`frontend/src/pages/Login.jsx`）：**
- [ ] 登录成功后，若来自 `/app` 跳转则回到 `/app`（否则继续走 `/dashboard`）

### 6. Hub 凭证托管（可选，后期）

Web 模式下无本地 Keychain，MCP 工具 API Key 当前方案是写入 MCP Host per-project config。若需要更安全的托管：

- [ ] Hub 新增 `/api/v1/credentials` CRUD 路由
- [ ] 服务端加密存储（字段级 AES）
- [ ] MCP Host 启动时从 Hub 拉取凭证并注入 MCP Server 环境变量

---

## 环境变量

### Web 前端（Vite 构建时）

| 变量 | 说明 | 示例 |
|------|------|------|
| `VITE_PLATFORM` | 平台标识，`web` 时启用 web-adapter | `web` |
| `VITE_API_BASE_URL` | Hub 地址（同域时留空即可） | `https://hub.attacktrace.com` |

### MCP Host（独立部署时）

| 变量 | 说明 | 示例 |
|------|------|------|
| `ATTACKTRACE_AUTH_MODE` | `internal`（Hub 内部 token）/ `token`（Electron，默认） | `internal` |
| `ATTACKTRACE_AUTH_TOKEN` | Hub 与 MCP Host 之间的内部固定 token | `<随机长串>` |
| `ATTACKTRACE_LISTEN` | 监听地址 | `0.0.0.0` |
| `ATTACKTRACE_PORT` | 监听端口 | `8100` |
| `ATTACKTRACE_CORS_ORIGIN` | 仅允许 Hub 内网地址 | `http://hub:3000` |

### Hub（服务端）

| 变量 | 说明 | 示例 |
|------|------|------|
| `MCP_HOST_URL` | 内部 MCP Host 地址 | `http://mcp-host:8100` |
| `MCP_HOST_INTERNAL_TOKEN` | 转发请求时注入的内部 auth token | `<与上面一致>` |
| `APP_DIST_PATH` | `dist-web/` 产物路径 | `../app-dist` |

---

## 部署拓扑

```
用户浏览器
     │ HTTPS (单域名)
┌────▼──────────────────────────────────┐
│  AttackTraceHub (Node.js)              │
│                                        │
│  /          → Hub 管理台 SPA           │
│  /app/*     → AttackTrace 聊天 SPA     │  ← dist-web/ 静态托管
│  /api/auth  → 登录 / SSO              │
│  /api/v1/*  → 用户 / 项目 / 计费      │
│  /api/v1/mcp/* → 反向代理             │
└────────────────┬──────────────────────┘
                 │ Internal HTTP
      ┌──────────▼──────────┐
      │  MCP Host (FastAPI)  │  AUTH_MODE=internal
      │  多用户独立部署       │  X-User-ID from Hub
      └──────────┬──────────┘
                 │ Streamable HTTP
      ┌──────────▼──────────┐
      │  MCP Servers         │  Kibana, CloudTrail...
      └─────────────────────┘
```

---

## 约束

- Web 模式仅支持 Streamable HTTP 类型的 MCP Server，不支持 stdio 本地工具
- MCP Host 不对外网直接暴露，仅监听内网，由 Hub 代理
- Desktop 模式（Electron）代码路径零改动
- Hub 和 MCP Host 之间通过内部固定 token 互信，无需 JWT 验证
