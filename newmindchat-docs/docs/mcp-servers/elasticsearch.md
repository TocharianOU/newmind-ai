# Elasticsearch MCP 服务器

Elasticsearch MCP 服务器允许 NewmindChat 直接与 Elasticsearch 集群交互，进行数据搜索和分析。

## 功能特性

- **数据搜索**：在 Elasticsearch 中搜索文档
- **索引管理**：创建、删除和管理索引
- **聚合分析**：执行复杂的数据聚合查询
- **集群监控**：获取集群健康状态和统计信息
- **文档操作**：索引、更新和删除文档

## 配置要求

### 环境变量

```bash
ES_URL=https://your-elasticsearch-cluster.com:9200
ES_API_KEY=your-api-key
# 或者使用用户名密码
ES_USERNAME=your-username
ES_PASSWORD=your-password
```

### 安全配置

```bash
# 如果使用自签名证书
ES_CA_CERT=/path/to/ca-cert.pem
# 或者跳过证书验证（不推荐生产环境）
NODE_TLS_REJECT_UNAUTHORIZED=0
```

## 使用方法

### 1. 启用服务器

在 NewmindChat 设置中启用 Elasticsearch 服务器，并配置连接参数。

### 2. 基本搜索

```
搜索所有包含 "error" 的日志
```

### 3. 聚合查询

```
显示过去24小时的错误统计
```

### 4. 索引管理

```
列出所有索引
创建新索引 "logs-2024"
```

## 常见用例

### 日志分析
- 搜索应用程序日志
- 分析错误模式
- 监控系统性能

### 数据探索
- 探索数据集结构
- 执行复杂查询
- 生成数据报告

### 监控和告警
- 检查集群健康
- 监控索引大小
- 设置性能阈值

## 故障排除

### 连接问题
- 验证 URL 和端口
- 检查网络连接
- 确认认证信息

### 权限问题
- 确保有足够的索引权限
- 检查 API 密钥权限
- 验证用户角色

### 性能问题
- 优化查询语句
- 调整超时设置
- 监控资源使用

## 最佳实践

- 使用适当的索引模式
- 优化查询性能
- 定期备份数据
- 监控集群健康
