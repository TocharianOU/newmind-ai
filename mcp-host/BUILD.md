# MCP Host 构建指南

Newmind Agent MCP Host 是基于 Model Context Protocol (MCP) 的语言模型主机服务。

## 环境要求

### 必需软件

- **Python**: 3.12 或更高版本
- **uv**: Python 包管理器（推荐）

### 安装 uv

```bash
# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# 或使用 pip
pip install uv
```

## 项目依赖

项目使用 `pyproject.toml` 管理依赖，主要包括：

- **langchain** 系列：支持多种 AI 模型
- **langgraph**：工作流管理
- **fastapi**：HTTP API 服务
- **mcp**：Model Context Protocol
- **sqlalchemy**：数据库 ORM
- **alembic**：数据库迁移

## 依赖安装

### 方式 1：使用 uv（推荐）

```bash
cd mcp-host

# 同步依赖（根据 uv.lock）
uv sync --frozen

# 或安装可编辑模式
uv pip install -e .
```

### 方式 2：使用 pip

```bash
cd mcp-host
pip install -e .
```

## 虚拟环境

### 创建虚拟环境

```bash
# 使用 uv
uv venv

# 或使用 Python
python -m venv .venv
```

### 激活虚拟环境

```bash
# Linux/macOS
source .venv/bin/activate

# Windows
.venv\Scripts\activate
```

## 配置文件

### 模型配置

编辑 `model_config.json` 配置可用的 AI 模型：

```json
{
  "newmind-medium": {
    "type": "anthropic",
    "model": "claude-sonnet-4-5",
    "api_key": "${ANTHROPIC_API_KEY}"
  }
}
```

### 插件配置

编辑 `plugin_config.json` 配置 MCP 插件：

```json
{
  "enabled_plugins": ["plugin_name"],
  "plugin_settings": {}
}
```

### 环境变量

创建 `.env` 文件配置 API 密钥：

```env
# API 密钥
ANTHROPIC_API_KEY="your-anthropic-key"
OPENAI_API_KEY="your-openai-key"

# 数据库
DATABASE_URL="postgresql://user:pass@localhost/mcphost"

# 服务配置
MCP_HOST_PORT=61990
LOG_LEVEL=INFO
```

## 数据库设置

### PostgreSQL（生产环境）

```bash
# 创建数据库
createdb mcphost

# 运行迁移
alembic upgrade head
```

### SQLite（开发环境）

SQLite 数据库会自动创建，无需额外配置。

## 验证构建

```bash
# 检查依赖安装
uv pip list

# 检查可执行命令
which dive_cli
which dive_httpd

# 测试导入
python -c "from dive_mcp_host.host import NewmindMcpHost; print('OK')"
```

## 构建产物

### Python 包

```bash
# 使用 hatchling 构建
python -m build
```

构建产物在 `dist/` 目录：
- `dive_mcp_host-0.0.1.tar.gz`（源码包）
- `dive_mcp_host-0.0.1-py3-none-any.whl`（wheel 包）

## 常见问题

### Python 版本不匹配

确保使用 Python 3.12+：

```bash
python --version
# 或
python3.12 --version
```

### 依赖安装失败

清理并重新安装：

```bash
rm -rf .venv
uv venv
uv sync --frozen
```

### PostgreSQL 连接失败

确保 PostgreSQL 服务运行：

```bash
# macOS
brew services start postgresql

# Linux
sudo systemctl start postgresql
```

### 找不到命令

确保虚拟环境已激活：

```bash
source .venv/bin/activate
```

## 下一步

查看 [START.md](./START.md) 了解如何启动服务。


