# MCP Host 启动指南

本文档说明如何启动 MCP Host 服务。

## 前提条件

确保已完成构建步骤，参考 [BUILD.md](./BUILD.md)。

## 启动方式

MCP Host 提供三种使用方式：

1. **HTTP 服务**：提供 REST API 和 WebSocket
2. **命令行工具**：快速测试和交互
3. **Python 库**：在代码中直接使用

## 方式 1：HTTP 服务

### 启动服务

```bash
cd mcp-host
source .venv/bin/activate
attacktrace_httpd
```

### 服务信息

- **地址**: http://0.0.0.0:61990
- **健康检查**: http://localhost:61990/health
- **API 文档**: http://localhost:61990/docs

### 自定义端口

```bash
# 使用环境变量
export MCP_HOST_PORT=8080
attacktrace_httpd

# 或在 .env 文件中配置
MCP_HOST_PORT=8080
```

### 服务管理

```bash
# 查看服务状态
ps aux | grep attacktrace_httpd

# 停止服务
pkill -f attacktrace_httpd
```

## 方式 2：命令行工具

### 基本用法

```bash
# 简单对话
attacktrace_cli "你好，请介绍一下自己"

# 查看帮助
attacktrace_cli --help
```

### 会话管理

```bash
# 开始新会话
attacktrace_cli "什么是 MCP？"

# 继续会话（使用返回的 chat_id）
attacktrace_cli -c CHAT_ID "请详细说明"

# 指定用户
attacktrace_cli -u user123 "你好"
```

### 高级选项

```bash
# 指定模型
attacktrace_cli -m newmind-medium "分析这段代码"

# 流式输出
attacktrace_cli --stream "讲一个故事"

# 调试模式
attacktrace_cli --debug "测试消息"
```

## 方式 3：作为 Python 库

### 基本示例

```python
from attacktrace_mcp_host.host.conf import HostConfig
from attacktrace_mcp_host.host import AttackTraceMcpHost

# 初始化配置
config = HostConfig(
    model_name="newmind-medium",
    database_url="sqlite:///./mcp_host.db"
)

# 使用 async 上下文管理器
async with AttackTraceMcpHost(config) as host:
    # 开始或恢复对话
    async with host.chat(thread_id="123") as chat:
        # 发送查询并获取响应
        response = await chat.send("你好")
        print(response)
```

### 完整示例

查看 `doc/attacktrace_httpd.md` 获取更多示例。

## HTTP API 使用

### 创建会话

```bash
curl -X POST http://localhost:61990/chat/create \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user123"}'
```

### 发送消息

```bash
curl -X POST http://localhost:61990/chat/send \
  -H "Content-Type: application/json" \
  -d '{
    "thread_id": "THREAD_ID",
    "message": "你好"
  }'
```

### WebSocket 连接

```javascript
const ws = new WebSocket('ws://localhost:61990/ws/THREAD_ID');

ws.onmessage = (event) => {
  console.log('收到消息:', event.data);
};

ws.send(JSON.stringify({
  message: "你好",
  user_id: "user123"
}));
```

## 配置说明

### 模型配置

编辑 `model_config.json`：

```json
{
  "newmind-medium": {
    "type": "anthropic",
    "model": "claude-sonnet-4-5",
    "api_key": "${ANTHROPIC_API_KEY}",
    "temperature": 0.7
  }
}
```

### 插件配置

编辑 `plugin_config.json`：

```json
{
  "enabled_plugins": ["search", "calculator"],
  "plugin_settings": {
    "search": {
      "max_results": 10
    }
  }
}
```

### 环境变量

```env
# API 密钥
ANTHROPIC_API_KEY=your-key
OPENAI_API_KEY=your-key

# 服务配置
MCP_HOST_PORT=61990
LOG_LEVEL=INFO

# 数据库
DATABASE_URL=postgresql://user:pass@localhost/mcphost
```

## 日志管理

### 日志位置

- 控制台输出
- 日志文件：`logs/mcp_host.log`

### 日志级别

```bash
# 在 .env 中配置
LOG_LEVEL=DEBUG  # DEBUG, INFO, WARNING, ERROR
```

### 查看日志

```bash
# 实时查看
tail -f logs/mcp_host.log

# 搜索错误
grep ERROR logs/mcp_host.log
```

## 常见问题

### 端口被占用

修改端口配置：

```bash
export MCP_HOST_PORT=8080
attacktrace_httpd
```

### 数据库连接失败

检查数据库配置和连接：

```bash
# 测试 PostgreSQL 连接
psql -U user -d mcphost

# 或使用 SQLite
ls -la *.db
```

### 模型 API 调用失败

1. 检查 API 密钥配置
2. 验证网络连接
3. 查看日志获取详细错误

### 找不到命令

确保虚拟环境已激活：

```bash
source .venv/bin/activate
which attacktrace_httpd
```

## 监控和调试

### 健康检查

```bash
curl http://localhost:61990/health
```

### API 文档

访问 http://localhost:61990/docs 查看交互式 API 文档。

### 调试模式

```bash
LOG_LEVEL=DEBUG attacktrace_httpd
```

## 停止服务

### HTTP 服务

```bash
# 在终端按 Ctrl+C
# 或
pkill -f attacktrace_httpd
```

### 清理资源

```bash
# 关闭数据库连接
# 清理临时文件
rm -rf __pycache__
```

## 性能优化

### 数据库

- 使用 PostgreSQL 替代 SQLite
- 配置连接池
- 定期清理旧会话

### 缓存

- 启用模型响应缓存
- 配置 Redis 缓存（可选）

## 下一步

- 查看 [BUILD.md](./BUILD.md) 了解构建配置
- 查看 [README.md](./README.md) 了解项目架构
- 查看 `doc/attacktrace_httpd.md` 了解详细 API 文档


