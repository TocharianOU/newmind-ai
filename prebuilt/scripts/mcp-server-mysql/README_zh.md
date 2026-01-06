# MySQL MCP 服务器

> 基于 Model Context Protocol (MCP) 的 MySQL 数据库访问服务器

一个功能完善的 MySQL MCP 服务器实现，允许任何 MCP 兼容客户端（如 Claude Desktop、Cursor 等）通过自然语言或编程方式访问 MySQL 数据库。

**本项目基于社区版本优化，增强了企业级功能支持。**

---

## 🎯 支持的使用场景

本 MCP 服务器支持 AI 驱动的数据库操作：

### 📊 数据查询与分析
- **智能查询** - 使用自然语言执行 SQL 查询
- **数据探索** - 浏览数据库架构、表结构和数据
- **统计分析** - 执行复杂的数据分析查询

### 🔧 数据库管理
- **架构查询** (`mysql://tables` 资源) - 列出所有表和结构信息
- **表详情** (`mysql://tables/{table_name}` 资源) - 获取特定表的列信息
- **多数据库支持** - 在多个数据库之间切换操作

### ⚙️ 灵活的权限控制
- **只读模式** - 默认安全的只读访问
- **写入操作** - 可选启用 INSERT、UPDATE、DELETE 操作
- **DDL 操作** - 可选启用 CREATE、ALTER、DROP 操作
- **架构级权限** - 为不同数据库架构设置不同权限

---

## 功能特性

### 核心功能
- 支持连接本地或远程 MySQL 实例 (MySQL 5.7+, MySQL 8.0+ 推荐)
- **双传输模式**：
  - **Stdio 传输**（默认）- 用于 Claude Desktop 和本地 MCP 客户端
  - **Streamable HTTP 传输**（NEW）- 用于远程访问、API 集成和 Web 应用
- **双连接方式**：
  - TCP/IP 连接（主机:端口）
  - Unix Socket 连接（本地套接字）
- 支持 SSL/TLS 加密连接
- **多数据库模式** - 单个连接访问多个数据库
- **架构级权限控制** - 为不同架构设置不同的操作权限
- **安全的只读模式** - 默认禁用所有写入操作
- **会话管理** - HTTP 模式下自动生成 UUID
- **健康检查端点** - 用于监控和负载均衡

### 五个核心工具

本服务器实现了 **Database MCP Tools 设计规范 v1.0**，包含五个核心工具：

#### 1. **query_database**
执行 MySQL SELECT 查询操作。

**参数：**
- `connection_name`（必需）：连接标识符
- `query`（必需）：SQL 查询语句（SELECT/SHOW/DESCRIBE/EXPLAIN）
- `parameters`（可选）：预处理语句的查询参数
- `token_limit`（可选）：结果大小限制（tokens），默认 8000
- `break_token_rule`（可选）：绕过 token 限制，默认 false

**返回：** JSON 格式的查询结果

**用途：** 日志查询分析、安全事件检索、数据探索、应用数据访问

#### 2. **get_schema_info**
获取数据库结构和表信息。

**参数：**
- `connection_name`（必需）：连接标识符
- `object_name`（可选）：表名（省略则列出所有表）
- `token_limit`（可选）：结果大小限制（tokens），默认 8000
- `break_token_rule`（可选）：绕过 token 限制，默认 false

**返回：** 表列表或表结构（包含列、索引和约束）

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

## 🚀 安装

### 快速安装

```bash
# 全局安装（推荐）
npm install -g @tocharian/mcp-server-mysql

# 或本地安装
npm install @tocharian/mcp-server-mysql
```

### 替代方案：从源码安装

```bash
git clone https://github.com/tocharian/mcp-server-mysql.git
cd mcp-server-mysql
npm install
npm run build
```

---

## 🎯 快速开始

### 方法 1: 直接命令行使用

#### 使用 TCP/IP 连接
```bash
# 设置 MySQL 凭据并运行
MYSQL_HOST=localhost \
MYSQL_PORT=3306 \
MYSQL_USER=root \
MYSQL_PASS=your_password \
MYSQL_DB=your_database \
/path/to/node /path/to/mcp-server-mysql/dist/index.js
```

