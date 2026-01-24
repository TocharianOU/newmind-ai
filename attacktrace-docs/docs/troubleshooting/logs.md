# 日志和调试

定位和解释日志文件以进行故障排除。

## 日志位置

### macOS
- **主日志**：`~/Library/Logs/AttackTrace/`
- **Host 日志**：`~/.attacktrace/log/host/`
- **MCP 服务器**：`~/.attacktrace/log/mcp/`

### Windows
- **主日志**：`%APPDATA%\AttackTrace\logs\`
- **Host 日志**：`%USERPROFILE%\.attacktrace\log\host\`
- **MCP 服务器**：`%USERPROFILE%\.attacktrace\log\mcp\`

### Linux
- **主日志**：`~/.config/AttackTrace/logs/`
- **Host 日志**：`~/.attacktrace/log/host/`
- **MCP 服务器**：`~/.attacktrace/log/mcp/`

## 查看日志

### macOS/Linux
```bash
# 主日志
tail -f ~/Library/Logs/AttackTrace/main.log

# Host 日志
tail -f ~/.attacktrace/log/host/dive_httpd.log

# MCP 服务器日志
tail -f ~/.attacktrace/log/mcp/echo.log
```

## 日志级别

- **ERROR**：关键问题
- **WARN**：潜在问题
- **INFO**：一般信息
- **DEBUG**：详细调试信息

## 启用调试模式

获取更详细的日志：

1. 转到设置 → 高级
2. 启用"调试模式"
3. 重启应用程序
4. 日志将包含 DEBUG 级别消息
