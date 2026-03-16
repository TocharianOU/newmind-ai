# AttackTrace

AI 驱动的 SOC 调查与结案助手，支持 MCP 服务器集成和 OAP 云端服务。

## 项目简介

AttackTrace 是一款现代化的 AI 驱动安全运营平台，专为 SOC 团队设计，从告警出现开始提供完整的调查与结案能力。通过 Model Context Protocol (MCP) 支持，可以连接各种外部服务和数据源，实现真正的 AI 助手体验。

## 什么是 OAP？

**OAP** 全称 **Operations & Analytics Platform（运营与分析平台）**，是 AttackTrace 的云端服务平台。

### OAP 与 AttackTrace 的关系

```
AttackTrace 生态系统
├── AttackTrace Desktop（桌面客户端）
│   └── 本地 AI 助手应用，用于安全调查和案例管理
│
└── OAP Platform（云端服务）
    ├── 用户认证与授权
    ├── AI 模型服务与代理
    ├── 订阅与计费管理
    ├── MCP 工具市场
    └── 团队协作功能
```

### OAP 的核心功能

1. **用户管理与认证**
   - 统一的用户身份认证（支持 OAuth）
   - 基于角色的访问控制（RBAC）
   - 团队协作与权限管理

2. **AI 模型服务**
   - 提供 newmind 系列模型（newmind-medium、newmind-strong、newmind-small）
   - 模型代理与负载均衡
   - 使用统计与计费

3. **MCP 工具市场**
   - 预配置的安全工具集成（Elasticsearch、Kibana、AWS、威胁情报等）
   - 一键安装与配置
   - 工具版本管理与更新

4. **订阅管理**
   - 灵活的订阅计划（BASE、PRO、ENTERPRISE）
   - Token 使用量管理
   - 支付与发票管理

### 为什么需要 OAP？

- **降低使用门槛**：无需自行配置 API 密钥，开箱即用
- **企业级治理**：统一的安全策略、审计日志、合规管理
- **团队协作**：共享调查案例、知识库、工具配置
- **成本优化**：按需计费，避免资源浪费

### 架构说明

- **AttackTrace Desktop** 是独立的桌面应用，可完全本地运行
- **OAP Platform** 提供增强功能，但**不是必需的**
- 用户可以选择：
  - 仅使用桌面版（本地模式）
  - 登录 OAP 获得完整功能（云端模式）

## 主要特性

### AttackTrace Desktop 特性
- **AI 驱动调查**：智能分析告警，自动关联威胁情报
- **MCP 工具集成**：支持 Elasticsearch、Kibana、AWS、GitHub 等多种数据源
- **证据链管理**：自动记录调查过程，生成可复用的证据链
- **报告生成**：一键生成结案报告，支持自定义模板
- **跨平台支持**：支持 macOS、Windows 和 Linux
- **本地优先**：数据本地存储，保护隐私
- **流式响应**：实时显示 AI 响应内容

### OAP Platform 特性
- **自研 AI 模型**：newmind-medium、newmind-strong、newmind-small
- **MCP 工具市场**：预配置安全工具，一键安装使用
- **团队协作**：共享调查案例、工具配置、知识库
- **订阅管理**：灵活的订阅计划，按需付费
- **使用统计**：详细的 Token 使用分析和成本控制

## 项目架构

本项目采用 Monorepo 架构，包含以下主要组件：

### 1. AttackTrace Desktop（主应用）

基于 Electron + React 的桌面应用程序。

**技术栈**：
- Electron 31.x
- React 18.x
- TypeScript
- Vite

**主要功能**：
- AI 对话界面
- 模型管理
- MCP 服务器配置
- 会话历史管理

### 2. OAP Platform（Operations & Analytics Platform）

云端服务平台，提供用户认证、模型管理和订阅系统。

**技术栈**：
- Node.js + Express
- PostgreSQL
- Prisma ORM
- React（前端）

**主要功能**：
- 用户认证和授权
- 模型代理和计费
- 订阅计划管理
- 使用统计和分析

**文档**：[OAP Platform README](./AttackTraceHub/README.md)

### 3. MCP Host（MCP 服务）

Model Context Protocol 服务器主机，管理和运行 MCP 插件。

**技术栈**：
- Python 3.12+
- LangChain / LangGraph
- FastAPI
- SQLAlchemy

**主要功能**：
- MCP 服务器托管
- 多模型支持
- 会话管理
- HTTP API 和 WebSocket

**文档**：[MCP Host README](./mcp-host/README.md)

### 4. 用户文档网站

基于 MkDocs Material 的用户文档站点。

**技术栈**：
- MkDocs
- Python
- Docker

**文档**：[文档 README](./attacktrace-docs/README.md)

## 快速开始

### 下载应用

访问官方下载页面获取最新版本：