#### 使用 Unix Socket 连接
```bash
# 使用 Unix Socket
MYSQL_SOCKET_PATH=/tmp/mysql.sock \
MYSQL_USER=root \
MYSQL_PASS=your_password \
MYSQL_DB=your_database \
/path/to/node /path/to/mcp-server-mysql/dist/index.js
```

### 方法 2: Claude Desktop 集成（推荐）

添加到 Claude Desktop 配置文件：

**配置文件位置:**
- **MacOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

#### 使用 TCP/IP 连接（只读模式）
```json
{
  "mcpServers": {
    "mysql-mcp-server": {
      "command": "/path/to/node",
      "args": ["/path/to/mcp-server-mysql/dist/index.js"],
      "env": {
        "MYSQL_HOST": "localhost",
        "MYSQL_PORT": "3306",
        "MYSQL_USER": "root",
        "MYSQL_PASS": "your_password",
        "MYSQL_DB": "your_database",
        "ALLOW_INSERT_OPERATION": "false",
        "ALLOW_UPDATE_OPERATION": "false",
        "ALLOW_DELETE_OPERATION": "false",
        "ALLOW_DDL_OPERATION": "false"
      }
    }
  }
}
```

#### 使用 Unix Socket 连接
```json
{
  "mcpServers": {
    "mysql-mcp-server": {
      "command": "/path/to/node",
      "args": ["/path/to/mcp-server-mysql/dist/index.js"],
      "env": {
        "MYSQL_SOCKET_PATH": "/tmp/mysql.sock",
        "MYSQL_USER": "root",
        "MYSQL_PASS": "your_password",
        "MYSQL_DB": "your_database"
      }
    }
  }
}
```

### 方法 3: 使用环境文件

```bash
# 创建 .env 文件
cat > mysql-mcp.env << EOF
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASS=your_password
MYSQL_DB=your_database
ALLOW_INSERT_OPERATION=false
ALLOW_UPDATE_OPERATION=false
ALLOW_DELETE_OPERATION=false
EOF

# 使用环境文件运行
env $(cat mysql-mcp.env | xargs) /path/to/node /path/to/mcp-server-mysql/dist/index.js
```

### 方法 4: Streamable HTTP 模式（NEW）

将服务器作为独立的 HTTP 服务运行，支持远程访问和 API 集成：

