# NewMind AI

NewMind AI 是面向业务团队的问数 Agent 平台。系统将数据、模型和 MCP 工具连接在一起，让用户可以用自然语言完成查询、分析、追踪和决策。客户部署时不绑定平台托管模型，通常由客户接入自己的模型服务和内部工具。

## 项目架构

整体架构由三部分组成：

```text
浏览器 / 桌面客户端
        |
        | /app/ 聊天应用，/console/ 管理控制台
        v
OAP Hub
  - 用户、组织、项目、权限和审计
  - 登录、SSO、License 和后台管理
  - 模型代理、MCP 工具代理、客户部署包下载
        |
        +--> PostgreSQL：账号、项目、会话、审计和计量数据
        |
        +--> MCP Host：工具编排、上下文处理和工具调用运行时
```

主要服务：

- `hub`：Node.js / Express / Prisma，提供 API、控制台、聊天应用和模型代理。
- `mcp-host`：Python / FastAPI，承载 MCP 工具和 Agent 工具链。
- `postgres`：PostgreSQL 16，保存业务配置和运行数据。
- `oaphub/frontend`：控制台和官网 Home 页面，基于 React / Vite。
- `src`：Web 聊天应用，构建后由 Hub 在 `/app/` 提供访问。

## 目录说明

```text
newmind-ai/
├── src/                         # Web 聊天应用
├── oaphub/
│   ├── src/                     # Hub 后端服务
│   ├── frontend/                # 控制台、Home、文档页
│   ├── prisma/                  # 数据库 schema 与迁移
│   ├── integrations/            # 集成配置
│   ├── Dockerfile
│   └── docker-compose.yml
├── mcp-host/                    # MCP Host 服务
├── elasticsearch-mcp/           # Elasticsearch MCP 工具服务
├── scripts/                     # 构建和客户交付包脚本
└── public/                      # 静态资源
```

## 本地开发

安装依赖后，可以分别启动前端和服务端开发流程。实际部署以 Docker / Kubernetes 为准。

```bash
npm install

cd oaphub
npm install

cd frontend
npm install
npm run build
```

常用入口：

- `http://<host>:23000/`：官网 Home 页面。
- `http://<host>:23000/app/`：问数 Agent 应用。
- `http://<host>:23000/console/`：管理控制台。
- `http://<host>:23000/console/documentation`：部署与配置文档。
- `http://<host>:23000/api/health`：健康检查。

## Docker 部署

Docker Compose 适合单机、PoC、内网测试和小规模私有化部署。

1. 配置环境变量：

```bash
cd oaphub
cp .env.example .env  # 如果包内已提供 .env，可直接编辑
```

至少需要确认以下配置：

```env
POSTGRES_PASSWORD=replace_with_secure_password
JWT_SECRET=replace_with_random_secret
OAP_AUTH_TOKEN=replace_with_random_token
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=replace_with_admin_password
ALLOWED_ORIGINS=https://your-domain.example
HUB_FRONTEND_URL=https://your-domain.example
DEPLOYMENT_MODE=enterprise
```

2. 启动服务：

```bash
docker compose build
docker compose up -d
```

3. 检查状态：

```bash
docker compose ps
curl http://localhost:23000/api/health
```

升级时通常只需要替换镜像或重新构建镜像，然后执行：

```bash
docker compose up -d
```

数据库和 MCP 运行数据应通过 volume 持久化，不要在生产环境随意执行 `docker compose down -v`。

## Kubernetes 部署

Kubernetes 部署适合正式集群环境。客户交付包中会包含镜像包、manifest、部署说明和更新说明。一般流程如下：

```bash
tar -xzf oaphub-kubernetes-standard.tar.gz
cd oaphub-kubernetes-package

# 将镜像导入目标集群或镜像仓库
# 按实际域名、StorageClass、Secret 修改 manifests
kubectl apply -f kubernetes/
kubectl get pods -n oaphub
```

生产环境需要重点确认：

- 数据库、上传目录和 MCP 数据目录已挂载持久化存储。
- Secret 中的密码、Token 和管理员密码已经替换。
- Ingress、TLS、域名和跨域配置与实际访问地址一致。
- 升级前已备份数据库和关键 volume。

## 模型与 MCP 配置

客户部署默认不要求使用平台内置模型。通常由客户在控制台中接入自己的模型供应商，例如企业内部网关、私有化大模型服务或兼容 OpenAI API 的模型服务。

MCP 工具可按业务场景单独部署，例如 Elasticsearch、数据库、日志系统、工单系统或内部知识库。Hub 负责鉴权和代理，MCP Host 负责工具编排和上下文处理。新增工具时，应优先在内网完成连通性和权限验证，再开放给业务用户使用。

## 客户交付包

客户部署包由脚本生成：

```bash
bash scripts/build-customer-release.sh --kind docker --arch x86_64
bash scripts/build-customer-release.sh --kind kubernetes
```

生成结果位于 `oaphub/downloads/`，通常包括：

- Docker 或 Kubernetes 部署包。
- `DEPLOY.md`：新部署说明。
- `UPDATE.md`：升级和回滚说明。
- `install.sh`：快速安装脚本。
- `.env` 或 `.env.example`：需要客户按实际环境修改。

大体原则是：源码、脚本和部署说明进入 Git；镜像包、压缩包、临时构建目录和客户交付产物不进入 Git。

## 维护说明

- 提交前检查 `.gitignore`，避免把镜像、压缩包、密钥和本地环境文件提交。
- 生产配置中的密码、Token、SSO Secret 和模型 API Key 不应写入仓库。
- 对外文档保持简洁，部署包内的 `DEPLOY.md` 和 `UPDATE.md` 用于承载更具体的安装步骤。
- 重要升级先在测试环境验证，再更新客户交付包。

## License

Proprietary - Copyright 2025 NewMind AI. All rights reserved.
