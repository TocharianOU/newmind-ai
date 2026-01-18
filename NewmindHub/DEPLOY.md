# NewmindHub 部署指南

快速部署指南，用于在新服务器上部署 NewmindHub。

---

## 📋 前置要求

- Ubuntu/Debian 服务器
- Docker 和 Docker Compose 已安装
- 服务器可访问 GitHub Container Registry

---

## 🔧 服务器准备

### 1. 安装 Docker

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

### 2. 创建部署目录和配置文件

```bash
# 创建目录
mkdir -p /opt/newmindhub/test
cd /opt/newmindhub/test

# 创建 .env 文件
cat > .env << 'EOF'
# 数据库配置
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password_here
POSTGRES_DB=newmindhub_auth
DATABASE_URL=postgresql://postgres:your_secure_password_here@postgres:5432/newmindhub_auth?schema=public

# JWT
JWT_SECRET=your_jwt_secret_at_least_32_characters_long

# Stripe 配置
STRIPE_API_KEY=sk_test_your_stripe_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_key
STRIPE_WEBHOOK_SECRET=whsec_auto_generated
STRIPE_PRICE_ID_MONTHLY=price_xxx
STRIPE_PRICE_ID_YEARLY=price_xxx
STRIPE_SUCCESS_URL=http://your-domain:10003/payment/success
STRIPE_CANCEL_URL=http://your-domain:10003/payment/cancel
STRIPE_SETTLEMENT_CURRENCY=eur

# URL 配置
HUB_FRONTEND_URL=http://your-domain:10003
VITE_API_BASE_URL=http://your-domain:10002
VITE_DOCS_URL=http://your-domain:24002

# 端口配置
BACKEND_PORT=10002
FRONTEND_PORT=10003
POSTGRES_PORT=15432

# CORS 配置
ALLOWED_ORIGINS=http://your-domain:10003,file://,tauri://localhost

# 下载地址（使用 GitHub releases）
DOWNLOAD_URL_WINDOWS_X64=https://github.com/TocharianOU/newmind-ai/releases/latest/download/NewChat-win-x64.exe
DOWNLOAD_URL_MACOS_INTEL=https://github.com/TocharianOU/newmind-ai/releases/latest/download/NewChat-mac-x64.dmg
DOWNLOAD_URL_MACOS_APPLE_SILICON=https://github.com/TocharianOU/newmind-ai/releases/latest/download/NewChat-mac-arm64.dmg
DOWNLOAD_URL_LINUX_X64=https://github.com/TocharianOU/newmind-ai/releases/latest/download/NewChat-linux-x86_64.AppImage
EOF

# 设置权限
chmod 600 .env

# 创建 system-prompt.txt
echo "[TEST] You are a helpful AI assistant powered by NewmindHub." > system-prompt.txt

# 创建日志目录
mkdir -p logs
```

---

## 🔐 GitHub 配置

### 1. 生成 SSH 密钥

```bash
# 在本地机器上执行
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_deploy_key

# 将公钥添加到服务器
ssh-copy-id -i ~/.ssh/github_deploy_key.pub root@your-server-ip

# 查看私钥（用于 GitHub Secrets）
cat ~/.ssh/github_deploy_key
```

### 2. 配置 GitHub Secrets

进入仓库设置：`https://github.com/your-username/newmind-ai/settings/secrets/actions`

添加以下 Secrets：

| Secret 名称 | 值 | 说明 |
|------------|----|----|
| `SERVER_HOST` | `your-server-ip` | 服务器地址 |
| `SERVER_USER` | `root` | SSH 用户名 |
| `SERVER_SSH_KEY` | (私钥完整内容) | SSH 私钥 |
| `STRIPE_TEST_API_KEY` | `sk_test_...` | Stripe 测试密钥 |
| `TEST_VITE_API_BASE_URL` | `http://your-server:10002` | API 地址 |
| `TEST_VITE_DOCS_URL` | `http://your-server:24002` | 文档地址 |

---

## 🚀 部署

推送代码到 `dev` 分支即可自动部署：

```bash
git push origin dev
```

GitHub Actions 会自动：
1. 构建 Docker 镜像
2. 部署到服务器
3. 启动所有服务
4. 配置 Stripe webhook（测试环境）

---

## ✅ 验证部署

```bash
# SSH 登录服务器
ssh root@your-server-ip

# 查看服务状态
cd /opt/newmindhub/test
docker compose ps

# 查看日志
docker compose logs -f backend
```

**访问服务**：
- 前端：`http://your-server:10003`
- 后端：`http://your-server:10002/api/health`

---

## 🔄 数据库迁移

首次部署后，数据库会自动初始化。如需手动迁移：

```bash
cd /opt/newmindhub/test
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npx prisma db push
```

---

## 💳 Stripe Webhook 配置

### 测试环境（自动配置）
GitHub Actions 会自动启动 Stripe CLI 容器作为转发器。

验证：
```bash
docker ps | grep stripe
docker logs stripe-webhook
```

### 生产环境（手动配置）
1. 登录 Stripe Dashboard：https://dashboard.stripe.com/webhooks
2. 添加端点：`https://your-domain.com/api/v1/payment/webhook`
3. 选择事件：
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
   - `customer.subscription.deleted`
   - `payment_intent.payment_failed`
4. 复制 Signing Secret 到 `.env` 的 `STRIPE_WEBHOOK_SECRET`

---

## 🐛 故障排查

### 查看日志
```bash
docker compose logs -f
```

### 重启服务
```bash
docker compose restart backend
```

### 重新部署
```bash
docker compose down
docker compose up -d
```

---

## 📝 注意事项

1. **环境变量**：`.env` 文件必须在 `/opt/newmindhub/test/` 目录下
2. **端口**：确保 10002, 10003 端口未被占用
3. **下载链接**：使用 GitHub releases，不要硬编码
4. **Stripe**：测试环境使用 `sk_test_`，生产环境使用 `sk_live_`
5. **备份**：定期备份数据库和 `.env` 文件

---

完成！🎉