```bash
# 启动 HTTP 服务器（默认端口 3000）
MCP_TRANSPORT=http \
MCP_HTTP_PORT=3000 \
MCP_HTTP_HOST=0.0.0.0 \
MYSQL_HOST=localhost \
MYSQL_PORT=3306 \
MYSQL_USER=root \
MYSQL_PASS=your_password \
MYSQL_DB=your_database \
/path/to/node /path/to/mcp-server-mysql/dist/index.js

# 或使用启动脚本
./start-http.sh
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

## 配置

通过环境变量配置服务器：

### MySQL 连接设置

| 变量名 | 描述 | 必需 | 默认值 |
|--------|------|------|--------|
| `MYSQL_HOST` | MySQL 服务器地址 | 否* | `127.0.0.1` |
| `MYSQL_PORT` | MySQL 服务器端口 | 否* | `3306` |
| `MYSQL_SOCKET_PATH` | Unix Socket 路径（替代 TCP/IP） | 否* | - |
| `MYSQL_USER` | MySQL 用户名 | 是 | - |
| `MYSQL_PASS` | MySQL 密码 | 否 | - |
| `MYSQL_DB` | 数据库名（省略则启用多数据库模式） | 否 | - |
| `MYSQL_SSL` | 启用 SSL 连接 | 否 | `false` |

*必须提供 `MYSQL_HOST`+`MYSQL_PORT` 或 `MYSQL_SOCKET_PATH` 之一。

### 传输模式设置（NEW）

| 变量名 | 描述 | 默认值 | 可选值 |
|--------|------|--------|--------|
| `MCP_TRANSPORT` | 传输模式选择 | `stdio` | `stdio`, `http` |
| `MCP_HTTP_PORT` | HTTP 服务器端口（使用 HTTP 传输时） | `3000` | 1-65535 |
| `MCP_HTTP_HOST` | HTTP 服务器主机（使用 HTTP 传输时） | `localhost` | 任意有效主机 |

**传输模式详解：**
- **Stdio 模式**（默认）：用于 Claude Desktop 和本地 MCP 客户端
- **HTTP 模式**：作为独立 HTTP 服务器运行，支持远程访问、API 集成和 Web 应用

### 操作权限设置

| 变量名 | 描述 | 默认值 |
|--------|------|--------|
| `ALLOW_INSERT_OPERATION` | 允许 INSERT 操作 | `false` |
| `ALLOW_UPDATE_OPERATION` | 允许 UPDATE 操作 | `false` |
| `ALLOW_DELETE_OPERATION` | 允许 DELETE 操作 | `false` |
| `ALLOW_DDL_OPERATION` | 允许 DDL 操作（CREATE、ALTER、DROP） | `false` |

### 多数据库模式

省略 `MYSQL_DB` 环境变量以启用多数据库模式：

```bash
# 多数据库模式
MYSQL_HOST=localhost \
MYSQL_USER=root \
MYSQL_PASS=password \
# 不设置 MYSQL_DB
/path/to/node /path/to/mcp-server-mysql/dist/index.js
```

在多数据库模式下：
- 可以查询所有数据库的表
- SQL 查询必须包含完整的数据库名（如 `SELECT * FROM mydb.users`）
- 默认只读模式，可通过 `MULTI_DB_WRITE_MODE=true` 启用写入

### 架构级权限（高级）

为不同的数据库架构设置不同的操作权限：

```bash
# 为 'dev_db' 架构允许 INSERT 和 UPDATE
SCHEMA_INSERT_PERMISSIONS=dev_db \
SCHEMA_UPDATE_PERMISSIONS=dev_db \
# 为 'prod_db' 架构只允许 SELECT（默认）
/path/to/node /path/to/mcp-server-mysql/dist/index.js
```

---

## 🐳 Docker 部署

### 使用预构建镜像

```bash
# 拉取镜像（如果可用）
docker pull newmind-mcp-mysql:latest

# 运行容器（Stdio 模式 - 不推荐在 Docker 中使用）
docker run -it --rm \
  -e MYSQL_HOST=host.docker.internal \
  -e MYSQL_PORT=3306 \
  -e MYSQL_USER=root \
  -e MYSQL_PASS=password \
  -e MYSQL_DB=mydb \
  newmind-mcp-mysql:latest

# 运行容器（HTTP 模式 - 推荐）
docker run -d \
  --name mysql-mcp-server \
  -p 3000:3000 \
  -e MCP_TRANSPORT=http \
  -e MCP_HTTP_HOST=0.0.0.0 \
  -e MCP_HTTP_PORT=3000 \
  -e MYSQL_HOST=host.docker.internal \
  -e MYSQL_PORT=3306 \
  -e MYSQL_USER=root \
  -e MYSQL_PASS=password \
  -e MYSQL_DB=mydb \
  newmind-mcp-mysql:latest
```

### 从源码构建 Docker 镜像

```bash
# 构建 ARM64 和 AMD64 镜像
./build-docker.sh

# 或手动构建
docker build -t newmind-mcp-mysql:latest .
```

### Docker Compose 示例

```yaml
version: '3.8'

services:
  mysql-mcp-server:
    image: newmind-mcp-mysql:latest
    container_name: mysql-mcp-server
    ports:
      - "3000:3000"
    environment:
      - MCP_TRANSPORT=http
      - MCP_HTTP_HOST=0.0.0.0
      - MCP_HTTP_PORT=3000
      - MYSQL_HOST=mysql
      - MYSQL_PORT=3306
      - MYSQL_USER=root
      - MYSQL_PASS=rootpassword
      - MYSQL_DB=mydb
      - ALLOW_INSERT_OPERATION=false
      - ALLOW_UPDATE_OPERATION=false
      - ALLOW_DELETE_OPERATION=false
    depends_on:
      - mysql
    restart: unless-stopped

  mysql:
    image: mysql:8.0
    container_name: mysql
    environment:
      - MYSQL_ROOT_PASSWORD=rootpassword
      - MYSQL_DATABASE=mydb
    ports:
      - "3306:3306"
    volumes:
      - mysql-data:/var/lib/mysql
    restart: unless-stopped

