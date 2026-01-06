# MongoDB MCP 服务器

MongoDB MCP 服务器允许 NewmindChat 直接与 MongoDB 数据库交互，进行数据查询和管理。

## 功能特性

- **数据查询**：执行 MongoDB find 查询
- **模式信息**：获取集合结构和示例文档
- **写入操作**：插入、更新和删除文档
- **聚合分析**：执行复杂的聚合管道
- **连接管理**：查看和管理数据库连接

## 配置要求

### 环境变量

```bash
MONGODB_HOST=localhost
MONGODB_PORT=27017
MONGODB_USER=your-username
MONGODB_PASS=your-password
MONGODB_DB=your-database
```

### 连接示例

```json
{
  "mongodb": {
    "enabled": true,
    "command": "node",
    "args": ["~/.newmind/scripts/mcp-server-mongodb/index.js"],
    "env": {
      "MONGODB_HOST": "localhost",
      "MONGODB_PORT": "27017",
      "MONGODB_USER": "admin",
      "MONGODB_PASS": "password",
      "MONGODB_DB": "myapp"
    }
  }
}
```

## 使用方法

### 1. 启用服务器

在 NewmindChat 设置中启用 MongoDB 服务器，并配置连接参数。

### 2. 查询数据

```
查询 users 集合中所有活跃用户
```

### 3. 聚合分析

```
统计过去7天每天的用户注册数量
```

### 4. 模式信息

```
显示 orders 集合的结构和示例数据
```

## 常见用例

### 应用数据查询
- 查询用户信息
- 获取订单数据
- 检索日志记录

### 数据分析
- 统计分析
- 趋势分析
- 聚合报表

### 数据管理
- 插入新文档
- 更新现有数据
- 删除过期数据

## 工具说明

### query_database
执行 MongoDB find 查询，支持过滤、投影、排序和限制。

### get_schema_info
获取数据库和集合的结构信息，包括示例文档和索引。

### execute_write
执行数据修改操作（插入、更新、删除）。

### aggregate_analyze
执行 MongoDB 聚合管道进行复杂数据分析。

### list_connections
列出所有可用的 MongoDB 连接及其状态。

## 令牌限制

所有工具默认限制响应大小为 8,000 令牌。如果响应超出限制，系统会提供优化建议：

1. 使用 `limit` 减少返回文档数量
2. 添加更具体的查询条件
3. 使用 `projection` 只返回需要的字段
4. 使用分页功能
5. 如必要，设置 `break_token_rule: true` 强制返回完整结果

## 故障排除

### 连接问题
- 验证 MongoDB 服务器地址和端口
- 检查网络连接
- 确认用户名和密码

### 权限问题
- 确保用户有足够的数据库权限
- 检查角色配置
- 验证数据库访问权限

### 性能问题
- 优化查询条件
- 使用索引加速查询
- 限制返回文档数量
- 监控资源使用

## 最佳实践

- 使用索引优化查询性能
- 限制查询返回的文档数量
- 定期备份重要数据
- 监控数据库性能指标
- 为生产环境使用只读账户

