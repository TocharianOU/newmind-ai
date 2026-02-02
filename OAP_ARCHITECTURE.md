# OAP Platform 架构说明

## 概述

**OAP (Operations & Analytics Platform)** 是 AttackTrace 的云端服务平台，为 SOC 团队提供运营与分析能力。

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                    AttackTrace Desktop                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  AI Chat    │  │  MCP Tools  │  │  Evidence   │         │
│  │  Interface  │  │  Manager    │  │  Chain      │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│         │                  │                 │               │
│         └──────────────────┴─────────────────┘               │
│                            │                                  │
│                     ┌──────▼──────┐                          │
│                     │  MCP Host   │                          │
│                     │  (Python)   │                          │
│                     └──────┬──────┘                          │
└────────────────────────────┼────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │   OAP Plugin    │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
    ┌────▼─────┐      ┌─────▼──────┐     ┌─────▼──────┐
    │   Auth   │      │   Model    │     │    MCP     │
    │  Service │      │   Proxy    │     │ Marketplace│
    └────┬─────┘      └─────┬──────┘     └─────┬──────┘
         │                  │                   │
         └──────────────────┼───────────────────┘
                            │
                   ┌────────▼────────┐
                   │  OAP Platform   │
                   │  (Node.js API)  │
                   └────────┬────────┘
                            │
         ┌──────────────────┼──────────────────┐
         │                  │                  │
    ┌────▼─────┐      ┌────▼─────┐     ┌─────▼──────┐
    │PostgreSQL│      │  Stripe  │     │  Storage   │
    │ Database │      │  Billing │     │  Service   │
    └──────────┘      └──────────┘     └────────────┘
```

## 核心组件

### 1. AttackTrace Desktop
- **技术栈**：Electron + React + TypeScript
- **职责**：
  - 用户交互界面
  - 本地数据存储
  - MCP 工具编排
  - 证据链管理

### 2. MCP Host
- **技术栈**：Python + FastAPI + LangChain
- **职责**：
  - MCP 服务器管理
  - AI 模型调用
  - 工具编排与执行
  - 会话状态管理

### 3. OAP Plugin
- **技术栈**：Python
- **职责**：
  - 连接 MCP Host 和 OAP Platform
  - 用户认证集成
  - 模型服务路由
  - MCP 工具同步

### 4. OAP Platform
- **技术栈**：Node.js + Express + PostgreSQL
- **职责**：
  - 用户认证与授权
  - 订阅与计费管理
  - MCP 工具市场
  - 使用统计与分析

## 数据流

### 用户登录流程
```
User → Desktop → OAP Auth API → JWT Token → Store in Desktop
                                              ↓
                                         Sync to MCP Host
                                              ↓
                                      OAP Plugin Authenticated
```

### AI 对话流程
```
User Input → Desktop → MCP Host → OAP Plugin → OAP Model Proxy
                                                       ↓
                                              External AI Provider
                                                       ↓
                                              Response Stream
                                                       ↓
User ← Desktop ← MCP Host ← OAP Plugin ← Model Proxy ←┘
```

### MCP 工具安装流程
```
User → Desktop → Browse Marketplace → Select Tool
                                          ↓
                                  OAP Platform API
                                          ↓
                            Download Tool Package
                                          ↓
                              Install to MCP Host
                                          ↓
                          Sync Config to Desktop
                                          ↓
                                    Tool Ready
```

## 安全设计

### 认证与授权
- **JWT Token**：用于 Desktop ↔ OAP 通信
- **OAuth 2.0**：支持第三方登录（Google、GitHub 等）
- **RBAC**：基于角色的访问控制

### 数据安全
- **本地优先**：敏感数据默认本地存储
- **加密传输**：所有网络通信使用 HTTPS/WSS
- **审计日志**：完整记录用户操作

### 隐私保护
- **最小权限**：OAP 仅访问必要的用户数据
- **可选同步**：用户可选择是否启用云端同步
- **数据删除**：支持完全删除用户数据

## 扩展性

### 水平扩展
- OAP Platform 无状态设计，支持负载均衡
- PostgreSQL 支持主从复制和读写分离
- 模型代理支持多后端负载均衡

### 插件化架构
- MCP 工具采用标准协议，易于扩展
- OAP Plugin 提供扩展点
- 支持自定义模型提供商

## 部署模式

### 云端部署（推荐）
- OAP Platform 部署在云端
- 用户使用 Desktop 连接云端服务
- 适合：个人用户、小型团队

### 私有部署
- 完整的 AttackTrace + OAP 部署在企业内网
- 完全离线运行
- 适合：大型企业、高安全要求场景

### 混合部署
- Desktop 和 MCP Host 本地部署
- OAP Platform 使用云端服务
- 适合：数据敏感但需要云端功能的场景

## 性能指标

### OAP Platform
- API 响应时间：< 100ms (P95)
- 并发用户：10,000+
- 模型代理延迟：< 50ms

### MCP Host
- 工具执行延迟：< 200ms
- 并发会话：100+
- 内存占用：< 1GB

## 监控与运维

### 日志
- 应用日志：Winston / Python logging
- 审计日志：PostgreSQL
- 访问日志：Nginx

### 指标
- 用户活跃度
- Token 使用量
- API 调用统计
- 错误率与延迟

### 告警
- 服务健康检查
- 数据库性能监控
- 异常使用检测

## 未来规划

### 短期（Q1-Q2 2026）
- [ ] 支持更多 AI 模型提供商
- [ ] 增强团队协作功能
- [ ] 移动端支持

### 中期（Q3-Q4 2026）
- [ ] 企业级 SSO 集成
- [ ] 高级分析与报表
- [ ] API 开放平台

### 长期（2027+）
- [ ] 多租户 SaaS 架构
- [ ] 边缘计算支持
- [ ] AI 模型训练平台

## 相关文档

- [README.md](./README.md) - 项目总览
- [AttackTraceHub/README.md](./AttackTraceHub/README.md) - OAP Platform 详细文档
- [mcp-host/README.md](./mcp-host/README.md) - MCP Host 文档
- [PRODUCT_BRIEF.md](./PRODUCT_BRIEF.md) - 产品定位

## 联系我们

如有问题或建议，请通过以下方式联系：

- **GitHub Issues**: [提交问题](https://github.com/yourusername/attacktrace/issues)
- **官网**: http://xiaopenges.tocharian.eu:23001/
- **文档**: http://localhost:8002（本地）
