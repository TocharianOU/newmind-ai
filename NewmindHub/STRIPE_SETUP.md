# Stripe 支付系统设置指南

## 前提条件

1. Stripe 账户（测试模式或生产模式）
2. PostgreSQL 数据库已配置
3. Node.js 18+ 和 npm

## 快速开始

### 1. 安装依赖

```bash
cd NewmindHub

# 后端依赖
npm install

# 前端依赖
cd frontend
npm install
```

> **注意**：前端使用 React 19，与 `@stripe/react-stripe-js` 不兼容。我们直接使用 `@stripe/stripe-js` 和原生 JavaScript API，这样更轻量且完全兼容。

### 2. 配置环境变量

**后端配置** - 编辑 `NewmindHub/.env` 文件：

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...              # 从 Stripe Dashboard 获取
STRIPE_PUBLISHABLE_KEY=pk_test_...         # 从 Stripe Dashboard 获取
STRIPE_WEBHOOK_SECRET=whsec_...            # 配置 Webhook 后获取
STRIPE_CURRENCY=usd                        # 客户支付货币
STRIPE_SETTLEMENT_CURRENCY=eur             # 结算货币
HUB_FRONTEND_URL=http://localhost:23001    # 前端 URL
```

**前端配置** - 创建 `NewmindHub/frontend/.env` 文件：

```bash
# Stripe Configuration
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...    # 与后端相同的可发布密钥

# API Configuration (可选)
VITE_API_URL=http://localhost:23000
```

> **重要**：前端只需要可发布密钥 (Publishable Key)，切勿将密钥 (Secret Key) 放在前端！

### 3. 运行数据库迁移

```bash
npm run db:migrate
# 或
npm run db:push
```

### 4. 启动服务

```bash
# 后端
npm run dev

# 前端（新终端）
cd frontend
npm run dev
```

## Stripe Dashboard 配置

### 获取 API 密钥

1. 登录 [Stripe Dashboard](https://dashboard.stripe.com/)
2. 进入 **开发者 > API 密钥**
3. 复制：
   - **可发布密钥** (Publishable key) → `STRIPE_PUBLISHABLE_KEY`
   - **密钥** (Secret key) → `STRIPE_SECRET_KEY`

### 配置 Webhook

1. 进入 **开发者 > Webhooks**
2. 点击 **添加端点**
3. 端点 URL：`https://your-domain.com/api/v1/payment/webhook`
   - 测试环境：使用 [ngrok](https://ngrok.com/) 或 [localtunnel](https://localtunnel.github.io/www/)
4. 选择事件：
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
   - `customer.subscription.deleted`
   - `payment_intent.payment_failed`
5. 复制 **签名密钥** → `STRIPE_WEBHOOK_SECRET`

## 测试

### 测试卡号

Stripe 提供测试卡号用于测试：

- **成功支付**：`4242 4242 4242 4242`
- **需要 3D 验证**：`4000 0025 0000 3155`
- **被拒绝**：`4000 0000 0000 0002`

**其他测试信息**：
- 过期日期：任何未来日期
- CVC：任意 3 位数字
- ZIP：任意 5 位数字

### 测试流程

1. 访问 `http://localhost:23001/billing`
2. 选择 Token 包或订阅套餐
3. 点击购买，重定向到 Stripe Checkout
4. 使用测试卡号完成支付
5. 返回成功页面，验证 Token 余额更新

## API 端点

### Token 包

- `GET /api/v1/payment/token-packages` - 获取可用 Token 包
- `POST /api/v1/payment/create-token-checkout` - 创建购买会话
  ```json
  { "packageId": "starter" }
  ```

### 订阅

- `POST /api/v1/payment/create-subscription-checkout` - 创建订阅
  ```json
  { "planId": "pro", "period": "monthly" }
  ```
- `POST /api/v1/payment/cancel-subscription` - 取消订阅

### 历史记录

- `GET /api/v1/payment/history?limit=20&offset=0` - 获取支付历史

### Webhook

- `POST /api/v1/payment/webhook` - Stripe Webhook 接收

## 货币转换

- **用户支付**：美元 (USD)
- **您收到**：欧元 (EUR)
- Stripe 自动进行货币转换，并收取少量转换费用

## Token 定价

根据 Claude 定价设置的 Token 包：

| 套餐 | Tokens | 价格 | 每 M Token 成本 |
|------|--------|------|----------------|
| Starter | 1M | $10 | $10 |
| Professional | 6M | $50 | $8.33 |
| Enterprise | 15M | $100 | $6.67 |

## 订阅定价

| 套餐 | 月付 | 年付 | 每日 Tokens |
|------|------|------|------------|
| PRO | $20 | $200 | 50M |
| ENTERPRISE | $100 | $1000 | 无限 |

## 故障排除

### Webhook 未接收

1. 检查 Webhook URL 是否可访问
2. 验证 `STRIPE_WEBHOOK_SECRET` 是否正确
3. 查看 Stripe Dashboard > Webhooks > 尝试记录

### 支付失败

1. 检查 `STRIPE_SECRET_KEY` 是否正确
2. 确认账户未被限制
3. 查看后端日志

### Token 未增加

1. 检查 Webhook 是否正确接收
2. 查看数据库 `TokenPurchase` 表状态
3. 检查 `user.tokenBalance` 字段

## 生产部署

### 切换到生产模式

1. 在 Stripe Dashboard 切换到 **生产模式**
2. 更新环境变量使用生产密钥
3. 配置生产 Webhook URL
4. 运行完整测试流程

### 安全检查清单

- ✅ 使用 HTTPS
- ✅ Webhook 签名验证已启用
- ✅ API 密钥存储在环境变量中
- ✅ 生产数据库备份已配置
- ✅ 日志监控已设置

## 监控

### 重要指标

- 支付成功率
- Webhook 接收延迟
- Token 余额准确性
- 订阅续费率

### 日志位置

- 后端日志：`NewmindHub/logs/`
- Stripe 日志：Dashboard > 日志

## 支持

- Stripe 文档：https://stripe.com/docs
- Stripe 支持：https://support.stripe.com/
- 项目 Issues：GitHub Issues

---

**最后更新**：2025-10-22

