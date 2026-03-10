# AttackTraceHub Frontend — C-end 完整性修复清单

> 按优先级排序。P0 = 会崩溃/功能不可用；P1 = 核心功能缺失；P2 = 体验/代码质量。

---

## P0 — 崩溃 / 功能完全不可用

- [x] **Register 路由 `user.subscription` 小写崩溃** (`auth.js` L130) — 同时补 `role` 字段
  - Prisma 关系字段名为 `Subscription`（大写），register 路由使用 `user.subscription`（小写），注册后返回 500
  - _Fix_: 改为 `user.Subscription`，与 login 路由保持一致

- [x] **Admin RBAC 前后端割裂** (`user.js` `/me` 端点 + `AdminStats.jsx` + `Layout.jsx`)
  - `/api/v1/user/me` 返回的 `userData` 不含 `role` 字段
  - 前端 `AdminStats.jsx` L25/31 和 `Layout.jsx` L66 仍用硬编码 `user.email === 'enterprise@test.com'`
  - _Fix_: `/me` 响应加 `role`；前端改为 `user.role === 'ADMIN'`

- [x] **密码验证规则前后端不匹配** (`Register.jsx` L55 + `auth.schemas.js`)
  - 前端只校验 ≥6 位；后端要求 ≥8 位 + 至少一个字母 + 至少一个数字
  - 用户输入 6-7 位时前端放行，后端拒绝，体验断裂
  - _Fix_: 前端校验对齐后端 Zod schema 规则

- [x] **SSO 登录不生成 Refresh Token** (`sso.js` callback)
  - SSO 用户 7 天后 access token 过期，无法续期，被迫重新走 SSO 流程
  - _Fix_: SSO callback 中同步生成并存储 hashed refresh token

---

## P1 — 核心功能缺失

- [x] **Refresh Token 前端完全未使用** (`AuthContext.jsx` + `api.js`)
  - login 返回的 `refreshToken` 被直接丢弃
  - `api.js` 401 拦截器直接跳转登录，不尝试续期
  - _Fix_: 存储 `refreshToken`；401 拦截器先调 `/api/auth/refresh`，失败再跳登录

- [x] **忘记/重置密码功能缺失**
  - 后端无 `/api/auth/forgot-password` / `/api/auth/reset-password` 端点
  - 前端登录页无 "Forgot Password" 链接
  - _Fix_: 后端实现 token 邮件流程；前端加入口和重置密码页

- [x] **Delete Account 按钮无功能** (`Settings.jsx`)
  - 加二次确认弹窗（需输入 "DELETE"）+ API 调用 + 登出跳转

- [x] **个人数据导出无 UI 入口** (`Settings.jsx`)
  - Account 标签页加 "Download My Data" 按钮，触发 JSON 下载

- [x] **Feature Flag 未传播到前端** (`BILLING_ENABLED`)
  - 新增 `GET /api/auth/flags` 端点 + `FeatureFlagsContext`
  - `BILLING_ENABLED=false` 时自动隐藏侧边栏 Billing 链接，`/billing` 路由重定向 dashboard

---

## P2 — 体验 / 代码质量

- [x] **`fetchUser` 死代码** (`Billing.jsx` L17)
  - `const { user, fetchUser } = useAuth()` 中 `fetchUser` 不存在于 `AuthContext`，也从未被调用
  - _Fix_: 删除 `fetchUser` 解构

- [x] **`alert()` 替换为 toast 通知** (`Billing.jsx`)
  - 4 处错误/提示使用原生 `alert()`（L65, L70, L103, L113）
  - _Fix_: 使用页面内 inline 错误消息或 toast 组件

- [x] **清理 `console.log`**
  - `AuthContext.jsx`: 3 处
  - `Login.jsx`: 5 处
  - `Layout.jsx`: 2 处（L126, L161）
  - `Register.jsx`: 2 处

- [x] **Prisma 关系字段大小写不一致** (`sso.js` L238, `user.js` L390, L470)
  - `include: { subscription: true }` 应为 `include: { Subscription: true }`（schema 中定义为大写）
  - _Fix_: 统一改为大写，与其他路由保持一致
