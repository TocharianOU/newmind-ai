#!/bin/bash

# Features
cat > docs/zh/features/index.md << 'DOC'
# 功能介绍

AttackTrace 提供强大的 AI 对话和工具集成功能。

## 主要功能

- [聊天界面](chat.md) - 现代化的对话体验
- [模型管理](models.md) - Hub 和自定义模型
- [MCP 工具](mcp-tools.md) - 扩展 AI 能力
- [对话历史](history.md) - 管理历史对话

## 快速开始

1. [下载安装](../getting-started/download.md) AttackTrace
2. [首次对话](../getting-started/first-chat.md)
3. 探索 [Hub 模型](../hub/models.md)
4. 启用 [MCP 工具](mcp-tools.md)
DOC

cat > docs/zh/features/chat.md << 'DOC'
# 聊天界面

## 界面布局

AttackTrace 提供简洁高效的聊天界面。

## 主要功能

- 多会话管理
- Markdown 渲染
- 代码高亮
- 快捷键支持

## 使用技巧

1. **新建对话**: Cmd/Ctrl + N
2. **切换会话**: Cmd/Ctrl + Tab
3. **清空对话**: Cmd/Ctrl + Shift + K

详见[模型管理](models.md)和 [MCP 工具](mcp-tools.md)。
DOC

cat > docs/zh/features/models.md << 'DOC'
# 模型管理

## Hub 模型

使用 [Hub 模型](../hub/models.md)无需配置 API 密钥。

## 自定义模型

添加自己的 OpenAI 兼容 API：

1. 进入 **设置** > **模型**
2. 点击 **添加自定义模型**
3. 填写 API 端点和密钥
4. 保存

详见[模型配置](../configuration/model-config.md)。
DOC

cat > docs/zh/features/mcp-tools.md << 'DOC'
# MCP 工具

## 什么是 MCP？

Model Context Protocol (MCP) 为 AI 模型提供工具和数据访问能力。

## 可用工具

根据启用的 MCP 服务器，您可以：

- 查询 Elasticsearch 数据
- 访问 Kibana dashboards
- 使用自定义工具

## 启用工具

1. 安装 [MCP 服务器](../mcp-servers/index.md)
2. 在对话中使用工具
3. 模型会自动调用合适的工具

详见 [MCP 市场](../hub/mcp-marketplace.md)。
DOC

cat > docs/zh/features/history.md << 'DOC'
# 对话历史

## 查看历史

所有对话自动保存在本地。

## 功能

- 搜索对话
- 按日期筛选
- 导出对话
- 删除对话

## 数据位置

- macOS: `~/Library/Application Support/AttackTrace/`
- Windows: `%APPDATA%/AttackTrace/`
- Linux: `~/.config/AttackTrace/`
DOC

# Configuration
cat > docs/zh/configuration/mcp-config.md << 'DOC'
# MCP 配置

## 配置文件

位置: `~/.newmind/config/mcp_config.json`

## 结构

```json
{
  "mcpServers": {
    "echo": {
      "enabled": true,
      "command": "node",
      "args": ["~/.newmind/scripts/mcp-server-echo/dist/index.js"]
    }
  }
}
```

详见 [MCP 服务器](../mcp-servers/index.md)。
DOC

cat > docs/zh/configuration/model-config.md << 'DOC'
# 模型配置

## 添加自定义模型

1. 进入 **设置** > **模型**
2. 点击 **添加模型**
3. 配置:
   - 名称
   - API 端点
   - API 密钥
   - 模型参数

## 支持的 API

- OpenAI
- Azure OpenAI
- 任何 OpenAI 兼容 API

详见[模型管理](../features/models.md)。
DOC

cat > docs/zh/configuration/settings.md << 'DOC'
# 应用设置

## 通用设置

- 主题（亮色/暗色）
- 语言
- 启动选项

## 网络设置

- HTTP 代理
- HTTPS 代理
- 代理认证

## 高级设置

- 日志级别
- 调试模式
- 性能优化

详见[故障排除](../troubleshooting/index.md)。
DOC

# MCP Servers
cat > docs/zh/mcp-servers/kibana.md << 'DOC'
# Kibana MCP Server

## 功能

连接和查询 Kibana 数据。

## 配置

1. 安装 Kibana 服务器
2. 配置环境变量:
   - `KIBANA_URL`
   - `KIBANA_USERNAME`
   - `KIBANA_PASSWORD`
3. 启用服务器

详见[英文文档](../../mcp-servers/kibana.md)。
DOC

cat > docs/zh/mcp-servers/elasticsearch.md << 'DOC'
# Elasticsearch MCP Server

## 功能

直接查询 Elasticsearch 数据。

## 配置

1. 安装 Elasticsearch 服务器
2. 配置环境变量:
   - `ES_URL`
   - `ES_API_KEY` 或 `ES_USERNAME`/`ES_PASSWORD`
3. 启用服务器

详见[英文文档](../../mcp-servers/elasticsearch.md)。
DOC

cat > docs/zh/mcp-servers/custom.md << 'DOC'
# 自定义 MCP 服务器

## 创建自定义服务器

按照 [MCP 协议规范](https://modelcontextprotocol.io) 开发。

## 配置

1. 开发服务器
2. 添加到 `mcp_config.json`
3. 重启应用

## 示例

参考 [Echo 服务器](echo.md)源代码。

详见[英文文档](../../mcp-servers/custom.md)。
DOC

# Troubleshooting
cat > docs/zh/troubleshooting/connection-errors.md << 'DOC'
# 连接错误

## MCP 服务器连接失败

检查:
1. 服务器配置
2. 环境变量
3. 网络连接
4. 防火墙设置

## Hub 连接失败

检查:
1. 网络连接
2. 代理设置
3. Hub 状态

## Python 后端启动失败

查看[日志](logs.md)了解详情。

详见[常见问题](common-issues.md)。
DOC

echo "✅ 所有中文文档已创建"
