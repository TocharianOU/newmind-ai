# Stripe Webhook 修复说明

## 问题根因
之前 webhook 路由在全局 `express.json()` 之后注册，导致 Stripe 签名校验失败。Stripe webhook 需要原始请求体（raw body），但被 JSON 解析器提前处理了。

## 已修复内容

### 1. `src/server.js`
- 在 `express.json()` **之前**单独挂载 webhook 路由
- 使用 `express.raw({ type: 'application/json' })` 保留原始请求体

### 2. `src/routes/payment.js`
- 导出 `stripeWebhookHandler` 函数供 `server.js` 使用
- 移除原来的 `router.post('/webhook', ...)` 定义

## 启动步骤

### 1. 确保后端服务运行
```bash
cd /Users/ablatazmat/Downloads/newmind-ai/NewmindHub
npm run dev
```
后端应运行在 `http://localhost:23000`

### 2. 启动 Stripe CLI（Docker 方式）
```bash
cd /Users/ablatazmat/Downloads/newmind-ai/NewmindHub
./start-stripe-cli.sh
```

**重要：** 首次运行会输出类似以下内容：
```
> Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxxxxxxxxxx
```

### 3. 更新 Webhook Secret
将上面输出的 `whsec_...` 复制到 `.env` 文件：
```bash
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx
```

### 4. 重启后端服务
修改 `.env` 后，重启后端让新的 webhook secret 生效。

## 验证 Webhook 是否工作

### 方法 1：进行测试购买
1. 访问 `http://localhost:5174/billing`
2. 选择任意 Token 包进行购买
3. 使用测试卡号：`4242 4242 4242 4242`，任意未来日期和 CVC
4. 完成支付后，检查后端日志

**后端应输出：**
```
📥 Received webhook: checkout.session.completed
✅ Token purchase completed: 1000000 tokens for user xxx
```

### 方法 2：重发历史事件
1. 登录 Stripe Dashboard: https://dashboard.stripe.com/test/events
2. 找到之前的 `checkout.session.completed` 事件
3. 点击右上角 "Resend webhook"
4. 检查后端日志，应能看到 webhook 处理日志

## 测试卡号
- **成功支付**: `4242 4242 4242 4242`
- **需要 3D 验证**: `4000 0027 6000 3184`
- **支付失败**: `4000 0000 0000 0002`
- **余额不足**: `4000 0000 0000 9995`

所有测试卡：
- 日期：任意未来日期（如 12/30）
- CVC：任意 3 位数字（如 123）
- ZIP：任意邮编（如 12345）

## 常见问题

### Q: Stripe CLI 报错 "command not found: stripe"
A: 使用提供的 Docker 脚本 `./start-stripe-cli.sh`，不需要本地安装 Stripe CLI

### Q: Webhook 签名校验失败
A: 确保 `.env` 中的 `STRIPE_WEBHOOK_SECRET` 与 Stripe CLI 输出的一致，并重启后端

### Q: Docker 容器无法访问本机服务
A: 脚本使用 `host.docker.internal:23000`，这是 Docker Desktop 访问宿主机的特殊域名

### Q: 支付成功但余额没更新
A: 
1. 检查 Stripe CLI 是否正在运行
2. 检查后端日志是否有 "📥 Received webhook" 日志
3. 检查数据库 `TokenPurchase` 表的 `status` 字段是否为 `COMPLETED`

## Docker Compose 环境
如果使用 Docker Compose 运行整个项目，需要调整网络：

```bash
docker run --rm -it --name stripe-cli \
  --network newmindhub_default \
  -e STRIPE_API_KEY="${STRIPE_SECRET_KEY}" \
  stripe/stripe-cli:latest listen \
  --forward-to http://backend:23000/api/v1/payment/webhook \
  --print-secret \
  --events checkout.session.completed,invoice.payment_succeeded
```

注意：`--network` 需要与 docker-compose.yml 的网络名称一致，`backend` 需要与服务名一致。

