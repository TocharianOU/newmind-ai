# 计费系统 TODO 清单

> 每完成一项，将 `[ ]` 改为 `[x]`。
> 文档创建于 2026-03-03，基于当前代码库状态整理。

---

## 当前已完成的基础

- [x] USD Balance 增减事务（`usdBalance.js` — `addUsd` / `deductUsd`）
- [x] BalanceTransaction 账本记录（含 balanceBefore / balanceAfter）
- [x] 模型 token 用完后降级扣 USD（`proxy.js` `recordUsage`）
- [x] 工具调用按 `unitPriceUsd` 扣费（`toolQuota.js`）
- [x] Stripe PRO 订阅
- [x] Stripe 手动充值（$20 / $100 / 自定义金额）
- [x] 前端 Billing 页面（余额展示、充值入口、历史记录）
- [x] 审计日志（USD_TOPUP / USD_CHARGED / MODEL_CALL）
- [x] SMTP 邮件基础设施（`email.js`，已有 nodemailer，当前仅用于密码重置）

---

## 一、自动补充（Auto Top-up） ✅

**目标**：余额低于阈值时，自动用已绑定的银行卡充值，无需用户手动操作。

### 数据模型

- [x] 在 `User` 表上添加字段：
  - `autoTopUpEnabled`, `autoTopUpThreshold`, `autoTopUpAmount`
  - `stripeCustomerId`, `stripeDefaultPaymentMethod`
  - `lastLowBalanceEmailAt`

### 后端实现

- [x] `payment.js`：充值时通过 `saveCard` + `setup_future_usage: 'off_session'` 隐式保存银行卡
  - Webhook 中自动将 payment_method 绑定到 Stripe Customer 并存入 User
- [x] `payment.js`：新增 `GET/POST /api/v1/payment/auto-topup-settings`
  - 允许用户开启/关闭、修改阈值和补充金额
- [x] `autoTopUp.js`（新文件）：`maybeAutoTopUp()` — 检查余额 → Stripe off-session charge → 入账
- [x] `usdBalance.js`：`deductUsd` 成功后 `setImmediate` 异步触发 `maybeAutoTopUp`
  - 充值失败时发送低余额邮件通知

### 前端

- [x] `Billing.jsx`：充值区域底部内联 auto top-up 行（toggle + 已保存卡信息 + Edit 展开编辑）

---

## 二、模型 Token 实际扣费（当前状态核查与完善） ✅

**已修复：**

- [x] `recordUsage` 中移除静默 `catch`，USD 扣费失败时错误会冒泡到日志
  - 预检拦截已由 `checkTokenUsage` → `checkModelAccess` → `checkAccessForMode` 完成：月赠 token 耗尽且 `usdBalance == 0` 时返回 429
- [x] 新增 `getTokenPricing(model)` 函数（`constants.js`），未知模型使用 `MODEL_COST_FALLBACK_PER_1K` env 变量（默认 $0.015/1K token）
- [x] CustomModel 走同一 `recordUsage` 路径，`getTokenPricing` 自动 fallback

---

## 三、低余额通知 ✅

**目标**：余额不足时主动通知用户，减少因余额耗尽导致的服务中断。

- [x] `email.js`：新增 `sendLowBalanceEmail(to, balance, topUpFailed)` 函数
  - 两套模板：低余额提醒 / Auto Top-up 失败告警，含充值按钮链接
- [x] 触发点一：`deductUsd` → `maybeAutoTopUp` → 余额 ≤ $2.00 时发送
- [x] 触发点二：Auto Top-up Stripe 扣款失败时立即发送
- [x] 去重控制：`User.lastLowBalanceEmailAt` 记录上次发送时间，24h 冷却

---

## 四、管理员消费报表 ✅

**已完成：**

- [x] `GET /api/v1/admin/billing/summary` — 平台汇总
  - 充值总额（手动 + auto）、模型扣费、工具扣费、活跃用户数
  - 按天分组的 daily 趋势数据（topups / charges）
  - 支持 `7d / 30d / 90d` range 查询
- [x] `GET /api/v1/admin/billing/users` — 用户消费排行
  - 本月模型 / 工具扣费、充值、当前余额、Plan
  - 按消费金额倒序排列
- [x] `GET /api/v1/admin/billing/users/:userId/transactions` — 单用户流水
  - 完整 `BalanceTransaction` 记录，分页（limit/offset）
- [x] 新增 `AdminBilling.jsx` 前端页面
  - 四卡片汇总（Top-ups / Model $ / Tool $ / Active Users）
  - Recharts 柱状图展示每日收入 vs 消费
  - 用户消费表格，可搜索、点击查看流水详情 Modal
  - 已注册路由 `/admin/billing`，侧边栏已添加导航入口

---

## 五、用户消费上限（Spending Cap） ✅

**已完成：**

- [x] `User` 表新增 `monthlySpendCapUsd Decimal?`，null 表示不限制
- [x] `deductUsd` 事务内查询当月消费总额，超过 cap 抛出 `Monthly spending cap exceeded`
- [x] `PATCH /api/v1/admin/billing/users/:userId/spend-cap` — 管理员调整单用户上限
- [x] `GET /api/v1/payment/monthly-spend` — 用户查看本月已消费 + cap
- [x] `getMonthlySpend(userId)` 工具函数（`usdBalance.js`）
- [x] 管理员报表用户列表中展示各用户的 `monthlySpendCapUsd`

---

## 六、发票 / 收据 ✅

**已完成：**

- [x] `GET /api/v1/payment/receipts` — 合并 Stripe invoices + charges
  - 订阅发票：返回 `invoice_pdf` 和 `hosted_invoice_url`
  - 一次性充值：返回 `receipt_url`（Stripe charge）
  - 按时间倒序，去重（charge 已关联 invoice 的不重复展示）
- [x] 前端 Billing 页面新增 "Receipts & Invoices" 表格
  - 显示日期、类型、金额、状态，带 PDF / View 链接
- [x] 注意：需在 Stripe Dashboard 开启 "Customer Email" 和 "Invoice PDF" 才能生成 PDF 链接

---

## 优先级总结

| 优先级 | 模块 | 理由 |
|---|---|---|
| ~~P0~~ | ~~模型扣费完善（第二节）~~ | ✅ 已完成 |
| ~~P1~~ | ~~自动补充~~ | ✅ 已完成 |
| ~~P1~~ | ~~低余额通知~~ | ✅ 已完成 |
| ~~P2~~ | ~~消费上限（第五节）~~ | ✅ 已完成 |
| ~~P2~~ | ~~管理员报表~~ | ✅ 已完成 |
| ~~P3~~ | ~~发票（第六节）~~ | ✅ 已完成 |
