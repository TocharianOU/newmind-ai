# PostgreSQL MCP 服务器
[![npm 版本](https://badge.fury.io/js/@tocharian%2Fmcp-server-pgsql.svg)](https://www.npmjs.com/package/@tocharian/mcp-server-pgsql)
[![下载量](https://img.shields.io/npm/dm/@tocharian/mcp-server-pgsql.svg)](https://www.npmjs.com/package/@tocharian/mcp-server-pgsql)

这是一个 PostgreSQL MCP 服务器实现，为 AI 助手提供全面的 PostgreSQL 数据库管理能力。

**本项目由社区维护，非 PostgreSQL 或 MCP 官方产品。**

---

## 🎯 支持的使用场景

本 MCP 服务器支持 AI 驱动的 PostgreSQL 数据库管理：

### 🗄️ 数据库管理
- **模式管理** - 表、列、枚举、约束管理
- **用户权限** - 创建用户、授权/撤销权限
- **索引优化** - 创建、分析、优化索引

### 📊 数据操作
- **查询执行** - SELECT 操作，支持计数/存在性检查
- **数据变更** - INSERT/UPDATE/DELETE/UPSERT 操作
- **SQL 执行** - 任意 SQL 执行，支持事务

### 🔧 性能与调试
- **查询性能** - EXPLAIN 计划、慢查询、统计信息
- **数据库分析** - 性能和配置分析
- **实时监控** - 实时数据库指标和告警

### 🔒 安全管理
- **行级安全** - RLS 策略和管理
- **约束管理** - 外键、检查、唯一约束
- **注释管理** - 全面的数据库对象注释管理

---

## 功能特性

### 核心功能
- 支持连接本地或远程 PostgreSQL 实例
- **双传输模式**：
  - **Stdio 传输**（默认）- 用于 Claude Desktop 和本地 MCP 客户端
  - **Streamable HTTP 传输**（新增）- 用于远程访问、API 集成和 Web 应用
- 灵活的连接配置（CLI 参数、环境变量或按工具配置）
- 支持 SSL/TLS 及自定义证书
- 类型安全、可扩展、易集成
- **会话管理** - HTTP 模式下自动生成 UUID
- **健康检查端点** - 用于监控和负载均衡

### 五个核心工具

本服务器实现了 **Database MCP Tools 设计规范 v1.0**，包含五个核心工具：

#### 1. **query_database**
执行 PostgreSQL SELECT 查询操作。

**参数：**
- `connection_name`（必需）：连接标识符
- `query`（必需）：SQL 查询语句（SELECT/SHOW/EXPLAIN）
- `parameters`（可选）：预处理语句的查询参数
- `token_limit`（可选）：结果大小限制（tokens），默认 8000
- `break_token_rule`（可选）：绕过 token 限制，默认 false

**返回：** JSON 格式的查询结果

**用途：** 日志查询分析、安全事件检索、数据探索、应用数据访问

#### 2. **get_schema_info**
获取数据库结构和表信息。

**参数：**
- `connection_name`（必需）：连接标识符
- `object_name`（可选）：表名（省略则列出所有表/模式）
- `token_limit`（可选）：结果大小限制（tokens），默认 8000
- `break_token_rule`（可选）：绕过 token 限制，默认 false

**返回：** 模式/表列表或表结构（包含列、索引和约束）

**用途：** 理解数据结构、Schema 发现、数据库文档、查询规划

#### 3. **execute_write**
执行数据修改操作（INSERT/UPDATE/DELETE）。

**参数：**
- `connection_name`（必需）：连接标识符
- `operation`（必需）：操作类型 - "insert"、"update" 或 "delete"
- `data`（必需）：操作数据（table、values/set/where、parameters）
- `token_limit`（可选）：结果大小限制（tokens），默认 8000
- `break_token_rule`（可选）：绕过 token 限制，默认 false

**返回：** 操作结果及影响的行数

**用途：** 数据修改、配置更新、威胁情报写入、用户管理

#### 4. **aggregate_analyze**
执行聚合和统计查询（GROUP BY、COUNT、SUM 等）。

**参数：**
- `connection_name`（必需）：连接标识符
- `aggregation_spec`（必需）：聚合规范（query、parameters）
- `token_limit`（可选）：结果大小限制（tokens），默认 8000
- `break_token_rule`（可选）：绕过 token 限制，默认 false

**返回：** 聚合结果

**用途：** 安全事件统计、趋势分析、威胁指标聚合、性能指标、复杂报告

#### 5. **list_connections**
列出可用的数据库连接及其状态。

**参数：**
- `token_limit`（可选）：结果大小限制（tokens），默认 8000
- `break_token_rule`（可选）：绕过 token 限制，默认 false

**返回：** 连接信息数组（名称、类型、状态、配置）

**用途：** 连接管理、系统诊断、多数据库场景

### Token 限制

所有工具都实现了自动 token 限制，以防止上下文溢出：

- **默认限制**：每个响应 8,000 tokens
- **自动拒绝**：超过限制的响应将被拒绝并提供优化建议
- **绕过选项**：设置 `break_token_rule: true` 强制返回完整结果

**超过限制时的优化建议：**
1. 使用 LIMIT 子句减少返回的行数
2. 添加更具体的 WHERE 条件
3. 使用 OFFSET/LIMIT 进行分页
4. 只 SELECT 需要的列，避免 SELECT *
5. 如果完整结果至关重要，设置 `break_token_rule: true`

---

## 目录结构

```
├── src/
│   ├── index.ts                # 服务器入口与工具注册
│   ├── types/
│   │   └── tool.ts             # 类型定义与 schema
│   ├── utils/
│   │   └── connection.ts       # 数据库连接管理
│   └── tools/
│       ├── analyze.ts          # 数据库分析工具
│       ├── comments.ts         # 注释管理工具
│       ├── constraints.ts      # 约束管理工具
│       ├── data.ts             # 数据操作工具
│       ├── debug.ts            # 调试工具
│       ├── enums.ts            # 枚举管理工具
│       ├── functions.ts        # 函数管理工具
│       ├── indexes.ts          # 索引管理工具
│       ├── migration.ts        # 数据迁移工具
│       ├── monitor.ts          # 监控工具
│       ├── performance.ts      # 性能工具
│       ├── query.ts            # 查询管理工具
│       ├── schema.ts           # 模式管理工具
│       ├── triggers.ts         # 触发器管理工具
│       └── users.ts            # 用户管理工具
├── start-http.sh               # HTTP 模式启动脚本
├── README.md                   # 英文文档
└── README_zh.md                # 中文文档
```

---

## 配置

通过环境变量或命令行参数配置服务器：

### PostgreSQL 连接设置
| 变量名                          | 描述                                         | 是否必需 | 默认值 |
|----------------------------------|----------------------------------------------|----------|--------|
| `POSTGRES_HOST`                  | PostgreSQL 服务器地址                        | 否       | `localhost` |
| `POSTGRES_PORT`                  | PostgreSQL 服务器端口                        | 否       | `5432` |
| `POSTGRES_USER`                  | PostgreSQL 用户名                            | 否       | `postgres` |
| `POSTGRES_PASS`                  | PostgreSQL 密码                              | 否       | - |
| `POSTGRES_DB`                    | 数据库名称（留空则为多数据库模式）            | 否       | `postgres` |
| `NODE_TLS_REJECT_UNAUTHORIZED`   | 设为 `0` 可禁用 SSL 证书校验（谨慎使用）     | 否       | - |

**兼容性**：同时支持 `POSTGRES_PASSWORD`、`POSTGRES_DATABASE` 别名

### 传输模式设置
| 变量名          | 描述                                    | 默认值      | 可选值          |
|-----------------|----------------------------------------|------------|-----------------|
| `MCP_TRANSPORT` | 传输模式选择                            | `stdio`    | `stdio`, `http` |
| `MCP_HTTP_PORT` | HTTP 服务器端口（使用 HTTP 传输时）     | `3000`     | 1-65535         |
| `MCP_HTTP_HOST` | HTTP 服务器主机（使用 HTTP 传输时）     | `localhost`| 任意有效主机     |

**传输模式详解：**
- **Stdio 模式**（默认）：用于 Claude Desktop 和本地 MCP 客户端
- **HTTP 模式**：作为独立 HTTP 服务器运行，支持远程访问、API 集成和 Web 应用

---

## 🚀 安装

### 快速安装
```bash
# 全局安装（推荐）
npm install -g @tocharian/mcp-server-pgsql

# 或本地安装
npm install @tocharian/mcp-server-pgsql
```

### 替代方案：从源码安装
```bash
git clone https://github.com/TocharianOU/mcp-server-pgsql.git
cd mcp-server-pgsql
npm install
npm run build
```

---

## 🎯 快速开始

### 方法 1: 直接命令行使用

```bash
# 使用环境变量
POSTGRES_HOST=localhost \
POSTGRES_PORT=5432 \
POSTGRES_USER=postgres \
POSTGRES_PASS=password \
POSTGRES_DB=mydb \
/path/to/build/index.js
```

### 方法 2: Claude Desktop 集成（推荐）
添加到 Claude Desktop 配置文件：

**配置文件位置:**
- **MacOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "pgsql-mcp-server": {
      "command": "node",
      "args": ["/path/to/build/index.js"],
      "env": {
        "POSTGRES_HOST": "localhost",
        "POSTGRES_PORT": "5432",
        "POSTGRES_USER": "postgres",
        "POSTGRES_PASS": "password",
        "POSTGRES_DB": "mydb"
      }
    }
  }
}
```

### 方法 3: Streamable HTTP 模式（新增）

将服务器作为独立的 HTTP 服务运行，支持远程访问和 API 集成：

```bash
# 启动 HTTP 服务器（默认端口 3001）
MCP_TRANSPORT=http \
POSTGRES_HOST=localhost \
POSTGRES_PORT=5432 \
POSTGRES_USER=postgres \
POSTGRES_PASS=password \
POSTGRES_DB=mydb \
/path/to/build/index.js

# 或使用自定义端口和主机
MCP_TRANSPORT=http \
MCP_HTTP_PORT=9000 \
MCP_HTTP_HOST=0.0.0.0 \
POSTGRES_HOST=localhost \
POSTGRES_USER=postgres \
POSTGRES_PASS=password \
/path/to/build/index.js
```

**HTTP 模式特性：**
- 在 `http://host:port/mcp` 端点暴露 MCP 服务器
- 在 `http://host:port/health` 提供健康检查
- 基于会话的连接管理
- 支持 POST（JSON-RPC 请求）和 GET（SSE 流）
- 兼容任何 HTTP 客户端或 MCP SDK

**HTTP 客户端使用示例：**
```javascript
// 初始化连接
const response = await fetch('http://localhost:3000/mcp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'my-client', version: '1.0.0' }
    },
    id: 1
  })
});

const sessionId = response.headers.get('mcp-session-id');

// 后续请求需包含 session ID
const toolsResponse = await fetch('http://localhost:3000/mcp', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'mcp-session-id': sessionId
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    method: 'tools/list',
    params: {},
    id: 2
  })
});
```

---

## 示例查询

### 基础查询
- "分析我的数据库性能"
- "显示数据库中的所有表"
- "获取 users 表的结构"
- "查找数据库中运行缓慢的查询"

### 模式管理
- "创建一个名为 'products' 的新表，包含 id、name 和 price 列"
- "向 users 表添加一个新的 'email' 列"
- "在 email 列上创建索引以加快查找速度"
- "显示所有外键约束"

### 数据操作
- "查询 2024-01-01 之后创建的所有用户"
- "插入一个新产品，名称为 'Widget'，价格为 29.99"
- "将 id 为 5 的产品价格更新为 39.99"
- "删除所有超过 1 年的非活跃用户"

### 性能与调试
- "解释查询计划：SELECT * FROM orders WHERE user_id = 123"
- "显示数据库锁和阻塞查询"
- "监控数据库连接和活动查询"
- "检查表统计信息和 vacuum 状态"

---

## 开发

安装依赖：

```bash
npm install
```

构建服务器：

```bash
npm run build
```

开发模式下自动重建：

```bash
npm run watch
```

以不同模式运行：

```bash
# Stdio 模式（默认）
npm start

# HTTP 模式
npm run start:http

# TypeScript 开发模式
npm run start:ts

# HTTP 模式 TypeScript 开发
npm run start:http:ts
```

---

## 📚 文档

更多信息请参见 [`docs/`](./docs/) 文件夹：

- **[📖 使用指南](./docs/USAGE.md)** - 全面的工具使用和示例
- **[🛠️ 开发指南](./docs/DEVELOPMENT.md)** - 设置和贡献指南
- **[⚙️ 技术细节](./docs/TECHNICAL.md)** - 架构和实现
- **[👨‍💻 开发者参考](./docs/DEVELOPER.md)** - API 参考和高级用法
- **[📋 文档索引](./docs/INDEX.md)** - 完整文档概览
- **[📋 工具模式](./TOOL_SCHEMAS.md)** - 所有工具参数和示例

---

## 📦 包信息

- **NPM 包**: [@tocharian/mcp-server-pgsql](https://www.npmjs.com/package/@tocharian/mcp-server-pgsql)
- **GitHub 仓库**: [TocharianOU/mcp-server-pgsql](https://github.com/TocharianOU/mcp-server-pgsql)
- **Node.js 要求**: >= 18.0.0

---

## 🔧 故障排查

### 常见问题

#### 连接问题
- 验证 PostgreSQL 连接配置是否正确
- 检查认证凭据
- 确保数据库从您的网络可访问
- 对于 SSL 问题，尝试设置 `NODE_TLS_REJECT_UNAUTHORIZED=0`

#### Claude Desktop 未检测到服务器
- 配置更改后重启 Claude Desktop
- 使用 JSON 验证器检查配置文件语法
- 验证环境变量或命令行参数设置正确
- 确保 `build/index.js` 的路径是绝对路径且正确

---

## 社区

本项目由社区维护。欢迎贡献和反馈！请在所有交流中保持尊重和包容。

---

## 许可证

本项目采用 AGPLv3 许可。详情见 [LICENSE](LICENSE) 文件。

---

## 故障排查

- 检查 MCP 配置是否正确
- 确认 PostgreSQL 地址可访问
- 验证认证凭据是否有足够权限
- 如使用自定义证书，确保证书路径正确且可读
- 如使用 `NODE_TLS_REJECT_UNAUTHORIZED=0`，请注意安全风险
- 检查终端输出的错误信息
















