# MySQL MCP 服务器

MySQL MCP 服务器允许 NewmindChat 直接与 MySQL 数据库交互，进行数据查询和管理。

## 功能特性

- **数据查询**：执行 SELECT 查询
- **模式信息**：获取表结构、索引和约束
- **写入操作**：插入、更新和删除数据（可选）
- **聚合分析**：执行复杂的聚合和统计查询
- **多数据库支持**：连接和管理多个数据库

## 配置要求

### 环境变量

```bash
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASS=your-password
MYSQL_DB=your-database
# 写入权限（默认禁用，安全考虑）
ALLOW_INSERT_OPERATION=false
ALLOW_UPDATE_OPERATION=false
ALLOW_DELETE_OPERATION=false
```

### 连接示例

```json
{
  "mysql": {
    "enabled": true,
    "command": "node",
    "args": ["~/.newmind/scripts/mcp-server-mysql/dist/index.js"],
    "env": {
      "MYSQL_HOST": "127.0.0.1",
      "MYSQL_PORT": "3306",
      "MYSQL_USER": "root",
      "MYSQL_PASS": "password",
      "MYSQL_DB": "myapp",
      "ALLOW_INSERT_OPERATION": "false",
      "ALLOW_UPDATE_OPERATION": "false",
      "ALLOW_DELETE_OPERATION": "false"
    }
  }
}
```

### Unix Socket 连接

对于本地 MySQL 实例，可以使用 Unix socket：

```bash
MYSQL_SOCKET_PATH=/tmp/mysql.sock
MYSQL_USER=root
MYSQL_PASS=your-password
MYSQL_DB=your-database
```

## 使用方法

### 1. 启用服务器

在 NewmindChat 设置中启用 MySQL 服务器，并配置连接参数。

### 2. 查询数据

```
查询 users 表中所有在2024年注册的用户
```

### 3. 聚合分析

```
统计每个月的订单总额
```

### 4. 模式信息

```
显示 products 表的结构和索引
```

## 常见用例

### 数据探索
- 查询表数据
- 查看表结构
- 分析数据关系

### 报表生成
- 统计分析
- 趋势分析
- 业务报表

### 数据库管理
- 查看数据库状态
- 检查索引使用
- 监控查询性能

## 工具说明

### query_database
执行 SELECT 查询，支持 WHERE、ORDER BY、LIMIT 等子句。

### get_schema_info
获取表结构信息，包括列定义、索引、外键等。

### execute_write
执行数据修改操作（需要显式启用权限）：
- INSERT：插入新数据
- UPDATE：更新现有数据
- DELETE：删除数据

### aggregate_analyze
执行聚合查询，支持 GROUP BY、COUNT、SUM、AVG 等函数。

### list_connections
列出所有可用的 MySQL 连接及其状态。

## 安全配置

### 写入权限

默认情况下，所有写入操作都被禁用。如需启用，请显式设置：

```bash
ALLOW_INSERT_OPERATION=true
ALLOW_UPDATE_OPERATION=true
ALLOW_DELETE_OPERATION=true
```

**警告**：只在可信环境中启用写入权限，避免数据被意外修改或删除。

### 多数据库模式

省略 `MYSQL_DB` 环境变量可启用多数据库模式，允许访问用户有权限的所有数据库：

```sql
-- 使用完全限定的表名
SELECT * FROM database_name.table_name;

-- 或使用 USE 语句
USE database_name;
SELECT * FROM table_name;
```

## 令牌限制

所有工具默认限制响应大小为 8,000 令牌。优化建议：

1. 使用 LIMIT 子句减少返回行数
2. 添加更具体的 WHERE 条件
3. 使用分页（OFFSET/LIMIT）
4. SELECT 指定列而不是 *
5. 如必要，设置 `break_token_rule: true`

## 故障排除

### 连接问题
- 验证 MySQL 服务器地址和端口
- 检查防火墙设置
- 确认用户名和密码
- 检查 SSL/TLS 配置

### 权限问题
- 确保用户有适当的数据库权限
- 检查表级别权限
- 验证写入操作权限设置

### 性能问题
- 优化查询语句
- 使用索引加速查询
- 调整查询超时设置
- 监控连接池状态

## 最佳实践

- 使用只读账户访问生产数据库
- 为不同环境使用不同的连接配置
- 定期审查和优化查询
- 监控数据库性能指标
- 使用索引提高查询效率
- 谨慎启用写入权限

