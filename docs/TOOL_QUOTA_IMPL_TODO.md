# 工具价格梯队 + 配额系统 实施计划

基于 `SAAS_ENTERPRISE_PACKAGING_CONSENSUS.md` 中达成的共识，本文档记录落地所需的具体改动清单。

## 背景

当前三个情报源 proxy（VirusTotal / Shodan / AbuseIPDB）只做了认证，没有任何额度控制。
工具调用会被记录到 `UsageRecord` 表里，但以伪装成模型调用的方式（`modelName: 'virustotal-hub'`），没有独立表，也没有梯队概念。

目标是引入 `A / B / C / X` 工具价格梯队体系，按套餐（BASE / PRO）给每个梯队默认月度额度，超额后可购买额外包。

## 工具梯队定义

| 梯队 | 工具 | 说明 |
|------|------|------|
| A    | `virustotal` | 高价值情报源，每月额度少，补充包最贵 |
| B    | `shodan` | 中等成本情报源 |
| C    | `abuseipdb` | 低到中成本，较容易开放 |
| X    | 自定义集成 / AWS / Jira / Splunk 等 | 免费梯队，不计入平台工具额度 |

## 扣费规则

- `1 次工具调用 = 1 次该梯队额度`
- 第一阶段不区分不同端点权重
- 如果用户使用 `BYOK` 模式，不扣平台额度，只记录日志

## 套餐默认额度（建议值，代码里以常量定义）

| 套餐 | A 梯队 / 月 | B 梯队 / 月 | C 梯队 / 月 | 自定义模型 |
|------|------------|------------|------------|-----------|
| BASE | 20 次       | 50 次       | 200 次      | 不支持     |
| PRO  | 200 次      | 500 次      | 2000 次     | 支持       |

---

## 实施清单

### Step 1 — 数据层 (Prisma)

- [ ] 新增 `ToolUsageRecord` 表
  - 字段：`id`, `userId`, `toolName`, `tier` (A/B/C), `keyMode` (hub/byok), `count`(=1), `createdAt`
  - 索引：`userId + createdAt`, `tier + createdAt`
- [ ] 新增 `ToolQuota` 表
  - 字段：`id`, `userId`, `tier`, `monthlyLimit`, `usedThisMonth`, `periodStart`, `updatedAt`
  - 唯一约束：`userId + tier`
- [ ] 编写对应 migration SQL
- [ ] 运行 `npm run db:migrate`

### Step 2 — 后端常量层

- [ ] `constants.js` 新增 `TOOL_TIER_MAP`
  - 每个工具名对应梯队
  - 示例：`{ virustotal: 'A', shodan: 'B', abuseipdb: 'C' }`
- [ ] `constants.js` 的 `PLAN_LIMITS` 扩展
  - 新增 `tierQuota: { A: N, B: N, C: N }`
  - 新增 `customModels: boolean`

### Step 3 — 工具额度中间件

- [ ] 新建 `src/middleware/toolQuota.js`
  - `checkAndDeductToolQuota(toolName, keyMode)` 中间件
  - 如果 `keyMode === 'byok'`，跳过额度检查，直接 `next()`
  - 如果 `keyMode === 'hub'`：
    - 查该用户该梯队本月已用量
    - 对比 `PLAN_LIMITS[plan].tierQuota[tier]` + 额外购买额度
    - 超额返回 `429`
    - 通过后 `next()`，请求完成后异步扣减 1 次

### Step 4 — Proxy 路由接入中间件

- [ ] `vt-proxy.js` 接入 `checkAndDeductToolQuota('virustotal', keyMode)`
- [ ] `shodan-proxy.js` 接入 `checkAndDeductToolQuota('shodan', keyMode)`
- [ ] `abuseipdb-proxy.js` 接入 `checkAndDeductToolQuota('abuseipdb', keyMode)`
- [ ] 每个 proxy 的 `recordXxxUsage` 改为写 `ToolUsageRecord` 而不是 `UsageRecord`

### Step 5 — 自定义模型权限

- [ ] `routes/models.js`: 自定义模型改成按套餐过滤
  - `BASE` 不显示，`PRO / Enterprise` 显示
- [ ] `routes/proxy.js`: `checkAccessForMode` 同步更新

### Step 6 — 前端 Billing 文案

- [ ] `Billing.jsx`: `BASE` / `PRO` 套餐描述改成梯队额度说法
  - 去掉 `20 MCP servers` / `Unlimited MCP servers`
  - 改成 `A/B/C 梯队工具额度` 描述

### Step 7 — 前端 Dashboard

- [ ] `Dashboard.jsx`: 展示工具梯队本月使用情况
  - 需要后端 `GET /api/v1/user/tool-quota` 接口
  - 展示各梯队已用 / 总额度

---

## 当前进度

- [x] 共识文档确认（`SAAS_ENTERPRISE_PACKAGING_CONSENSUS.md`）
- [ ] Step 1 — 数据层
- [ ] Step 2 — 后端常量层
- [ ] Step 3 — 工具额度中间件
- [ ] Step 4 — Proxy 路由接入
- [ ] Step 5 — 自定义模型权限
- [ ] Step 6 — 前端 Billing 文案
- [ ] Step 7 — 前端 Dashboard
