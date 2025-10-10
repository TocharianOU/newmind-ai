# NewmindHub Docker部署

NewmindHub平台的Docker部署指南。Chat Electron应用将连接到这个Hub平台。

## 快速开始

```bash
# 1. 配置环境（如果还没有.env文件）
cp env.docker.example .env
# 根据需要编辑.env

# 2. 启动服务
./docker-deploy.sh up

# 3. 运行数据库迁移
./docker-deploy.sh migrate

# 4. 访问
# Web管理界面: http://localhost:3001
# API服务: http://localhost:3000
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

```env
# 数据库密码（请修改）
POSTGRES_PASSWORD=your_secure_password

# JWT密钥（请修改）
JWT_SECRET=your_secret_key

# Anthropic API密钥
ANTHROPIC_API_KEY=your_api_key

# 端口配置
BACKEND_PORT=3000
FRONTEND_PORT=3001

# CORS配置（允许Chat应用访问）
# 本地开发：localhost origins + file:// (Chat Electron)
# 生产环境：添加服务器IP/域名
ALLOWED_ORIGINS=http://localhost:3001,http://localhost:5173,file://,tauri://localhost

# 生产示例（添加你的服务器地址）：
# ALLOWED_ORIGINS=http://your-server:3001,http://your-server:3000,file://,tauri://localhost
```

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

1. **修改密码**
   - 更改`POSTGRES_PASSWORD`
   - 使用强`JWT_SECRET`（至少32字符）

2. **配置防火墙**
   - 仅开放3000和3001端口
   - 或使用反向代理（如Nginx）

3. **HTTPS配置**
   - 使用Nginx反向代理
   - 配置SSL证书

4. **备份数据库**
   ```bash
   docker-compose exec postgres pg_dump -U postgres newmindhub_auth > backup.sql
   ```

5. **监控日志**
   ```bash
   ./docker-deploy.sh logs backend | grep -i error
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

