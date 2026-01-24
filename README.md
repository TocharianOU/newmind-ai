# AttackTrace

AI 驱动的桌面聊天应用，支持 MCP 服务器集成和 Hub 市场。

## 项目简介

AttackTrace 是一款现代化的 AI 桌面应用，提供强大的对话能力和工具集成。通过 Model Context Protocol (MCP) 支持，可以连接各种外部服务和数据源，实现真正的 AI 助手体验。

## 主要特性

- **自研 AI 模型**：提供 newmind-medium、newmind-strong、newmind-small 三种模型
- **MCP 集成**：支持 Elasticsearch、Kibana、GitHub 等多种 MCP 服务器
- **Hub 市场**：预配置模型和工具，一键安装使用
- **跨平台支持**：支持 macOS、Windows 和 Linux
- **本地优先**：数据本地存储，保护隐私
- **流式响应**：实时显示 AI 响应内容

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

### 2. AttackTraceHub（Hub 服务）

用户认证、模型管理和订阅系统。

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

**文档**：[AttackTraceHub README](./AttackTraceHub/README.md)

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

访问 AttackTraceHub 创建账号并登录：

**[访问 AttackTraceHub](http://xiaopenges.tocharian.eu:23001/login)**

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

# AttackTraceHub
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

#### AttackTraceHub

参考 [AttackTraceHub/START.md](./AttackTraceHub/START.md)

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
| **AttackTraceHub** | [BUILD.md](./AttackTraceHub/BUILD.md) | [START.md](./AttackTraceHub/START.md) | [README.md](./AttackTraceHub/README.md) |
| **MCP Host** | [BUILD.md](./mcp-host/BUILD.md) | [START.md](./mcp-host/START.md) | [README.md](./mcp-host/README.md) |
| **文档站点** | [BUILD.md](./attacktrace-docs/BUILD.md) | [START.md](./attacktrace-docs/START.md) | [README.md](./attacktrace-docs/README.md) |

## 订阅计划

AttackTrace 提供灵活的订阅计划：

### BASE（免费）
- 每日 10M tokens
- newmind-medium 和 newmind-small 模型
- 最多 100 个 MCP 服务器

### PRO
- 每日 50M tokens
- newmind-medium 和 newmind-small 模型
- 最多 20 个 MCP 服务器
- 优先技术支持

### ENTERPRISE
- 无限 tokens
- 所有模型（包括 newmind-strong）
- 无限 MCP 服务器
- 专属客户成功经理
- SLA 服务保障

详细定价：[订阅计划文档](./attacktrace-docs/docs/hub/subscription.md)

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

本项目采用 MIT 许可证。详见 [LICENSE](./LICENSE) 文件。

## 联系我们

- **官网**: http://xiaopenges.tocharian.eu:23001/
- **文档**: http://localhost:8002（本地）
- **问题反馈**: GitHub Issues

---

**AttackTrace** - 让 AI 对话更强大


