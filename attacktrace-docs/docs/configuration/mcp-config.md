# MCP 配置

MCP（模型上下文协议）配置允许您管理连接到 AttackTrace 的 MCP 服务器。

## 配置文件位置

MCP 配置文件位于：
- **macOS/Linux**: `~/.attacktrace/config/mcp_config.json`
- **Windows**: `%USERPROFILE%\.attacktrace\config\mcp_config.json`

## 配置文件结构

### 基本结构

```json
{
  "mcpServers": {
    "server-name": {
      "enabled": true,
      "command": "node",
      "args": ["path/to/server.js"],
      "env": {
        "ENV_VAR": "value"
      }
    }
  }
}
```

### 配置参数说明

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `enabled` | boolean | 是 | 是否启用服务器 |
| `command` | string | 是 | 启动命令（如 node, python） |
| `args` | array | 是 | 命令参数 |
| `env` | object | 否 | 环境变量 |
| `cwd` | string | 否 | 工作目录 |

## 内置服务器配置

### Echo 服务器

```json
{
  "echo": {
    "enabled": true,
    "command": "node",
    "args": ["~/.attacktrace/scripts/mcp-server-echo/dist/index.js"]
  }
}
```

### Kibana 服务器

```json
{
  "kibana": {
    "enabled": false,
    "command": "node",
    "args": ["~/.attacktrace/scripts/mcp-server-kibana/dist/index.js"],
    "env": {
      "KIBANA_URL": "https://your-kibana.com:5601",
      "KIBANA_USERNAME": "your-username",
      "KIBANA_PASSWORD": "your-password"
    }
  }
}
```

### Elasticsearch 服务器

```json
{
  "elasticsearch": {
    "enabled": false,
    "command": "node",
    "args": ["~/.attacktrace/scripts/mcp-server-elasticsearch/dist/index.js"],
    "env": {
      "ES_URL": "https://your-elasticsearch.com:9200",
      "ES_API_KEY": "your-api-key"
    }
  }
}
```

## 自定义服务器配置

### 添加新服务器

1. 在 `mcpServers` 对象中添加新条目
2. 设置 `enabled: true`
3. 配置 `command` 和 `args`
4. 添加必要的环境变量

```json
{
  "mcpServers": {
    "my-custom-server": {
      "enabled": true,
      "command": "python",
      "args": ["/path/to/my_server.py"],
      "env": {
        "API_KEY": "your-api-key",
        "DEBUG": "true"
      }
    }
  }
}
```

### 环境变量

环境变量用于向 MCP 服务器传递配置信息：

```json
{
  "env": {
    "DATABASE_URL": "postgresql://user:pass@localhost/db",
    "API_ENDPOINT": "https://api.example.com",
    "LOG_LEVEL": "info"
  }
}
```

## 配置管理

### 通过界面配置

1. 打开 AttackTrace 设置
2. 导航到 "MCP 服务器" 部分
3. 启用/禁用服务器
4. 配置连接参数
5. 保存设置

### 手动编辑配置

1. 停止 AttackTrace
2. 编辑 `mcp_config.json` 文件
3. 保存文件
4. 重启 AttackTrace

### 配置验证

AttackTrace 会在启动时验证配置：
- 检查服务器路径是否存在
- 验证环境变量格式
- 测试服务器连接

## 故障排除

### 常见问题

**服务器无法启动**
- 检查命令路径是否正确
- 验证环境变量设置
- 查看应用日志

**权限问题**
- 确保有执行权限
- 检查文件路径权限
- 验证环境变量访问

**连接失败**
- 验证网络连接
- 检查服务器状态
- 确认认证信息

### 调试技巧

1. **启用调试模式**：设置 `DEBUG=true` 环境变量
2. **查看日志**：检查应用日志文件
3. **测试连接**：手动运行服务器命令
4. **验证配置**：使用配置验证工具

## 最佳实践

- **备份配置**：定期备份配置文件
- **版本控制**：使用版本控制管理配置
- **安全存储**：安全存储敏感信息
- **定期更新**：保持服务器版本最新
- **监控性能**：监控服务器性能指标
