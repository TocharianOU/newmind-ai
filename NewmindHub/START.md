# NewmindHub 启动指南

本文档说明如何启动 NewmindHub 服务。

## 启动方式

NewmindHub 支持三种启动方式：

1. **本地开发模式**：适合开发和调试
2. **生产模式**：本地生产环境运行
3. **Docker 模式**：容器化部署

## 方式 1：本地开发模式

### 启动后端服务

```bash
cd NewmindHub
npm run dev
```

服务将在 `http://localhost:3000` 启动，支持热重载。

### 启动前端开发服务器

```bash
cd frontend
npm run dev
```

前端开发服务器将在 `http://localhost:3001` 启动。

### 访问服务

- **前端界面**: http://localhost:3001
- **API 服务**: http://localhost:3000
- **健康检查**: http://localhost:3000/api/v1/health

## 方式 2：生产模式

### 启动后端

```bash
cd NewmindHub
npm start
```

### 提供前端静态文件

前端构建产物将由后端自动提供服务。

## 方式 3：Docker 部署

### 快速启动

```bash
cd NewmindHub

# 1. 配置环境变量
cp env.docker.example .env

# 2. 启动所有服务
./docker-deploy.sh up

# 3. 运行数据库迁移
./docker-deploy.sh migrate
```

### 访问服务

- **前端界面**: http://localhost:3001
- **API 服务**: http://localhost:3000

### Docker 管理命令

```bash
# 查看日志
./docker-deploy.sh logs

# 停止服务
./docker-deploy.sh down

# 重启服务
./docker-deploy.sh restart

# 查看状态
./docker-deploy.sh status

# 进入容器
./docker-deploy.sh exec
```

详细 Docker 部署说明请参考 [DOCKER.md](./DOCKER.md)。

## 环境变量配置

### 必需配置

```env
# 数据库
DATABASE_URL="postgresql://user:password@localhost:5432/newmindhub"

# 安全
JWT_SECRET="your-secure-jwt-secret"

# API 密钥
ANTHROPIC_API_KEY="your-anthropic-api-key"
```

### 可选配置

```env
# 端口
PORT=3000
FRONTEND_PORT=3001

# 日志级别
LOG_LEVEL=info

# Redis（可选）
REDIS_URL="redis://localhost:6379"
```

## 验证服务

### 检查服务状态

```bash
# 后端健康检查
curl http://localhost:3000/api/v1/health

# 前端访问
open http://localhost:3001
```

### 测试 API

```bash
# 获取可用模型
curl http://localhost:3000/api/v1/models
```

## 常见问题

### 端口被占用

修改 `.env` 文件中的端口配置：

```env
PORT=3100
FRONTEND_PORT=3101
```

### 数据库连接失败

1. 确认 PostgreSQL 正在运行
2. 检查 `DATABASE_URL` 配置
3. 验证数据库权限

### 前端无法访问后端

检查 CORS 配置和环境变量：

```env
CORS_ORIGIN=http://localhost:3001
```

## 停止服务

### 本地模式

在终端按 `Ctrl + C` 停止服务。

### Docker 模式

```bash
./docker-deploy.sh down
```

## 日志查看

### 本地模式

日志输出到控制台和 `logs/` 目录。

### Docker 模式

```bash
# 实时查看日志
./docker-deploy.sh logs

# 查看特定服务日志
docker-compose logs backend
docker-compose logs frontend
```

## 下一步

- 查看 [BUILD.md](./BUILD.md) 了解构建配置
- 查看 [DOCKER.md](./DOCKER.md) 了解详细 Docker 部署
- 查看 [README.md](./README.md) 了解项目架构


