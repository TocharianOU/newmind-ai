# 系统 Prompt 配置指南

本项目支持自定义系统 prompt，可以通过文件或环境变量两种方式配置。

## 🎯 快速开始

### 方法 1：使用文件（推荐）

1. **编辑 `system-prompt.txt` 文件**：
   ```bash
   nano system-prompt.txt
   ```

2. **写入你的 prompt 内容**：
   ```
   你是一个专业的 Elasticsearch 数据分析助手。
   
   核心能力：
   1. 集群管理和监控
   2. 数据查询和分析
   3. 性能优化建议
   
   工作流程：
   1. 理解用户需求
   2. 选择合适的工具
   3. 执行查询并分析结果
   ```

3. **重启服务**：
   ```bash
   ./docker-deploy.sh restart
   ```

### 方法 2：使用环境变量

1. **编辑 `.env` 文件**：
   ```bash
   nano .env
   ```

2. **修改 `DIVE_OVERRIDE_SYSTEM_PROMPT`**：
   ```bash
   DIVE_OVERRIDE_SYSTEM_PROMPT="你是一个专业的AI助手"
   ```

3. **重启服务**：
   ```bash
   ./docker-deploy.sh restart
   ```

## 📋 优先级规则

系统按以下优先级读取 prompt：

1. **文件方式**（最高优先级）：`system-prompt.txt`
2. **环境变量方式**：`.env` 中的 `DIVE_OVERRIDE_SYSTEM_PROMPT`
3. **无 prompt**：如果都未配置，则不使用自定义 prompt

## 🔧 高级配置

### 自定义文件路径

可以通过环境变量指定自定义的 prompt 文件位置：

```bash
# 在 .env 中添加
SYSTEM_PROMPT_FILE=/path/to/your/custom-prompt.txt
```

### 文件格式要求

- **编码**：UTF-8
- **换行**：支持任意格式（LF/CRLF）
- **长度**：无限制（建议不超过 100KB）
- **内容**：纯文本，支持 Markdown 格式

## ✅ 验证配置

### 检查文件是否被加载

```bash
# 查看容器中的文件
docker exec newmindhub-backend cat /app/system-prompt.txt

# 查看日志中的加载信息
docker-compose logs backend | grep "PROMPT"
```

### 测试 prompt 是否生效

发送一个 API 请求，检查响应中是否包含你的 prompt 特征。

## 📝 示例 Prompt

### 示例 1：Elasticsearch 分析助手

```
你是一个专业的 Elasticsearch 数据分析助手。

核心能力：
1. 集群管理：通过 MCP 工具查询索引、文档、分片状态
2. 数据分析：执行搜索、聚合、统计分析
3. 性能优化：监控集群健康、建议优化方案

环境信息：
- 集群：xiaopenges.tocharian.eu:9200
- 索引数：452
- 主要索引：es-*, logs-*, metrics-*

工作流程：
1. 理解用户需求
2. 选择合适的 MCP 工具
3. 执行查询并分析结果
4. 提供清晰的解释和建议

始终使用 MCP 工具获取实时数据，不要编造信息。
```

### 示例 2：代码助手

```
你是一个专业的编程助手，精通多种编程语言和框架。

工作原则：
1. 提供清晰、可维护的代码
2. 遵循最佳实践和设计模式
3. 详细解释代码逻辑
4. 考虑性能和安全性

专长领域：
- 后端：Node.js, Python, Go
- 前端：React, Vue, TypeScript
- 数据库：PostgreSQL, MongoDB, Elasticsearch
- DevOps：Docker, Kubernetes, CI/CD
```

## 🔄 更新 Prompt

### 热更新（无需重启）

**注意**：当前实现需要重启服务才能生效。

### 需要重启的情况

每次修改 `system-prompt.txt` 或 `.env` 后，都需要重启：

```bash
./docker-deploy.sh restart
```

## ⚠️ 注意事项

1. **文件大小**：虽然没有硬性限制，但建议 prompt 不超过 100KB，以避免影响性能
2. **特殊字符**：避免使用控制字符，建议使用纯文本
3. **编码格式**：必须使用 UTF-8 编码
4. **权限问题**：文件会以只读模式挂载到容器中（`:ro`）
5. **备份**：修改前建议备份原文件

## 🐛 故障排除

### Prompt 没有生效

1. **检查文件是否存在**：
   ```bash
   ls -la system-prompt.txt
   ```

2. **检查文件内容**：
   ```bash
   cat system-prompt.txt
   ```

3. **查看容器日志**：
   ```bash
   docker-compose logs backend | grep -i prompt
   ```

4. **验证文件挂载**：
   ```bash
   docker exec newmindhub-backend ls -la /app/system-prompt.txt
   ```

### 文件过大导致性能问题

如果 prompt 文件过大（>1MB），可能会影响性能。建议：

1. 精简内容，只保留核心指令
2. 将详细文档放到外部链接
3. 使用分层设计，按需提供信息

## 📚 相关文档

- [Docker 部署指南](./DOCKER.md)
- [API 文档](./API.md)
- [开发指南](./README.md)

## 💡 最佳实践

1. **版本控制**：将 `system-prompt.txt` 加入版本控制，便于团队协作
2. **环境隔离**：不同环境使用不同的 prompt 文件
3. **定期审查**：定期检查和优化 prompt 内容
4. **安全考虑**：不要在 prompt 中包含敏感信息（API 密钥、密码等）

---

**最后更新**：2025-10-10

