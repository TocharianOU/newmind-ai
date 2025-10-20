# 自定义 MCP 服务器

创建您自己的 MCP 服务器来扩展 NewmindChat 的功能。

## 什么是自定义 MCP 服务器？

自定义 MCP 服务器允许您：
- 连接特定的数据源
- 集成专有工具
- 创建自动化工作流
- 扩展 AI 能力

## 开发步骤

### 1. 了解 MCP 协议

按照 [MCP 协议规范](https://modelcontextprotocol.io) 开发您的服务器。

### 2. 选择开发语言

MCP 服务器可以用多种语言开发：
- **Node.js** - 推荐，与 NewmindChat 兼容性最好
- **Python** - 适合数据科学和机器学习
- **其他语言** - 任何支持 JSON-RPC 的语言

### 3. 实现服务器

```javascript
// 示例：简单的 Echo 服务器
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server(
  {
    name: "custom-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 添加工具
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "custom_tool",
      description: "自定义工具",
      inputSchema: {
        type: "object",
        properties: {
          input: { type: "string" }
        }
      }
    }
  ]
}));

// 处理工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  if (name === "custom_tool") {
    return {
      content: [
        {
          type: "text",
          text: `处理结果: ${args.input}`
        }
      ]
    };
  }
  
  throw new Error(`未知工具: ${name}`);
});
```

### 4. 配置服务器

在 `mcp_config.json` 中添加您的服务器：

```json
{
  "mcpServers": {
    "custom-server": {
      "enabled": true,
      "command": "node",
      "args": ["/path/to/your/server.js"],
      "env": {
        "API_KEY": "your-api-key"
      }
    }
  }
}
```

### 5. 测试和部署

1. 重启 NewmindChat
2. 检查服务器是否在设置中显示
3. 测试工具功能
4. 监控日志输出

## 最佳实践

- **错误处理**：实现完善的错误处理机制
- **日志记录**：添加详细的日志记录
- **文档**：为您的工具编写清晰的文档
- **测试**：编写单元测试和集成测试
- **性能**：优化响应时间和资源使用

## 示例项目

参考以下示例学习：
- [Echo 服务器](echo.md) - 基础示例
- [Kibana 服务器](kibana.md) - 数据可视化
- [Elasticsearch 服务器](elasticsearch.md) - 数据搜索

## 发布到 Hub

开发完成后，您可以：
1. 将服务器发布到 Hub 市场
2. 与其他用户分享
3. 获得社区反馈
4. 持续改进功能
