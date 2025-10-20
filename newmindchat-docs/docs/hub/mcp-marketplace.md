# MCP 市场

## 概述

MCP（Model Context Protocol）市场提供预配置的服务器，扩展 AI 模型的能力，支持数据访问、工具集成和企业系统连接。

## 访问市场

1. [登录 Hub](login.md)
2. 打开 NewmindChat 应用
3. 进入 **工具** > **MCP 市场**

## 服务器分类

- 数据分析: Kibana, Elasticsearch
- 开发工具: Git, CI/CD
- 生产力: 日历, 邮件, 任务管理
- 企业集成: CRM, ERP 系统

## 安装 MCP 服务器

### 一键安装

1. 在市场中找到想要的服务器
2. 点击 **安装**
3. 系统会自动：
   - 下载服务器文件
   - 配置依赖
   - 添加到 MCP 配置
4. 安装完成后立即可用

### 配置服务器

某些服务器需要配置：

1. 安装后，点击 **配置**
2. 填写必要信息：
   - API 密钥
   - 服务器地址
   - 认证信息
3. 保存配置
4. 启用服务器

## 推荐服务器

### Kibana MCP Server

**功能**: 连接和查询 Kibana 数据

- 搜索和聚合
- 可视化数据
- 管理 dashboards
- 查询日志

[查看配置指南](../mcp-servers/kibana.md)

### Elasticsearch MCP Server

**功能**: 直接查询 Elasticsearch

- 索引管理
- 数据搜索
- 聚合分析
- 集群监控

[查看配置指南](../mcp-servers/elasticsearch.md)

### GitHub MCP Server

**功能**: GitHub 集成

- 仓库管理
- Issue 和 PR 操作
- 代码搜索
- Workflow 触发

### Slack MCP Server

**功能**: Slack 集成

- 发送消息
- 创建频道
- 管理用户
- 读取历史消息

## 管理已安装的服务器

### 查看已安装

1. 进入 **设置** > **MCP 服务器**
2. 查看所有已安装的服务器及运行状态

### 启用/禁用

快速切换服务器状态：

1. 找到目标服务器
2. 点击开关按钮
3. 禁用后，服务器会停止运行
4. 启用后，服务器会自动启动

### 更新服务器

当有新版本可用时：

1. 市场会显示更新提示
2. 点击 **更新**
3. 自动下载并应用更新
4. 无需重启应用

### 卸载服务器

1. 进入 **设置** > **MCP 服务器**
2. 找到要卸载的服务器
3. 点击 **卸载**
4. 确认操作
5. 配置和数据会被移除

## 本地服务器

如需完全控制和自定义配置，可使用本地服务器。了解如何配置[自定义 MCP 服务器](../mcp-servers/custom.md)。

## 安全说明

- 服务器在本地运行
- API 密钥仅本地存储
- 遵循最小权限原则

## 下一步

- 配置 [Kibana 服务器](../mcp-servers/kibana.md)
- 配置 [Elasticsearch 服务器](../mcp-servers/elasticsearch.md)
- 创建 [自定义服务器](../mcp-servers/custom.md)
- 了解 [订阅计划](subscription.md)

