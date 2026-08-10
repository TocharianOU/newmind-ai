# NewMind AI

NewMind AI 是面向业务团队的问数 Agent 平台（3.0 起为纯 Web 架构）。系统将数据、模型和 MCP 工具连接在一起，让用户用自然语言完成查询、分析、追踪和决策。客户部署不绑定平台托管模型，通常接入客户自己的模型服务和内部工具。

## 架构

```text
浏览器
   |  /app/ 聊天应用   /console/ 管理控制台   /  官网 Home
   v
OAP Hub (Node.js / Express / Prisma)
  - 用户、项目、权限、审计、License、模型代理、下载分发
   |
   +--> PostgreSQL 16     账号、项目、会话、审计数据
   +--> MCP Host (Python) 工具编排与调用运行时
```

```text
newmind-ai/
├── src/                # Web 聊天应用（React，构建后由 Hub 挂在 /app/）
├── oaphub/
│   ├── src/            # Hub 后端
│   ├── frontend/       # 控制台 + 官网 Home + 文档页
│   ├── prisma/         # 数据库 schema 与迁移
│   ├── env.copy        # 部署配置模板
│   ├── deploy.sh       # 一键部署脚本
│   └── build-package.sh# 客户离线包打包脚本
├── mcp-host/           # MCP Host 服务
└── public/             # 静态资源
```

## 部署（一键）

```bash
cd oaphub
bash deploy.sh
```

脚本自动完成：从 `env.copy` 生成 `.env`（随机生成密钥）、创建数据卷、构建镜像、启动并等待就绪。详见 [oaphub/DEPLOY.md](oaphub/DEPLOY.md)。

完成后访问：

- `http://localhost:23000/` 官网 Home（客户下载门户）
- `http://localhost:23000/app/` 聊天应用
- `http://localhost:23000/console/` 管理控制台
- `http://localhost:23000/api/health` 健康检查

常用命令：`bash deploy.sh --logs` 看日志，`bash deploy.sh --stop` 停止。

## 配置要点

配置集中在 `oaphub/.env`（模板 `env.copy`）。生产/公网部署至少确认：

```env
POSTGRES_PASSWORD / ADMIN_PASSWORD   # 改掉默认密码
JWT_SECRET / OAP_AUTH_TOKEN          # deploy.sh 已随机生成
ALLOWED_ORIGINS=https://你的域名      # 公网必须显式配置
FORCE_HTTPS=true                     # 配合反代 TLS
INVITE_CODE_ENABLED=true             # 公网建议开启注册邀请码
INVITE_CODES=hellonewmind            # 注册/下载邀请码（逗号分隔多个）
```

## 客户交付包

```bash
cd oaphub
bash build-package.sh
```

产出 `oaphub/downloads/oaphub-docker-<arch>.tar.gz`（预构建镜像 + 离线 compose + install.sh + 配置模板），官网 Home 页会自动检测该目录并展示下载入口（凭邀请码下载）。发布到线上服务器：`scp downloads/*.tar.gz* 服务器:oaphub/downloads/`。

客户侧安装：解压后 `bash install.sh`。

x86_64 包需在 x86_64 机器上执行同一脚本。

## 模型与 MCP

模型在控制台接入（企业内部网关、私有化大模型或 OpenAI 兼容服务均可）。MCP 工具按场景单独部署（Elasticsearch、知识库、日志系统等），Hub 负责鉴权代理，MCP Host 负责编排。文档检索结果中的 `<document_card>` 由前端直接从工具结果渲染，不占用模型 prompt。

## 维护

- 密码、Token、模型 API Key 不入仓库；镜像包和交付产物不入 Git（见 `.gitignore`）
- 重要升级先在测试环境验证，再更新客户交付包
- 生产环境勿随意执行 `docker compose down -v`（会删数据卷）

## License

Proprietary - Copyright 2026 NewMind AI. All rights reserved.
