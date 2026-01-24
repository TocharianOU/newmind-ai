# Echo 服务器

Echo 服务器是一个简单的测试工具，默认启用。

## 用途

测试 MCP 连接性和工具调用，无需外部依赖。

## 配置

位置：`~/.newmind/scripts/mcp-server-echo/`

默认配置：
```json
{
  "echo": {
    "enabled": true,
    "command": "node",
    "args": ["~/.newmind/scripts/mcp-server-echo/dist/index.js"]
  }
}
```

## 使用

询问 AI：
```
使用 echo 工具重复"你好世界"
```

## 故障排除

如果 echo 不工作，检查[日志](../troubleshooting/logs.md)。
