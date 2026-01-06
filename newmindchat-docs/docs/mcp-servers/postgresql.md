# PostgreSQL MCP 服务器

PostgreSQL MCP 服务器允许 NewmindChat 直接与 PostgreSQL 数据库交互，进行数据查询和管理。

## 功能特性

- **数据查询**：执行 SELECT 查询和 EXPLAIN 分析
- **模式信息**：获取表结构、索引、约束和视图
- **写入操作**：插入、更新和删除数据
- **聚合分析**：执行复杂的聚合和统计查询
- **性能监控**：查看查询计划和数据库状态
- **SSL/TLS 支持**：安全连接到远程数据库

## 配置要求

### 环境变量

```bash
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASS=your-password
POSTGRES_DB=your-database
```

### 连接示例

```json
{
  "pgsql": {
    "enabled": true,
    "command": "node",
    "args": ["~/.newmind/scripts/mcp-server-pgsql/build/index.js"],
    "env": {
      "POSTGRES_HOST": "localhost",
      "POSTGRES_PORT": "5432",
      "POSTGRES_USER": "postgres",
      "POSTGRES_PASS": "password",
      "POSTGRES_DB": "myapp"
    }
  }
}
```

### SSL 连接

对于需要 SSL 的 PostgreSQL 服务器：

```bash
# 禁用 SSL 证书验证（仅测试环境）
NODE_TLS_REJECT_UNAUTHORIZED=0
```

**注意**：生产环境应使用有效的 SSL 证书，避免禁用证书验证。

## 使用方法

### 1. 启用服务器

在 NewmindChat 设置中启用 PostgreSQL 服务器，并配置连接参数。

### 2. 查询数据

```
查询 users 表中最近注册的10个用户
```

### 3. 分析查询性能

```
解释 SELECT 语句的执行计划
```

### 4. 模式信息

```
显示 public schema 中的所有表和视图
```

## 常见用例

### 数据分析
- 复杂查询和子查询
- 窗口函数分析
- JSON/JSONB 数据查询
- 全文搜索

### 数据库管理
- 查看表结构和约束
- 检查索引使用情况
- 监控数据库性能
- 分析查询计划

### 开发支持
- 测试 SQL 语句
- 数据验证
- 模式设计
- 性能优化

## 工具说明

### query_database
执行 SELECT 查询，支持 PostgreSQL 的所有查询特性：
- 窗口函数
- CTE（公共表表达式）
- JSON/JSONB 操作
- 数组操作
- 全文搜索

### get_schema_info
获取数据库模式信息：
- 表结构（列、类型、默认值）
- 索引和约束
- 外键关系
- 视图定义
- 函数和触发器

### execute_write
执行数据修改操作：
- INSERT：插入新数据，支持 RETURNING 子句
- UPDATE：更新现有数据
- DELETE：删除数据

### aggregate_analyze
执行聚合和分析查询：
- GROUP BY 聚合
- 统计函数（COUNT、SUM、AVG等）
- 窗口函数
- 分组集（GROUPING SETS）

### list_connections
列出所有可用的 PostgreSQL 连接及其状态。

## PostgreSQL 特性

### JSONB 支持

```sql
-- 查询 JSONB 字段
SELECT data->>'name' FROM users WHERE data @> '{"active": true}';
```

### 数组操作

```sql
-- 数组查询
SELECT * FROM products WHERE tags && ARRAY['electronics', 'sale'];
```

### 窗口函数

```sql
-- 使用窗口函数进行排名
SELECT name, salary, 
       RANK() OVER (ORDER BY salary DESC) as rank
FROM employees;
```

### 全文搜索

```sql
-- 全文搜索
SELECT * FROM articles 
WHERE to_tsvector('english', content) @@ to_tsquery('database & performance');
```

## 令牌限制

所有工具默认限制响应大小为 8,000 令牌。优化建议：

1. 使用 LIMIT 子句减少返回行数
2. 添加更具体的 WHERE 条件
3. 使用 OFFSET/LIMIT 实现分页
4. SELECT 指定列而不是 *
5. 如必要，设置 `break_token_rule: true`

## 性能优化

### 查询优化
- 使用 EXPLAIN ANALYZE 分析查询
- 创建适当的索引
- 优化 JOIN 操作
- 使用物化视图

### 索引策略
- B-tree 索引：常规查询
- GIN 索引：全文搜索、JSONB
- GiST 索引：地理数据、范围查询
- Hash 索引：等值查询

## 故障排除

### 连接问题
- 验证 PostgreSQL 服务器地址和端口
- 检查 pg_hba.conf 配置
- 确认用户名和密码
- 检查 SSL 设置

### 权限问题
- 确保用户有适当的数据库权限
- 检查 schema 级别权限
- 验证表级别权限
- 检查行级安全策略（RLS）

### 性能问题
- 使用 EXPLAIN ANALYZE 分析慢查询
- 检查索引使用情况
- 监控连接池状态
- 调整查询超时设置
- 检查统计信息更新

## 最佳实践

- 使用连接池管理数据库连接
- 定期运行 VACUUM 和 ANALYZE
- 监控慢查询日志
- 使用事务确保数据一致性
- 为生产环境使用只读账户
- 定期备份数据库
- 使用适当的索引策略
- 监控数据库性能指标

