# 审计日志需求与分层共识

## 1. 总体原则

- 审计日志采用**双轨写入**：每次 `writeAudit()` 调用同时写入数据库和本地 JSONL 文件，两者相互独立，文件写入失败不影响数据库写入。
- SaaS 与 Enterprise 写入策略一致，差异只在查询/导出/展示层。
- 审计日志中不得记录明文 API Key、Secret、密码、完整 prompt 或完整响应体。

## 2. 双轨写入机制

### 轨道一：数据库（`AuditLog` 表）

- 用途：Admin API 结构化查询、按条件过滤、分页浏览、导出 JSON/CSV。
- 写入方式：`prisma.auditLog.create()`，同步等待。
- 保留期：默认 90 天（待补充数据库定时清理任务）。

### 轨道二：本地 JSONL 文件

- 用途：SIEM agent（Filebeat、Fluentd、Vector 等）直接采集，无需调用 API。
- 文件路径：`<AUDIT_LOG_DIR>/audit-YYYY-MM-DD.jsonl`，按 UTC 日期命名。
- 写入方式：`fs.appendFile`，异步 fire-and-forget，每条事件一行 JSON。
- 滚动策略：按天自动切换文件（文件名含日期），Hub 启动时注册 24 小时定时清理任务，自动删除超过 `AUDIT_LOG_RETENTION_DAYS`（默认 90）天的旧文件。
- 相关环境变量：
  - `AUDIT_LOG_DIR`（默认 `./logs/audit`）
  - `AUDIT_LOG_RETENTION_DAYS`（默认 `90`）
- 每行格式（与数据库字段完全对齐）：
  ```json
  {"timestamp":"2026-03-03T12:00:00.000Z","userId":"xxx","action":"MODEL_CALL","resourceType":"MODEL","resourceId":null,"projectId":null,"metadata":{},"ipAddress":"1.2.3.4","userAgent":"..."}
  ```

## 3. 审计事件覆盖状态

### 已完成 ✅

- ✅ 用户注册、登录成功/失败、登出、Token 刷新
- ✅ SSO 登录成功/失败
- ✅ 密码重置请求、密码重置完成
- ✅ 项目创建、更新、删除
- ✅ 同步 Push、同步 Pull
- ✅ System Prompt 设置、清除
- ✅ 管理员查看用户列表、用户统计、全局统计
- ✅ 支付 Checkout 创建、订阅 Checkout 创建
- ✅ License 激活、停用
- ✅ 用户账户删除、数据导出
- ✅ 审计日志导出
- ✅ 模型调用（model、inputTokens、outputTokens）
- ✅ 工具调用（toolName、tier、keyMode）
- ✅ 工具配额超限
- ✅ Token 余额增加、扣减
- ✅ 自定义模型创建、更新、删除

### 待补充（有端点时同步加入）

- ⬜ 管理员角色变更、订阅手动调整
- ⬜ 集成配置变更（无独立路由时跳过）

## 4. Admin API 查询能力

`GET /api/v1/audit/admin/logs` 支持以下过滤参数：

| 参数 | 说明 |
|---|---|
| `action` | 按事件类型过滤，支持逗号分隔多值（如 `MODEL_CALL,TOOL_CALL`） |
| `resourceType` | 按资源类型过滤，支持逗号分隔多值 |
| `resourceId` | 按资源 ID 精确过滤 |
| `userId` | 按用户 ID 精确过滤 |
| `email` | 按用户邮箱模糊搜索（不区分大小写，userId 优先） |
| `startDate` / `endDate` | 时间范围过滤 |
| `limit` / `offset` | 分页，limit 上限 500 |

导出：`POST /api/v1/audit/admin/export` 支持 JSON 和 CSV 格式，受 `AUDIT_EXPORT_ENABLED` feature flag 控制。

## 5. SaaS 审计定位

- 审计服务于平台方内部，不面向普通用户。
- 通过 Admin API 或本地 JSONL 文件读取，当前阶段不需要用户侧 UI。
- 保留期默认 90 天。

## 6. Enterprise 审计定位

- 审计作为正式能力交付给客户，提供 UI 页面。
- 支持按用户、项目、动作、资源类型、时间范围筛选与导出。
- 保留期可配置，管理员可查看全组织审计事件。
- 本地 JSONL 文件可供客户自行接入其 SIEM 系统（Splunk、Elastic 等）。

## 7. UI 策略

- 当前阶段不做审计 UI。
- SaaS 不提供用户侧审计页面。
- Enterprise 后续做审计 UI，使用现有 Admin API 驱动。
