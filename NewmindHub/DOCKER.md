# NewmindHub Docker部署

NewmindHub平台的Docker部署指南。Chat Electron应用将连接到这个Hub平台。

## 快速开始

### 本地开发环境

```bash
# 1. 配置环境（如果还没有.env文件）
cp env.docker.example .env

# 2. 编辑 .env，确保配置正确
nano .env
# PUBLIC_WEBHOOK_URL=http://localhost:23000  # 本地开发

# 3. 启动服务
./docker-deploy.sh up

# 4. 运行数据库迁移
./docker-deploy.sh migrate

# 5. 访问
# Web管理界面: http://localhost:23001
# API服务: http://localhost:23000
```

### 云环境部署

```bash
# 1. 配置环境
cp env.docker.example .env

# 2. **重要**: 编辑 .env，配置公网地址
nano .env
# 必须修改以下配置:
# PUBLIC_WEBHOOK_URL=https://your-domain.com  # 你的公网域名或IP
# STRIPE_WEBHOOK_SECRET=whsec_从Stripe_Dashboard获取

# 3. 启动服务
./docker-deploy.sh up

# 4. 运行数据库迁移
./docker-deploy.sh migrate

# 5. 在 Stripe Dashboard 配置 Webhook
# URL: https://your-domain.com/api/v1/payment/webhook
# 参考: STRIPE_WEBHOOK_SETUP.md
```

## 架构

```
Chat Electron应用
  ↓ (连接)
  ├─ Frontend :3001 (Web管理界面 - 用户管理、Dashboard、设置)
  └─ Backend  :3000 (API服务 - AI代理、认证、MCP等)
       ↓
   PostgreSQL :5432 (数据库)
```

## Chat应用配置

在Chat Electron中配置：
- **NewmindHub URL**: `http://your-server-ip:3001`
- **Backend API URL**: `http://your-server-ip:3000`

如果在本机测试：
- NewmindHub URL: `http://localhost:3001`
- Backend API URL: `http://localhost:3000`

## 管理命令

```bash
# 启动服务
./docker-deploy.sh up

# 停止服务
./docker-deploy.sh down

# 查看所有日志
./docker-deploy.sh logs

# 查看特定服务日志
./docker-deploy.sh logs backend
./docker-deploy.sh logs frontend
./docker-deploy.sh logs postgres

# 重新构建（代码更新后）
./docker-deploy.sh rebuild

# 运行数据库迁移
./docker-deploy.sh migrate

# 重启后端服务（更新.env配置后）
./docker-deploy.sh restart
```

## 环境变量

`.env`文件的关键配置：

### 基础配置

```env
# 数据库密码（请修改）
POSTGRES_PASSWORD=your_secure_password

# JWT密钥（请修改）
JWT_SECRET=your_secret_key

# Anthropic API密钥
ANTHROPIC_API_KEY=your_api_key

# 端口配置
BACKEND_PORT=23000
FRONTEND_PORT=23001
```

### CORS配置

```env
# CORS配置（允许Chat应用访问）
# 本地开发：localhost origins + file:// (Chat Electron)
ALLOWED_ORIGINS=http://localhost:23001,http://localhost:5173,file://,tauri://localhost

# 生产环境：添加服务器IP/域名
# ALLOWED_ORIGINS=https://your-domain.com,file://,tauri://localhost
```

### Stripe Webhook 配置（重要）

```env
# Stripe 密钥
STRIPE_SECRET_KEY=sk_test_xxxxx  # 生产环境使用 sk_live_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx

# Webhook Secret（从 Stripe Dashboard 获取）
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# 公网访问地址（云环境必须配置）
# 本地开发:
PUBLIC_WEBHOOK_URL=http://localhost:23000

# 云环境（使用域名 - 推荐）:
# PUBLIC_WEBHOOK_URL=https://hub.yourdomain.com

# 云环境（使用 IP + 端口）:
# PUBLIC_WEBHOOK_URL=http://your-server-ip:23000
```

**Stripe Dashboard 配置**:
- Webhook URL: `${PUBLIC_WEBHOOK_URL}/api/v1/payment/webhook`
- 详细配置步骤请查看: `STRIPE_WEBHOOK_SETUP.md`

## 服务说明

| 服务 | 端口 | 说明 |
|------|------|------|
| Frontend | 3001 | Web管理界面（React + Nginx） |
| Backend | 3000 | API服务（Node.js + Express） |
| PostgreSQL | 5432 | 数据库（内部） |

## CORS配置说明

Chat Electron应用需要访问Hub后端API，必须正确配置CORS。

**本地开发**（Chat应用和Hub在同一台机器）：
```env
ALLOWED_ORIGINS=http://localhost:3001,http://localhost:5173,file://,tauri://localhost
```

**远程部署**（Chat应用连接到远程服务器）：
```env
# 添加服务器的IP/域名
ALLOWED_ORIGINS=http://your-server-ip:3001,http://your-server-ip:3000,file://,tauri://localhost

# 或使用域名
ALLOWED_ORIGINS=https://hub.yourdomain.com,file://,tauri://localhost
```

