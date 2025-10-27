# NewmindHub 启动指南

## 🚀 首次部署

### 方法 1：一键部署（推荐）

```bash
# 本地部署
./docker-deploy.sh setup

# 指定 URL（局域网/云服务器）
./docker-deploy.sh setup http://192.168.1.3:23000
```

**自动完成：**
1. 启动所有服务
2. 初始化数据库
3. 配置 Stripe Webhook
4. 启动 Stripe 监听器

**完成！访问：**
- 前端: http://192.168.1.3:23001
- 后端: http://192.168.1.3:23000

---

### 方法 2：分步部署（手动控制）

```bash
# 步骤 1: 启动服务
./docker-deploy.sh up
sleep 30

# 步骤 2: 初始化数据库
./docker-deploy.sh migrate

# 步骤 3: 配置 Stripe
./setup-stripe-webhook.sh http://192.168.1.3:23000

# 步骤 4: 启动 Stripe 监听器
./start-stripe-webhook.sh http://192.168.1.3:23000
```

---

## 🔧 代码变动后

### 场景 1: 修改了后端代码（src/）
```bash
./docker-deploy.sh rebuild
```
**说明：** 重新构建并启动所有服务，数据库保留。

---

### 场景 2: 修改了前端代码（frontend/）
```bash
./docker-deploy.sh rebuild
```
**说明：** 同上，前后端一起重新构建。

---

### 场景 3: 修改了 .env 配置
```bash
./docker-deploy.sh restart
```
**说明：** 强制重新加载环境变量，无需重新构建。

---

### 场景 4: 修改了 Stripe 配置（Key 或 Secret）
```bash
./docker-deploy.sh restart-stripe http://192.168.1.3:23000
```
**说明：** 重新获取 Webhook Secret，更新 .env，重启后端。

---

### 场景 5: 修改了数据库结构（prisma/schema.prisma）
```bash
# 生成新的迁移文件
docker-compose exec backend npx prisma migrate dev --name your_change_name

# 应用到生产环境
./docker-deploy.sh migrate
```
**说明：** 数据库结构变更需要生成迁移文件。

---

## 📋 常用命令

```bash
# 查看日志
./docker-deploy.sh logs backend        # 后端日志
./docker-deploy.sh logs frontend       # 前端日志
docker logs -f stripe-webhook          # Stripe 监听器日志

# 停止所有服务
./docker-deploy.sh down

# 清空所有数据（危险！）
./docker-deploy.sh clean

# 查看所有命令
./docker-deploy.sh
```

---

## ⚠️ 重要提示

### Docker 环境变量机制
- Docker 容器只在**启动时**读取 `.env` 文件
- 修改 `.env` 后必须运行 `./docker-deploy.sh restart`
- `docker-compose restart` **不会**重新加载环境变量

### Stripe 配置
- `setup-stripe-webhook.sh` 和 `start-stripe-webhook.sh` 会自动强制重新加载环境变量
- 生产环境不需要 Stripe 监听器（直接配置 Stripe Dashboard 的 webhook）

### 数据库
- `./docker-deploy.sh down` 不会删除数据
- `./docker-deploy.sh clean` 会删除所有数据（包括数据库）

---

## 🎯 快速参考

| 操作 | 命令 |
|------|------|
| 首次部署 | `./docker-deploy.sh up` → `migrate` → `setup-stripe` → `start-stripe` |
| 代码修改 | `./docker-deploy.sh rebuild` |
| .env 修改 | `./docker-deploy.sh restart` |
| Stripe 修改 | `./docker-deploy.sh restart-stripe http://192.168.1.3:23000` |
| 查看日志 | `./docker-deploy.sh logs backend` |
| 停止服务 | `./docker-deploy.sh down` |