**[立即下载 AttackTrace](http://xiaopenges.tocharian.eu:23001/)**

支持平台：
- macOS（Apple Silicon / Intel）
- Windows（x64）
- Linux（x64 AppImage）

### 注册账号

访问 OAP 平台创建账号并登录：

**[访问 OAP Platform](http://xiaopenges.tocharian.eu:23001/login)**

### 查看文档

本地运行文档站点：

```bash
cd attacktrace-docs
uv run mkdocs serve -a 0.0.0.0:8002
```

访问 http://localhost:8002 查看完整文档。

## 开发指南

### 环境要求

- **Node.js**: 18.x 或更高
- **Python**: 3.12 或更高
- **PostgreSQL**: 14.x 或更高（用于 Hub）
- **uv**: Python 包管理器

### 安装依赖

```bash
# 主应用
npm install

# OAP Platform
cd AttackTraceHub
npm install

# MCP Host
cd mcp-host
uv sync --frozen

# 文档
cd attacktrace-docs
uv pip install -r requirements.txt
```

### 启动开发环境

#### 主应用

```bash
# 开发模式
npm run dev

# 或使用启动脚本
./start-dev.sh
```

#### OAP Platform

参考 [OAP Platform START.md](./AttackTraceHub/START.md)

```bash
cd AttackTraceHub
npm run dev
```

#### MCP Host

参考 [mcp-host/START.md](./mcp-host/START.md)

```bash
cd mcp-host
source .venv/bin/activate
dive_httpd
```

#### 文档站点

参考 [attacktrace-docs/START.md](./attacktrace-docs/START.md)

```bash
cd attacktrace-docs
uv run mkdocs serve -a 0.0.0.0:8002
```

### 构建应用

```bash
# 构建主应用
npm run build

# 打包为可执行文件
npm run build:mac     # macOS
npm run build:win     # Windows
npm run build:linux   # Linux
```

## 子项目文档

每个子项目都有详细的构建和启动文档：

| 项目 | 构建文档 | 启动文档 | 项目说明 |
|------|----------|----------|----------|
| **OAP Platform** | [BUILD.md](./AttackTraceHub/BUILD.md) | [START.md](./AttackTraceHub/START.md) | [README.md](./AttackTraceHub/README.md) |
| **MCP Host** | [BUILD.md](./mcp-host/BUILD.md) | [START.md](./mcp-host/START.md) | [README.md](./mcp-host/README.md) |
| **文档站点** | [BUILD.md](./attacktrace-docs/BUILD.md) | [START.md](./attacktrace-docs/START.md) | [README.md](./attacktrace-docs/README.md) |

## OAP 订阅计划

AttackTrace OAP 提供灵活的订阅计划，满足不同规模团队的需求：

### BASE（免费）
- **适用场景**：个人用户、小型团队、试用评估
- **Token 额度**：每日 10M tokens
- **AI 模型**：newmind-medium、newmind-small
- **MCP 工具**：最多 100 个
- **团队规模**：1 人

### PRO
- **适用场景**：专业 SOC 团队、中型企业
- **Token 额度**：每日 50M tokens
- **AI 模型**：newmind-medium、newmind-small
- **MCP 工具**：最多 20 个
- **团队规模**：最多 5 人
- **增值服务**：优先技术支持、共享工作空间

### ENTERPRISE
- **适用场景**：大型企业、MSS 提供商
- **Token 额度**：无限
- **AI 模型**：所有模型（包括 newmind-strong）
- **MCP 工具**：无限
- **团队规模**：无限
- **增值服务**：
  - 专属客户成功经理
  - SLA 服务保障
  - 私有部署支持
  - 定制化开发

详细定价：[订阅计划文档](./attacktrace-docs/docs/hub/subscription.md)

### 本地模式 vs 云端模式

| 功能 | 本地模式（无需 OAP） | 云端模式（登录 OAP） |
|------|---------------------|-------------------|
| AI 对话 | ✅ 需自备 API Key | ✅ 使用 OAP 模型 |
| MCP 工具 | ✅ 手动配置 | ✅ 一键安装 |
| 数据存储 | ✅ 完全本地 | ✅ 本地 + 云端同步 |
| 团队协作 | ❌ | ✅ |
| 使用统计 | ❌ | ✅ |
| 自动更新 | ✅ | ✅ |

## 模型定价

| 模型 | 输入价格 | 输出价格 | 适用场景 |
|------|----------|----------|----------|
| newmind-medium | $3/1M | $15/1M | 通用场景，推荐使用 |
| newmind-strong | $15/1M | $75/1M | 复杂推理，企业专属 |
| newmind-small | $1/1M | $2/1M | 简单任务，快速响应 |

## 技术栈

### 前端
- React 18
- TypeScript
- Vite
- Electron

### 后端
- Node.js + Express
- Python + FastAPI
- PostgreSQL
- Prisma ORM

### AI/ML
- LangChain
- LangGraph
- Model Context Protocol

### 部署
- Docker
- Docker Compose

## 贡献指南

欢迎贡献代码、报告问题或提出建议！

1. Fork 本仓库
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

## 许可证

本项目为专有软件，保留所有权利。详见 [LICENSE](./LICENSE) 文件。

## 联系我们

- **官网**: http://xiaopenges.tocharian.eu:23001/
- **文档**: http://localhost:8002（本地）
- **问题反馈**: GitHub Issues

---

**AttackTrace** - 让 AI 对话更强大