**包含的origins说明**：
- `http://localhost:3001` - Hub Web前端
- `http://localhost:5173` - 开发环境
- `file://` - Chat Electron应用（file协议）
- `tauri://localhost` - Tauri应用协议

## 故障排除

**端口被占用**
```bash
# 修改.env中的端口
BACKEND_PORT=3100
FRONTEND_PORT=3101
```

**查看服务状态**
```bash
docker-compose ps
```

**查看详细日志**
```bash
./docker-deploy.sh logs backend
./docker-deploy.sh logs postgres
```

**重启服务**
```bash
./docker-deploy.sh down
./docker-deploy.sh up
```

**清理重建**
```bash
./docker-deploy.sh rebuild
```

**进入容器调试**
```bash
docker-compose exec backend sh
docker-compose exec postgres psql -U postgres -d newmindhub_auth
```

## 数据持久化

数据保存在Docker volume中：
- `postgres_data` - 数据库文件
- `./logs` - 应用日志

## 生产部署建议

1. **修改密码和密钥**
   - 更改`POSTGRES_PASSWORD`为强密码
   - 使用强`JWT_SECRET`（至少32字符随机字符串）
   - 生产环境使用 `STRIPE_SECRET_KEY` 以 `sk_live_` 开头

2. **配置公网访问**
   - 设置 `PUBLIC_WEBHOOK_URL` 为你的域名或公网IP
   - 示例: `PUBLIC_WEBHOOK_URL=https://hub.yourdomain.com`

3. **配置 Stripe Webhook**
   - 在 Stripe Dashboard 添加 webhook endpoint
   - URL: `https://your-domain.com/api/v1/payment/webhook`
   - 获取并配置真实的 `STRIPE_WEBHOOK_SECRET`
   - **详细步骤**: 查看 `STRIPE_WEBHOOK_SETUP.md`

4. **配置防火墙**
   ```bash
   # 如果直接暴露端口
   sudo ufw allow 23000/tcp
   sudo ufw allow 23001/tcp
   
   # 推荐：使用 Nginx，只开放 80/443
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   ```

5. **HTTPS配置（强烈推荐）**
   - 使用Nginx反向代理
   - 配置SSL证书（Let's Encrypt）
   - 参考 `STRIPE_WEBHOOK_SETUP.md` 中的 Nginx 配置

6. **备份数据库**
   ```bash
   docker-compose exec postgres pg_dump -U postgres newmindhub_auth > backup.sql
   ```

7. **监控日志**
   ```bash
   # 实时查看所有日志
   ./docker-deploy.sh logs
   
   # 查看错误日志
   ./docker-deploy.sh logs backend | grep -i error
   
   # 查看 Stripe webhook 日志
   ./docker-deploy.sh logs backend | grep -i webhook
   ```

## 更新应用

```bash
# 1. 拉取最新代码
git pull

# 2. 重新构建
./docker-deploy.sh rebuild

# 3. 运行迁移（如有）
./docker-deploy.sh migrate
```

## 更新系统 Prompt

### 方法 1：使用文件（推荐，支持超长 prompt）

系统会自动读取项目根目录下的 `system-prompt.txt` 文件作为系统 prompt。

```bash
# 1. 编辑 prompt 文件
nano system-prompt.txt  # 或使用你喜欢的编辑器

# 2. 写入你的 prompt 内容（支持多行，无长度限制）
# 例如：
cat > system-prompt.txt << 'EOF'
你是一个专业的 Elasticsearch 数据分析助手。

核心能力：
1. 集群管理和监控
2. 数据查询和分析
3. 性能优化建议
EOF

# 3. 重启后端服务使其生效
./docker-deploy.sh restart

# 4. 验证配置是否生效
docker-compose logs backend | grep "PROMPT"
```

### 方法 2：使用环境变量（简单，短 prompt）

如果你的 prompt 比较短，也可以直接在 `.env` 文件中配置：

```bash
# 1. 编辑 .env 文件
nano .env

# 2. 修改 DIVE_OVERRIDE_SYSTEM_PROMPT（单行，不支持多行）
DIVE_OVERRIDE_SYSTEM_PROMPT="你是一个专业的AI助手"

# 3. 重启后端服务
./docker-deploy.sh restart
```

### 方法 3：自定义文件路径

可以通过环境变量指定自定义的 prompt 文件位置：

```bash
# 在 .env 中添加
SYSTEM_PROMPT_FILE=/path/to/your/custom-prompt.txt

# 然后重启
./docker-deploy.sh restart
```

**注意**：
- 文件方式优先级高于环境变量方式
- `system-prompt.txt` 支持任意长度的 prompt
- `docker-compose restart` 会重新读取文件内容
- 无需重新构建镜像

## 技术栈

- **Frontend**: React 19 + Vite + Nginx
- **Backend**: Node.js 20 + Express + Prisma
- **Database**: PostgreSQL 16
- **Container**: Docker + Docker Compose

