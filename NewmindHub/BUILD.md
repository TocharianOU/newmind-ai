# NewmindHub 构建指南

NewmindHub 是 AI 模型代理和管理平台，提供用户认证、模型管理和订阅系统。

## 环境要求

### 必需软件

- **Node.js**: 18.x 或更高版本
- **PostgreSQL**: 14.x 或更高版本
- **npm** 或 **yarn**: 包管理器

### 可选软件

- **Docker**: 用于容器化部署
- **Redis**: 用于会话管理（可选）

## 依赖安装

### 1. 安装项目依赖

```bash
cd NewmindHub
npm install
```

### 2. 生成 Prisma Client

```bash
npm run db:generate
```

## 数据库配置

### 1. 创建数据库

```bash
# 使用 PostgreSQL 命令行或工具创建数据库
createdb newmindhub
```

### 2. 配置环境变量

复制环境变量模板：

```bash
cp env.example .env
```

编辑 `.env` 文件，配置数据库连接：

```env
# 数据库配置
DATABASE_URL="postgresql://username:password@localhost:5432/newmindhub"

# JWT 密钥
JWT_SECRET="your-secure-random-string"

# API 密钥
ANTHROPIC_API_KEY="your-anthropic-key"

# 服务端口
PORT=3000
FRONTEND_PORT=3001
```

### 3. 运行数据库迁移

```bash
# 开发环境
npm run db:migrate

# 或直接推送 schema
npm run db:push
```

### 4. 初始化数据（可选）

```bash
npm run db:seed
```

## 构建前端

```bash
cd frontend
npm install
npm run build
```

构建产物将输出到 `frontend/dist` 目录。

## 验证构建

确保以下步骤完成：

- [ ] Node.js 依赖已安装
- [ ] Prisma Client 已生成
- [ ] 数据库已创建和配置
- [ ] 环境变量已配置
- [ ] 数据库迁移已运行
- [ ] 前端已构建（如需要）

## 常见问题

### Prisma 连接失败

确保 PostgreSQL 服务正在运行：

```bash
# macOS
brew services start postgresql

# Linux
sudo systemctl start postgresql
```

### 端口冲突

如果默认端口 3000 或 3001 被占用，在 `.env` 文件中修改：

```env
PORT=3100
FRONTEND_PORT=3101
```

## Docker 构建

### 首次构建和部署

```bash
# 1. 配置环境变量
cp env.docker.example .env

# 2. 启动并构建
./docker-deploy.sh up

# 3. 运行数据库迁移
./docker-deploy.sh migrate
```

### 代码更新后重新构建

当你修改了源代码后：

```bash
# 一键重新构建和部署（推荐）
./docker-deploy.sh rebuild
```

这是代码更新后最简单的方式，会自动：
- 停止所有服务
- 清除缓存重新构建镜像
- 启动所有服务

### 部分重建（高级）

如果只修改了特定部分的代码：

```bash
# 只重建后端
docker-compose build --no-cache backend
docker-compose up -d backend

# 只重建前端
docker-compose build --no-cache frontend
docker-compose up -d frontend

# 只重建文档
docker-compose build --no-cache docs
docker-compose up -d docs
```

## 下一步

查看 [START.md](./START.md) 了解如何启动服务。


