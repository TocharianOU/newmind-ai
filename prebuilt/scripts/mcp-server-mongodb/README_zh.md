# MongoDB MCP 服务器

[![npm 版本](https://badge.fury.io/js/@tocharian%2Fmcp-server-mongodb.svg)](https://www.npmjs.com/package/@tocharian/mcp-server-mongodb)
[![许可证](https://img.shields.io/github/license/tocharian/mcp-server-mongodb)](./LICENSE)

MongoDB MCP 服务器实现，通过五个核心工具提供标准化的数据库访问，专为 AI 助手和安全运营设计。

**本项目由社区维护，非 MongoDB 或 MCP 官方产品。**

---

## 🚀 安装

### 快速安装
```bash
# 全局安装(推荐)
npm install -g @tocharian/mcp-server-mongodb

# 或本地安装
npm install @tocharian/mcp-server-mongodb
```

### 替代方案:从源码安装
```bash
git clone https://github.com/tocharian/mcp-server-mongodb.git
cd mcp-server-mongodb
npm install
```

---

## 🎯 快速开始

### 方法 1: 直接命令行使用

```bash
# 使用环境变量
MONGODB_HOST=localhost \
MONGODB_PORT=27017 \
MONGODB_USER=admin \
MONGODB_PASS=password \
/path/to/index.js
```

### 方法 2: Claude Desktop 集成(推荐)
添加到 Claude Desktop 配置文件:

**配置文件位置:**
- **MacOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "mcp-server-mongodb": {
      "command": "/path/to/node",
      "args": [
        "/path/to/index.js"
      ],
      "env": {
        "MONGODB_HOST": "localhost",
        "MONGODB_PORT": "27017",
        "MONGODB_USER": "admin",
        "MONGODB_PASS": "password"
      }
    }
  }
}
```

### 方法 3: Streamable HTTP 模式

将服务器作为独立的 HTTP 服务运行，支持远程访问和 API 集成:

```bash
# 启动 HTTP 服务器(默认端口 3002)
MCP_TRANSPORT=http \
MCP_HTTP_PORT=3002 \
MCP_HTTP_HOST=0.0.0.0 \
MONGODB_HOST=localhost \
MONGODB_PORT=27017 \
MONGODB_USER=admin \
MONGODB_PASS=password \
/path/to/index.js

# 或使用启动脚本
./start-http.sh
```

**HTTP 模式特性:**
- 在 `http://host:port/mcp` 端点暴露 MCP 服务器
- 在 `http://host:port/health` 提供健康检查
- 基于会话的连接管理
- 支持 POST(JSON-RPC 请求)和 GET(SSE 流)
- 兼容任何 HTTP 客户端或 MCP SDK

---

## 功能特性

### 核心功能
- 支持连接本地或远程 MongoDB 实例
- **双传输模式**:
  - **Stdio 传输**(默认) - 用于 Claude Desktop 和本地 MCP 客户端
  - **Streamable HTTP 传输** - 用于远程访问、API 集成和 Web 应用
- **Token 限制响应** - 自动结果大小管理，可配置限制
- 通过 LLM 支持自然语言查询
- SSL/TLS 及认证支持
- 类型安全、可扩展、易集成

### 五个核心工具

本服务器实现了 **Database MCP Tools 设计规范 v1.0**，包含五个核心工具:

#### 1. **query_database**
执行 MongoDB find 查询，完全控制过滤器和选项。

**参数:**
- `connection_name` (必需): 连接标识符
- `query` (必需): MongoDB 查询过滤对象
- `parameters` (必需): 查询选项包括:
  - `collection` (必需): 集合名称
  - `projection`: 返回的字段
  - `sort`: 排序规范
  - `limit`: 返回的最大文档数
  - `skip`: 跳过的文档数
- `token_limit` (可选): 结果大小限制(tokens)，默认 8000
- `break_token_rule` (可选): 绕过 token 限制，默认 false

**返回:** 查询结果及文档数量

**用途:**
- 日志查询和分析
- 安全事件检索
- 数据探索
- 应用数据访问

**示例:**
```json
{
  "connection_name": "default",
  "query": { "status": "active", "created_at": { "$gte": "2024-01-01" } },
  "parameters": {
    "collection": "users",
    "projection": { "name": 1, "email": 1 },
    "sort": { "created_at": -1 },
    "limit": 100
  },
  "token_limit": 8000
}
```

#### 2. **get_schema_info**
获取数据库结构、集合信息和样本文档。

**参数:**
- `connection_name` (必需): 连接标识符
- `object_name` (可选): 集合名称(省略则列出所有集合)
- `token_limit` (可选): 结果大小限制(tokens)，默认 8000
- `break_token_rule` (可选): 绕过 token 限制，默认 false

**返回:**
- 数据库名称
- 集合列表(如果未指定 object_name)
- 集合详情，包括样本文档、索引和统计信息(如果指定了 object_name)

**用途:**
- 理解数据结构
- Schema 发现
- 数据库文档
- 查询规划

**示例:**
```json
{
  "connection_name": "default",
  "object_name": "users",
  "token_limit": 8000
}
```

#### 3. **execute_write**
执行数据修改操作(INSERT/UPDATE/DELETE)。

**参数:**
- `connection_name` (必需): 连接标识符
- `operation` (必需): 操作类型 - "insert"、"update" 或 "delete"
- `data` (必需): 操作特定数据:
  - `collection` (必需): 集合名称
  - INSERT: `document` - 单个文档或文档数组
  - UPDATE: `filter` 和 `update` - 过滤条件和更新操作
  - DELETE: `filter` - 删除条件
  - `options` - 附加选项(如 `upsert`、`multi`)
- `token_limit` (可选): 结果大小限制(tokens)，默认 8000
- `break_token_rule` (可选): 绕过 token 限制，默认 false

**返回:** 操作结果，包含确认状态和影响数量

**用途:**
- 数据修改
- 配置更新
- 威胁情报写入
- 用户管理

**INSERT 示例:**
```json
{
  "connection_name": "default",
  "operation": "insert",
  "data": {
    "collection": "logs",
    "document": { "level": "info", "message": "系统启动", "timestamp": "2024-12-15T10:00:00Z" }
  }
}
```

**UPDATE 示例:**
```json
{
  "connection_name": "default",
  "operation": "update",
  "data": {
    "collection": "users",
    "filter": { "email": "user@example.com" },
    "update": { "$set": { "status": "inactive" } }
  }
}
```

#### 4. **aggregate_analyze**
执行 MongoDB 聚合管道进行复杂数据分析。

**参数:**
- `connection_name` (必需): 连接标识符
- `aggregation_spec` (必需): 聚合规范:
  - `collection` (必需): 集合名称
  - `pipeline` (必需): MongoDB 聚合管道数组
- `token_limit` (可选): 结果大小限制(tokens)，默认 8000
- `break_token_rule` (可选): 绕过 token 限制，默认 false

**返回:** 聚合结果及管道详情

**用途:**
- 安全事件统计
- 趋势分析
- 威胁指标聚合
- 性能指标
- 复杂报告

**示例:**
```json
{
  "connection_name": "default",
  "aggregation_spec": {
    "collection": "security_events",
    "pipeline": [
      { "$match": { "severity": "high", "timestamp": { "$gte": "2024-12-01" } } },
      { "$group": { "_id": "$event_type", "count": { "$sum": 1 } } },
      { "$sort": { "count": -1 } }
    ]
  }
}
```

#### 5. **list_connections**
列出可用的数据库连接及其状态。

**参数:**
- `token_limit` (可选): 结果大小限制(tokens)，默认 8000
- `break_token_rule` (可选): 绕过 token 限制，默认 false

**返回:** 连接信息数组，包括:
- 连接名称
- 数据库类型
- 连接状态
- 当前数据库名称
- 混淆的 URI

**用途:**
- 连接管理
- 系统诊断
- 多数据库场景

**响应示例:**
```json
[
  {
    "name": "default",
    "type": "mongodb",
    "status": "connected",
    "database": "security_db",
    "uri": "mongodb://****:****@localhost:27017"
  }
]
```

---

## Token 限制

所有工具都实现了自动 token 限制，以防止上下文溢出:

- **默认限制**: 每个响应 8,000 tokens
- **自动拒绝**: 超过限制的响应将被拒绝并提供优化建议
- **绕过选项**: 设置 `break_token_rule: true` 强制返回完整结果

**超过限制时的优化建议:**
1. 使用 `limit` 减少返回的文档数
2. 添加更具体的过滤条件
3. 使用 `skip` 和 `limit` 进行分页
4. 使用 `projection` 只返回需要的字段
5. 如果完整结果至关重要，设置 `break_token_rule: true`

---

## 配置

通过环境变量配置服务器:

### MongoDB 连接设置
| 变量名           | 描述                                    | 是否必需 | 默认值 |
|------------------|----------------------------------------|----------|--------|
| `MONGODB_HOST`   | MongoDB 服务器地址                      | 否       | `localhost` |
| `MONGODB_PORT`   | MongoDB 服务器端口                      | 否       | `27017` |
| `MONGODB_USER`   | MongoDB 用户名                          | 否       | - |
| `MONGODB_PASS`   | MongoDB 密码                            | 否       | - |
| `MONGODB_DB`     | 数据库名称（留空则为多数据库模式）       | 否       | - |

**兼容性**：同时支持 `MONGODB_USERNAME`、`MONGODB_PASSWORD` 别名

### 传输模式设置
| 变量名          | 描述                          | 默认值      | 可选值          |
|-----------------|-------------------------------|-------------|-----------------|
| `MCP_TRANSPORT` | 传输模式选择                  | `stdio`     | `stdio`, `http` |
| `MCP_HTTP_PORT` | HTTP 服务器端口(使用 HTTP 时) | `3002`      | 1-65535         |
| `MCP_HTTP_HOST` | HTTP 服务器主机(使用 HTTP 时) | `localhost` | 任意有效主机     |

**传输模式详解:**
- **Stdio 模式**(默认): 用于 Claude Desktop 和本地 MCP 客户端
- **HTTP 模式**: 作为独立 HTTP 服务器运行，支持远程访问、API 集成和 Web 应用

---

## 示例查询

### 基础查询
- "查找 2024-01-01 之后创建的所有用户"
- "统计 logs 集合中的文档数量"
- "显示 security_events 集合的结构"
- "列出所有可用的数据库"

### 数据操作
- "插入一个严重程度为 high 的新安全事件"
- "将所有不活跃用户的状态更新为已归档"
- "删除超过 30 天的日志"

### 聚合分析
- "按严重程度分组显示安全事件"
- "按每小时分析登录模式"
- "统计每个用户的失败认证尝试次数"
- "显示最频繁的前 10 个事件类型"

---

## 开发

安装依赖:

```bash
npm install
```

以不同模式运行:

```bash
# Stdio 模式(默认)
npm start

# HTTP 模式
npm run start:http

# 使用自定义配置
MONGODB_HOST=localhost \
MONGODB_USER=admin \
MONGODB_PASS=password \
node index.js
```

---

## 📦 包信息

- **NPM 包**: [@tocharian/mcp-server-mongodb](https://www.npmjs.com/package/@tocharian/mcp-server-mongodb)
- **GitHub 仓库**: [tocharian/mcp-server-mongodb](https://github.com/tocharian/mcp-server-mongodb)
- **Node.js 要求**: >= 18.0.0
- **作者**: @tocharian

---

## 许可证

本项目采用 MIT 许可证。详情见 [LICENSE](LICENSE) 文件。

---

## 故障排查

### 常见问题

#### 连接问题
- 验证 MongoDB URI 是否可访问
- 检查认证凭据
- 确保数据库服务器正在运行
- 对于 SSL 问题，尝试设置 `NODE_TLS_REJECT_UNAUTHORIZED=0`

#### Claude Desktop 未检测到服务器
- 配置更改后重启 Claude Desktop
- 使用 JSON 验证器检查配置文件语法
- 验证文件路径是绝对路径且正确

#### Token 限制超出错误
- 使用 `limit` 减少返回的文档数
- 添加更具体的过滤条件
- 使用 `projection` 只返回必要的字段
- 如果需要完整结果，设置 `break_token_rule: true`

---

## 社区

本项目由社区维护。欢迎贡献和反馈!