volumes:
  mysql-data:
```

---

## 示例查询

### 基础查询
- "显示数据库中的所有表"
- "users 表的结构是什么？"
- "从 users 表中获取前 10 条记录"
- "统计 orders 表中有多少条记录"

### 数据分析
- "找出销售额最高的前 5 个产品"
- "按月份统计订单数量"
- "计算每个用户的平均订单金额"
- "查找上个月注册的所有用户"

### 数据操作（需要启用权限）
- "在 users 表中插入一条新记录"
- "更新 ID 为 123 的用户的邮箱地址"
- "删除所有未激活的用户账号"
- "创建一个名为 temp_data 的新表"

### 多数据库查询（多数据库模式）
- "列出所有数据库"
- "显示 production 数据库中的所有表"
- "从 dev_db.users 和 prod_db.users 中获取数据"

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

## 调试

由于 MCP 服务器通过 stdio 通信，调试可能不便。推荐使用 MCP Inspector：

```bash
npm run inspector
```

启动后，Inspector 会提供一个可在浏览器访问的调试工具 URL。

---

## 📦 包信息
- **Node.js 要求**: >= 20.0.0
- **MySQL 要求**: >= 5.7 (推荐 8.0+)

---

## 🔧 故障排查

### 常见问题

#### 连接失败
```bash
# 检查 MySQL 服务是否运行
mysql -h localhost -u root -p

# 测试网络连接
telnet localhost 3306

# 检查防火墙设置
```

#### 权限错误
```bash
# 确保用户有足够的权限
GRANT ALL PRIVILEGES ON database.* TO 'user'@'localhost';
FLUSH PRIVILEGES;

# 对于只读访问
GRANT SELECT ON database.* TO 'user'@'localhost';
```

#### Unix Socket 连接问题
```bash
# 查找 MySQL socket 文件位置
mysql_config --socket

# 常见位置
# /tmp/mysql.sock
# /var/run/mysqld/mysqld.sock
# /var/lib/mysql/mysql.sock
```

#### Docker 网络问题
```bash
# 使用 host.docker.internal 访问主机上的 MySQL
MYSQL_HOST=host.docker.internal

# 或使用容器网络
docker network create mysql-network
docker run --network mysql-network ...
```

#### HTTP 模式端口占用
```bash
# 检查端口是否被占用
lsof -i :3000

# 更换端口
MCP_HTTP_PORT=3001 npm run start:http
```

---

## 安全建议

### 生产环境部署

1. **使用只读账户**
```sql
CREATE USER 'readonly'@'%' IDENTIFIED BY 'secure_password';
GRANT SELECT ON database.* TO 'readonly'@'%';
```

2. **启用 SSL 连接**
```bash
MYSQL_SSL=true
```

3. **限制网络访问**
```bash
# 仅监听本地接口
MCP_HTTP_HOST=127.0.0.1
```

4. **使用环境变量管理**
```bash
# 不要在代码中硬编码密码
# 使用 .env 文件或密钥管理服务
```

5. **定期审计日志**
```bash
# 启用 MySQL 查询日志
SET GLOBAL general_log = 'ON';
```

---

## 社区

本项目基于社区开源版本。欢迎贡献和反馈！

---

## 许可证

本项目采用 MIT 许可。详情见 [LICENSE](LICENSE.md) 文件。

---

## 致谢
- 基于: [Model Context Protocol](https://modelcontextprotocol.io/)
- MySQL 驱动: [mysql2](https://github.com/sidorares/node-mysql2)

---

## 相关链接

- [Model Context Protocol 文档](https://modelcontextprotocol.io/)
- [MySQL 官方文档](https://dev.mysql.com/doc/)
- [Claude Desktop](https://claude.ai/desktop)




