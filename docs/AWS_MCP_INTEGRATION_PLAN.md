# AWS MCP 集成计划

> 本文档规划 AttackTrace 平台中 AWS 相关 MCP 工具集成的优先级、技术规范及与现有集成的差异点。
>
> 参考实现：VirusTotal / AbuseIPDB / Shodan（Node.js）
> 参考来源：awslabs/mcp（Apache 2.0，可商用改造）

---

## 目录

1. [背景与定位](#1-背景与定位)
2. [AWS 认证模式设计](#2-aws-认证模式设计)
3. [集成优先级列表](#3-集成优先级列表)
4. [Node.js 实现规范（与现有规范的差异）](#4-nodejs-实现规范与现有规范的差异)
5. [configSchema 模板](#5-configschema-模板)
6. [AWS SDK v3 依赖说明](#6-aws-sdk-v3-依赖说明)
7. [集成开发 Checklist](#7-集成开发-checklist)

---

## 1. 背景与定位

AttackTrace 是面向安全调查的 AI 助手桌面端（Electron），当前已集成：

| 类别 | 已集成 |
|------|--------|
| SIEM | Elasticsearch、Kibana |
| 威胁情报 | VirusTotal、Shodan、AbuseIPDB |

**AWS 集成目标**：覆盖客户 AWS 账号侧的安全调查链路，形成：

```
SIEM 告警（ES/Kibana）
    ↓
AWS 审计溯源（CloudTrail）
    ↓
资源/流量取证（CloudWatch、VPC Flow Logs、IAM）
    ↓
威胁情报验证（VirusTotal、Shodan、AbuseIPDB）
```

---

## 2. AWS 认证模式设计

### 2.1 只支持 BYOK，不做 Hub Key

AWS 资源属于用户自己的基础设施，每个用户的 AWS 账号不同，不适合平台托管凭证。

**统一使用以下四个标准 AWS 环境变量（boto3 / AWS SDK v3 自动识别）：**

| 环境变量 | 是否必填 | 说明 |
|----------|----------|------|
| `AWS_ACCESS_KEY_ID` | 必填 | IAM 用户 Access Key ID |
| `AWS_SECRET_ACCESS_KEY` | 必填（敏感）| IAM 用户 Secret Access Key |
| `AWS_DEFAULT_REGION` | 必填 | 目标区域，如 `us-east-1` |
| `AWS_SESSION_TOKEN` | 选填（敏感）| 临时凭证（AssumeRole / SSO）时使用 |

### 2.2 凭证获取方式（提示用户）

用户在 AWS Console → IAM → 用户 → 安全凭证 → 创建访问密钥，下载 CSV 即可得到前两个变量。`AWS_DEFAULT_REGION` 按实际业务区域填写。

### 2.3 与现有 Hub/BYOK 双模式的区别

| 对比项 | VirusTotal / AbuseIPDB | AWS 系列 |
|--------|------------------------|----------|
| Hub Key 模式 | ✅ 支持（平台托管 key）| ❌ 不支持（账号隔离） |
| BYOK 模式 | ✅ 支持 | ✅ 仅此模式 |
| `keyMode` 字段 | 需要 | 不需要 |
| 代理路由 | 需要创建 | 不需要 |
| `IntegrationMarket.tsx` 改动 | 需要 keyMode 转换逻辑 | 直接传入 4 个 env var 即可 |

---

## 3. 集成优先级列表

### 第一优先级：核心安全审计（立即集成）

#### 3.1 `aws-cloudtrail-mcp`
- **awslabs 原版**：`cloudtrail-mcp-server`（Python/boto3）
- **我们实现**：Node.js + `@aws-sdk/client-cloudtrail`
- **核心价值**：谁在什么时间对什么资源做了什么操作，90 天管理事件历史
- **关键工具**：
  - `lookup_events` — 按用户名/事件名/资源名查询事件
  - `lake_query` — 对 CloudTrail Lake 执行 SQL 分析（需付费）
  - `list_event_data_stores` — 列出可用的 Event Data Store
- **安全调查场景**：API 滥用、权限提升、资源异常访问溯源

#### 3.2 `aws-cloudwatch-mcp`
- **awslabs 原版**：`cloudwatch-mcp-server`（Python/boto3）
- **我们实现**：Node.js + `@aws-sdk/client-cloudwatch-logs` + `@aws-sdk/client-cloudwatch`
- **核心价值**：应用日志查询、告警状态、VPC Flow Logs 分析
- **关键工具**：
  - `query_logs` — CloudWatch Logs Insights 查询（类 SQL）
  - `get_log_events` — 获取指定 log stream 的日志
  - `describe_alarms` — 查看当前告警状态
  - `get_metric_statistics` — 获取指定指标的时序数据
- **安全调查场景**：异常流量（VPC Flow Logs）、应用错误日志、异常访问频率

#### 3.3 `aws-iam-mcp`
- **awslabs 原版**：`iam-mcp-server`（Python/boto3）
- **我们实现**：Node.js + `@aws-sdk/client-iam`
- **核心价值**：权限分析，排查横向移动、权限提升路径
- **关键工具**：
  - `get_user` — 查询 IAM 用户信息和附加策略
  - `list_attached_policies` — 列出用户/角色的权限策略
  - `get_policy_document` — 获取策略详情（权限范围）
  - `list_access_keys` — 列出用户的访问密钥及创建时间
  - `simulate_policy` — 模拟策略执行（判断某操作是否被允许）
- **安全调查场景**：确认攻击者的权限范围、排查过度授权、检测策略篡改

---

### 第二优先级：威胁检测与告警（后续集成）

#### 3.4 `aws-guardduty-mcp`
- **awslabs 原版**：无（需自行实现）
- **我们实现**：Node.js + `@aws-sdk/client-guardduty`
- **核心价值**：AWS 原生威胁检测，自动发现可疑 API 调用、EC2 异常行为、S3 暴露
- **关键工具**：
  - `list_findings` — 列出当前 Finding（按严重程度、时间过滤）
  - `get_finding` — 获取单个 Finding 详情（含 IP、端口、资源信息）
  - `list_detectors` — 列出所有区域的 GuardDuty 检测器状态
- **安全调查场景**：快速发现 AWS 层面的活跃攻击行为，与 SIEM 告警联动

#### 3.5 `aws-securityhub-mcp`
- **awslabs 原版**：无（需自行实现）
- **我们实现**：Node.js + `@aws-sdk/client-securityhub`
- **核心价值**：聚合多源安全告警（GuardDuty、Inspector、Config、第三方工具）
- **关键工具**：
  - `get_findings` — 按过滤条件查询所有 Finding
  - `get_insight_results` — 获取预定义分析视图结果
  - `batch_update_findings` — 批量标记 Finding 状态（调查中/已处理）
- **安全调查场景**：统一视图，避免在多个服务间切换

---

### 第三优先级：资源取证（按需集成）

#### 3.6 `aws-ec2-mcp`
- **awslabs 原版**：`aws-network-mcp-server`（部分覆盖）
- **我们实现**：Node.js + `@aws-sdk/client-ec2`
- **关键工具**：
  - `describe_instances` — 查询实例信息（状态、IP、标签、安全组）
  - `describe_security_groups` — 分析安全组规则（入站/出站规则）
  - `describe_vpc_flow_logs` — 查看 VPC Flow Log 配置
  - `get_console_output` — 获取实例控制台输出（异常启动排查）
- **安全调查场景**：确认受影响资源、分析网络暴露面

#### 3.7 `aws-s3-mcp`
- **awslabs 原版**：无直接对应（`s3-tables-mcp-server` 是数据分析用）
- **我们实现**：Node.js + `@aws-sdk/client-s3`
- **关键工具**：
  - `list_buckets` — 列出所有 S3 桶
  - `get_bucket_policy` — 获取桶策略（检测公开暴露）
  - `get_bucket_acl` — 检查访问控制列表
  - `list_objects` — 列出对象（排查敏感数据泄露路径）
- **安全调查场景**：数据泄露、桶暴露、权限配置错误

#### 3.8 `aws-lambda-mcp`
- **awslabs 原版**：`lambda-tool-mcp-server`（功能执行，非调查用）
- **我们实现**：Node.js + `@aws-sdk/client-lambda`
- **关键工具**：
  - `list_functions` — 列出 Lambda 函数及其配置
  - `get_function_configuration` — 获取函数的运行时、角色、环境变量
  - `list_event_source_mappings` — 查看触发器配置
- **安全调查场景**：Serverless 后门排查、函数权限滥用

---

## 4. Node.js 实现规范（与现有规范的差异）

**完整通用规范见** `docs/MCP_INTEGRATION_GUIDE.md`，以下仅列出 AWS 系列的**差异点**。

### 4.1 项目命名

```
aws-cloudtrail-mcp/    ← 格式：aws-<service>-mcp
aws-cloudwatch-mcp/
aws-iam-mcp/
```

GitHub 仓库：`TocharianOU/aws-cloudtrail-mcp`（对应 `TocharianOU/mcp-virustotal` 模式）

### 4.2 AWS SDK v3 客户端初始化

```typescript
// src/utils/api.ts
import { CloudTrailClient } from '@aws-sdk/client-cloudtrail';
import { AWSConfig } from '../types.js';

export function createAWSClient(config: AWSConfig): CloudTrailClient {
  return new CloudTrailClient({
    region: config.region || process.env.AWS_DEFAULT_REGION || 'us-east-1',
    credentials: config.accessKeyId ? {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey!,
      sessionToken: config.sessionToken,
    } : undefined,
    // 未提供 credentials 时，SDK 自动从环境变量读取
  });
}
```

**与 VT/Shodan 的区别**：
- 无需 `axios`，使用 AWS SDK v3 自带的 HTTP 客户端
- 无 `baseUrl` / `authToken` 字段（不需要代理）
- 未提供凭证时 SDK 会从环境变量 `AWS_ACCESS_KEY_ID` 等自动读取，保持启动不报错的原则

### 4.3 `src/types.ts` 配置 Schema

```typescript
// AWS 系列统一 ConfigSchema
export const AWSConfigSchema = z.object({
  accessKeyId:     z.string().optional().describe('AWS Access Key ID (overrides AWS_ACCESS_KEY_ID env var)'),
  secretAccessKey: z.string().optional().describe('AWS Secret Access Key (overrides AWS_SECRET_ACCESS_KEY env var)'),
  region:          z.string().optional().describe('AWS Region (overrides AWS_DEFAULT_REGION env var), e.g. us-east-1'),
  sessionToken:    z.string().optional().describe('AWS Session Token for temporary credentials (AssumeRole/SSO)'),
  timeout:         z.number().optional().describe('Request timeout in milliseconds (default: 30000)'),
});

export type AWSConfig = z.infer<typeof AWSConfigSchema>;
```

### 4.4 `index.ts` 环境变量优先级

```typescript
// 先从 process.env 读取，允许用户通过 config.js 的 env 字段注入
const config: AWSConfig = AWSConfigSchema.parse({
  accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region:          process.env.AWS_DEFAULT_REGION,
  sessionToken:    process.env.AWS_SESSION_TOKEN,
  timeout:         process.env.AWS_TIMEOUT ? parseInt(process.env.AWS_TIMEOUT) : 30000,
});
```

### 4.5 工具返回格式（与 VT/AbuseIPDB 保持一致）

```typescript
// ✅ 正确：返回 MCP content 对象（而非裸字符串）
registerTool('lookup_events', '...', LookupEventsSchema.shape, async (args: unknown) => {
  const text = await handleLookupEvents(client, args as LookupEventsArgs);
  return { content: [{ type: 'text', text }] };
});
```

> **教训**：AbuseIPDB 集成时 handler 直接返回 `string` 导致 `JSONRPCResponse.result` 类型错误（`Input should be an object`），必须包装成 `{ content: [{ type: 'text', text }] }`。

### 4.6 Token 限制机制（AWS 系列重点要求）

AWS MCP 工具天然比其他工具更容易产生大量输出，**以下工具必须接入 Token 限制**：

| 工具 | 风险来源 |
|------|----------|
| CloudTrail `lake_query` / `get_query_results` | Trino SQL SELECT *，每行含 requestParameters / responseElements 大字段 |
| CloudWatch `query_logs` | Logs Insights 查询无行数限制时可返回大量日志行 |
| IAM `list_policies`（含策略文档展开） | 策略 JSON 逐条展开体积剧增 |
| EC2 `describe_instances`（大量实例） | 每个实例含 tags、security groups 等嵌套结构 |

**实现规范见** `docs/MCP_INTEGRATION_GUIDE.md` → Section 2.5（Token 限制机制）和 Section 10（完整说明）。

核心要点：
1. 添加 `tiktoken` 依赖
2. 复制 `src/utils/token-limiter.ts`
3. 工具 schema 加 `break_token_rule` 参数
4. `index.ts` 读取 `MAX_TOKEN_CALL`（默认 20000）并传入工具注册函数
5. 在 handler 调用后、`return` 前执行 `checkTokenLimit`

`lookup_events` 由于已内置 `maxResults` 上限（最大 50 条），且 handler 仅输出摘要字段（不含原始 CloudTrailEvent JSON），**无需**额外加 token 限制。

---

## 5. configSchema 模板

### AWS 系列 `config.js` configSchema（无 Hub/BYOK 切换）

```javascript
configSchema: {
  type: 'object',
  required: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_DEFAULT_REGION'],
  properties: {
    AWS_ACCESS_KEY_ID: {
      type: 'string',
      title: 'AWS Access Key ID',
      description: 'IAM user Access Key ID. Get it from AWS Console → IAM → Users → Security credentials → Create access key',
    },
    AWS_SECRET_ACCESS_KEY: {
      type: 'string',
      title: 'AWS Secret Access Key',
      description: 'IAM user Secret Access Key.',
      sensitive: true,
    },
    AWS_DEFAULT_REGION: {
      type: 'string',
      title: 'AWS Region',
      description: 'Target AWS region, e.g. us-east-1, ap-northeast-1',
      default: 'us-east-1',
    },
    AWS_SESSION_TOKEN: {
      type: 'string',
      title: 'Session Token (optional)',
      description: 'Required only when using temporary credentials (AssumeRole / AWS SSO).',
      sensitive: true,
    },
    AWS_TIMEOUT: {
      type: 'number',
      title: 'Request Timeout (ms)',
      description: 'HTTP request timeout in milliseconds.',
      default: 30000,
      minimum: 5000,
      maximum: 120000,
    },
  },
}
```

### `config.js` 启动环境变量

```javascript
// config.js env 字段（直接透传，无需 Hub 代理转换逻辑）
env: {
  AWS_ACCESS_KEY_ID: '',
  AWS_SECRET_ACCESS_KEY: '',
  AWS_DEFAULT_REGION: 'us-east-1',
  AWS_SESSION_TOKEN: '',
  AWS_TIMEOUT: '30000',
},
```

### `IntegrationMarket.tsx` 改动

AWS 系列**不需要** `keyMode` 转换逻辑，4 个 env var 直接写入 mcp_config.json，无需在 `createInstance` 函数中添加特殊处理。

---

## 6. AWS SDK v3 依赖说明

### 6.1 各服务对应的 npm 包

| MCP 模块 | npm 包 |
|----------|--------|
| `aws-cloudtrail-mcp` | `@aws-sdk/client-cloudtrail` |
| `aws-cloudwatch-mcp` | `@aws-sdk/client-cloudwatch-logs` + `@aws-sdk/client-cloudwatch` |
| `aws-iam-mcp` | `@aws-sdk/client-iam` |
| `aws-guardduty-mcp` | `@aws-sdk/client-guardduty` |
| `aws-securityhub-mcp` | `@aws-sdk/client-securityhub` |
| `aws-ec2-mcp` | `@aws-sdk/client-ec2` |
| `aws-s3-mcp` | `@aws-sdk/client-s3` |
| `aws-lambda-mcp` | `@aws-sdk/client-lambda` |

### 6.2 公共依赖（所有 AWS MCP 模块共享）

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "1.23.0",
    "zod": "^3.23.8",
    "express": "^4.18.2"
  }
}
```

> 不需要 `axios`（AWS SDK v3 自带 HTTP 客户端）。

### 6.3 包大小估算

AWS SDK v3 采用模块化设计，单个服务包通常 3-8 MB，加上公共依赖，打包后 tar.gz 预计 **10-15 MB**（含 node_modules）。

---

## 7. 集成开发 Checklist

> 以下 Checklist 在通用规范（`docs/MCP_INTEGRATION_GUIDE.md` § 8）基础上，增加 AWS 特有步骤。

### Step 0：IAM 权限准备（文档用户提示）

为每个 AWS MCP 模块准备最小权限 IAM Policy 示例，放在 `README.md` 中：

```json
// CloudTrail MCP 最小权限示例
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "cloudtrail:LookupEvents",
      "cloudtrail:ListEventDataStores",
      "cloudtrail:StartQuery",
      "cloudtrail:GetQueryResults"
    ],
    "Resource": "*"
  }]
}
```

### Step 1：创建 Node.js MCP Server

- [ ] 仓库命名：`TocharianOU/aws-<service>-mcp`
- [ ] 参考 `mcp-virustotal` / `abuseipdb-mcp` 目录结构
- [ ] `src/types.ts`：使用上方 `AWSConfigSchema`（4 个 AWS env var + timeout）
- [ ] `src/utils/api.ts`：使用 AWS SDK v3，支持无凭证启动
- [ ] `src/handlers/*.ts`：从 awslabs Python 版本的工具逻辑移植，参考其 `tools.py`
- [ ] `*-tools.ts`：使用 `(server as any).tool` 类型断言
- [ ] **工具回调返回 `{ content: [{ type: 'text', text }] }`，不能返回裸字符串**
- [ ] `index.ts`：启动时不检查凭证，stdio 模式
- [ ] 编译验证：`npm run build`

### Step 2：打包发布

- [ ] `scripts/create-release.sh`：包含 `node_modules` 在内打包
- [ ] 打包命令：`tar -czf ... dist logos node_modules LICENSE README.md server.json package.json`
- [ ] 验证包含 `node_modules`：`tar -tzf *.tar.gz | grep node_modules | head -1`
- [ ] 上传到 GitHub Release（tar.gz + sha256）

### Step 3：AttackTraceHub 集成配置

- [ ] 创建 `AttackTraceHub/integrations/aws-<service>/config.js`
- [ ] `tags: ['Cloud']`（新增 Cloud 分类，与 SIEM / TI 区分）
- [ ] `configSchema`：使用上方 AWS 模板（无 keyMode）
- [ ] Logo：AWS 官方橙色风格 SVG（48×48 和 240×120）
- [ ] **无需**在 `AttackTraceHub/src/routes/` 创建代理路由
- [ ] **无需**修改 `IntegrationMarket.tsx` 的 keyMode 逻辑
- [ ] 运行 `npx prisma db seed`

### Step 4：验证

- [ ] Marketplace 安装，填写 AWS 凭证
- [ ] mcp-host 日志确认 `Starting aws-<service>-mcp in Stdio mode`
- [ ] 调用工具验证端到端（如 `lookup_events` 查询近 1 天 CloudTrail 事件）
- [ ] 验证无效凭证时返回工具错误（而非进程崩溃）
