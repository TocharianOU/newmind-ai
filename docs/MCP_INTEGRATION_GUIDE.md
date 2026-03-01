# MCP Integration Guide

> 本文档记录了向 AttackTrace 平台添加新 MCP 工具集成的完整流程、目录结构规范、打包要求和常见错误，以便今后快速复用。
>
> 参考实现：VirusTotal（首个成功集成，2026-02）

---

## 目录

1. [整体架构](#1-整体架构)
2. [MCP Server 项目规范](#2-mcp-server-项目规范)
3. [集成配置文件规范](#3-集成配置文件规范)
4. [打包发布规范](#4-打包发布规范)
5. [双模式集成设计（Hub Key / BYOK）](#5-双模式集成设计hub-key--byok)
6. [Hub 代理路由实现](#6-hub-代理路由实现)
7. [前端 SchemaForm 扩展](#7-前端-schemaform-扩展)
8. [完整集成流程 Checklist](#8-完整集成流程-checklist)
9. [已知错误与解决方案](#9-已知错误与解决方案)
10. [Token 限制机制（防 Context 爆炸）](#10-token-限制机制防-context-爆炸)
11. [GitHub 仓库管理规范](#11-github-仓库管理规范)
12. [版本与发布管理规范](#12-版本与发布管理规范)
13. [数据库与前端缓存更新流程](#13-数据库与前端缓存更新流程)

---

## 1. 整体架构

```
用户在 Marketplace 选择工具并配置
        ↓
AttackTraceHub (OAP 后端) 将工具信息写入 DB
        ↓
Electron App 通过 IPC 向 mcp-host 发送 create_instance 请求
        ↓
mcp-host (Python FastAPI) 下载并安装 tar.gz 包
        ↓
mcp-host 以 stdio 子进程方式启动 Node.js MCP Server
        ↓
AI 通过 MCP 协议调用工具
```

### 关键组件路径

| 组件 | 路径 |
|------|------|
| 集成配置目录 | `AttackTraceHub/integrations/<name>/` |
| 集成种子脚本 | `AttackTraceHub/prisma/seed.js` |
| 包安装目录 | `~/.attacktrace/mcp-packages/<Name>@<version>/` |
| mcp-host 实例管理 | `mcp-host/attacktrace_mcp_host/oap_plugin/instance_manager.py` |
| mcp-host 包管理 | `mcp-host/attacktrace_mcp_host/oap_plugin/package_manager.py` |
| Marketplace 前端 | `src/views/Drawer/IntegrationMarket.tsx` |
| 配置表单组件 | `src/views/Overlay/Tools/Popup/SchemaForm.tsx` |
| 后端路由目录 | `AttackTraceHub/src/routes/` |

---

## 2. MCP Server 项目规范

参考 `list_tool/mcp-server-kibana` 的完整结构。

### 2.1 目录结构

```
mcp-<toolname>/
├── dist/                    # 编译输出（必须包含在发布包中）
│   └── index.js             # 主入口（编译后）
├── src/
│   ├── handlers/            # 每种资源类型的请求处理器
│   │   ├── index.ts
│   │   ├── url.ts
│   │   ├── file.ts
│   │   └── ip.ts
│   ├── formatters/          # API 响应格式化为可读文本
│   │   ├── index.ts
│   │   └── url.ts
│   ├── schemas/
│   │   └── index.ts         # Zod 工具参数 schema
│   ├── types/
│   │   └── <toolname>.ts    # TypeScript 接口定义
│   └── utils/
│       └── api.ts           # HTTP 请求封装
├── <toolname>-tools.ts      # 工具注册入口（每类资源一个文件）
├── index.ts                 # 主入口（支持 stdio / streamable-http）
├── src/types.ts             # 配置 schema（Zod）
├── node_modules/            # 必须包含！打包时不能排除
├── package.json
├── tsconfig.json
├── .eslintrc.json
├── .prettierrc
├── .nvmrc                   # 指定 Node.js 版本（如 22.14.0）
├── .gitignore
├── .env                     # 本地开发用（不提交）
├── .env.example             # 示例配置（提交）
├── server.json              # MCP 注册清单
├── NOTICE                   # 版权声明
├── LICENSE                  # MIT
├── README.md
├── RELEASE.md
├── renovate.json
└── scripts/
    └── create-release.sh
```

### 2.2 `index.ts` 关键要求

**启动时不能抛出错误**，即使凭据未配置。凭据检查应推迟到工具被实际调用时（届时 API 会返回 401，作为工具错误返回给 AI）。

```typescript
// ❌ 错误做法：启动时检查凭据
function createClient(config: Config) {
  if (!config.apiKey && !config.authToken) {
    throw new Error('No credentials configured'); // 这会导致进程在 MCP handshake 前退出
  }
}

// ✅ 正确做法：允许无凭据启动，API 调用失败时返回错误
function createClient(config: Config) {
  const headers: Record<string, string> = {};
  if (config.apiKey) {
    headers['x-apikey'] = config.apiKey;
  } else if (config.authToken) {
    headers['Authorization'] = `Bearer ${config.authToken}`;
  }
  // 没有凭据时创建空 headers 的 client，API 调用会返回 401
  return axios.create({ baseURL, headers, timeout: config.timeout });
}
```

### 2.3 支持双模式认证的 `src/types.ts`

```typescript
export const ConfigSchema = z.object({
  apiKey:    z.string().optional().describe('Direct API key (BYOK mode)'),
  baseUrl:   z.string().optional().describe('Override base URL; set to proxy endpoint for Hub mode'),
  authToken: z.string().optional().describe('Bearer token for proxy authentication (Hub mode)'),
  timeout:   z.number().optional().default(30000),
});
```

### 2.5 Token 限制机制（必须实现的防护规范）

**参考实现**：`list_tool/elasticsearch-mcp/src/token-limiter.ts`

当工具返回结果体积较大（如 ES 搜索、CloudTrail Lake 查询、CloudWatch 日志）时，未经限制的输出会将大量 token 压入 AI context window，轻则降低回答质量，重则因超出窗口上限导致整个对话崩溃。

#### 2.5.1 适用场景

以下类型的工具**必须**加入 token 限制机制：

| 工具类型 | 典型代表 | 风险说明 |
|----------|----------|----------|
| 全文搜索 / 日志查询 | `es_search`、CloudWatch `query_logs` | 原始 JSON 文档可达数十 KB |
| SQL 分析查询 | CloudTrail `lake_query` / `get_query_results` | SELECT * 50行 × 大字段可达 MB 级 |
| 批量资源列表 | IAM `list_policies`、S3 `list_objects` | 策略文档逐条展开时体积剧增 |

以下工具**无需**强制加入（输出天然有界）：
- IP/域名/文件 单条情报查询（VirusTotal、AbuseIPDB、Shodan）
- 简单状态查询（CloudTrail `lookup_events` 已内置 maxResults=10/50 上限）

#### 2.5.2 核心实现

新建 `src/utils/token-limiter.ts`（每个需要限制的 MCP 项目都复制一份）：

```typescript
import { encoding_for_model, TiktokenModel } from 'tiktoken';

export interface TokenCheckResult {
  allowed: boolean;
  tokens: number;
  error?: string;
}

/**
 * 精确计算文本的 token 数（使用 tiktoken，GPT-4 分词器）。
 * tiktoken 失败时 fallback 到 text.length / 4 粗估。
 */
export function calculateTokens(text: string, model: TiktokenModel = 'gpt-4'): number {
  try {
    const encoding = encoding_for_model(model);
    const tokens = encoding.encode(text);
    const count = tokens.length;
    encoding.free();
    return count;
  } catch {
    return Math.ceil(text.length / 4);
  }
}

/**
 * 检查工具返回结果是否超出 token 上限。
 * @param result     工具返回的完整结果对象（将被 JSON.stringify 计算 token）
 * @param maxTokens  最大允许 token 数
 * @param breakRule  true = 紧急绕过（跳过检查，直接放行）
 */
export function checkTokenLimit(
  result: unknown,
  maxTokens: number,
  breakRule = false
): TokenCheckResult {
  if (breakRule) return { allowed: true, tokens: 0 };

  const text = JSON.stringify(result);
  const tokens = calculateTokens(text);

  if (tokens > maxTokens) {
    return {
      allowed: false,
      tokens,
      error: `Token limit exceeded: result contains ${tokens} tokens (limit: ${maxTokens}).\n\n` +
        'Suggestions:\n' +
        '1. Reduce the size/limit parameters in your query\n' +
        '2. Narrow down the time range or date filters\n' +
        '3. Add more specific query filters to reduce result set\n' +
        '4. Use aggregations instead of raw documents when possible\n' +
        '5. If absolutely necessary, retry with break_token_rule: true\n\n' +
        'Note: Frequent use of break_token_rule may cause context overflow and degraded AI performance.',
    };
  }

  return { allowed: true, tokens };
}
```

**依赖**：在 `package.json` 中加入 `"tiktoken": "^1.0.7"`（与 elasticsearch-mcp 保持一致）。

#### 2.5.3 在工具注册中接入

工具 schema 中暴露 `break_token_rule` 参数，handler 执行完后检查结果：

```typescript
// 在 *-tools.ts 的 schema 定义中加入
break_token_rule: z
  .boolean()
  .optional()
  .default(false)
  .describe(
    'Set to true to bypass token limits in critical situations. ' +
    'Use sparingly to avoid context overflow.'
  ),

// 在 handler 调用后、return 前执行检查
const resultContent = { content: [{ type: 'text', text }] };
const tokenCheck = checkTokenLimit(resultContent, maxTokenCall, break_token_rule);
if (!tokenCheck.allowed) {
  return {
    content: [{ type: 'text', text: tokenCheck.error ?? 'Token limit exceeded' }],
    isError: true,
  };
}
return resultContent;
```

#### 2.5.4 `MAX_TOKEN_CALL` 环境变量

Token 上限通过环境变量配置，在 MCP Server 初始化时读取：

```typescript
// index.ts 或 server 初始化处
const maxTokenCall = parseInt(process.env.MAX_TOKEN_CALL ?? '20000', 10);
// 作为参数传入各工具注册函数
registerLakeTools(server, config, maxTokenCall);
```

在 `config.js` 的 `configSchema` 中为用户暴露（可选）：

```javascript
MAX_TOKEN_CALL: {
  type: 'number',
  title: 'Max Token Per Call',
  description: 'Maximum tokens allowed per tool call result (default: 20000).',
  default: 20000,
  minimum: 1000,
  maximum: 200000,
}
```

#### 2.5.5 设计原则总结

| 原则 | 说明 |
|------|------|
| **拒绝而非截断** | 超限时返回 `isError: true` + 建议，而非静默截断。截断会导致 AI 基于不完整数据产生错误结论。 |
| **紧急绕过开关** | 提供 `break_token_rule` 参数，允许 AI 在知情情况下主动绕过，而非强行拦截。 |
| **上限可配** | 默认 20,000 tokens 适合大多数场景，生产环境可按模型窗口调整。 |
| **仅对大结果工具启用** | 单条情报查询、简单状态查询无需此机制，避免不必要的 tiktoken 开销。 |

---

### 2.4 工具注册中的 TypeScript 深层类型问题

MCP SDK 与 Zod 的复杂类型推断可能导致 `TS2589: Type instantiation is excessively deep` 错误。

**解决方案**：在每个 `*-tools.ts` 文件中使用类型断言绕过：

```typescript
// 在工具注册文件顶部加这一行
const registerTool = (server as any).tool.bind(server) as (
  name: string, description: string, shape: unknown, cb: (args: unknown) => unknown
) => void;

// 然后用 registerTool 代替 server.tool
registerTool('get_report', 'Get report', schema, async (args) => { ... });
```

---

## 3. 集成配置文件规范

### 3.1 目录结构

```
AttackTraceHub/integrations/
├── _template/
│   └── config.js            # 模板，新集成从这里复制
├── elasticsearch/
│   ├── config.js
│   ├── logo-48.svg
│   └── logo-240.svg
├── kibana/
│   ├── config.js
│   ├── logo-48.svg
│   └── logo-240.svg
└── <newname>/               # 新建目录名小写，用于路由和文件系统
    ├── config.js
    ├── logo-48.svg          # 48×48 用于列表图标
    └── logo-240.svg         # 240×120 用于卡片 banner
```

> **Logo SVG 规范**
>
> Tool 列表和集成市场的 logo **统一从 Hub 后端加载**（`http://localhost:23000/integrations/<name>/logo-48.svg`）。
> logo **只需维护一处**：`AttackTraceHub/integrations/<name>/logo-*.svg`，**不需要**放入 tarball。
>
> 1. **禁止使用 `<text>` 元素**渲染字符（字体在浏览器/Electron 中不可保证）；**只用几何图形**：`<rect>` `<circle>` `<line>` `<path>` `<polyline>` `<polygon>`。
> 2. **推荐风格**：纯色背景（`#FF9900` 橙色或 `#232F3E` 深色）+ 对比色几何图形，48px 下仍清晰可辨。

### 3.2 `config.js` 完整字段说明

```javascript
export default {
  // --- 基本信息 ---
  name: 'ToolName',          // 显示名称（首字母大写），同时作为 DB 唯一键
  version: '1.0.0',          // 与 GitHub Release tag 对应
  downloadUrl: 'https://github.com/TocharianOU/<repo>/releases/download/v1.0.0/<name>-v1.0.0.tar.gz',

  description: '一行简短描述',
  descriptionI18n: {
    en: 'English description',
    zh: '中文描述'
  },

  tags: ['SIEM'],            // 只用第一个 tag 作为分类（影响 Marketplace 分类筛选）
                             // 已有分类：'SIEM', 'TI'（威胁情报）

  // --- 启动配置（stdio）---
  transport: 'stdio',
  command: 'node',
  args: ['{{install_path}}/dist/index.js'],  // {{install_path}} 自动替换为包安装路径
  env: {                     // 环境变量默认值（用户可覆盖）
    API_KEY: '',
    API_URL: '',
  },

  // --- 访问控制 ---
  planRequired: 'BASE',      // 'BASE' | 'PRO' | 'ENTERPRISE'

  // --- 图标（路径相对于 /integrations/ 静态目录）---
  logo: '/integrations/<name>/logo-48.svg',
  banner: '/integrations/<name>/logo-240.svg',

  // --- 文档（Markdown 格式）---
  document: `# Tool Name\n\n...`,
  documentI18n: {
    en: `# Tool Name\n\n...`,
    zh: `# 工具名称\n\n...`
  },

  // --- 配置表单 Schema（JSON Schema）---
  configSchema: {
    type: 'object',
    required: ['API_URL'],
    properties: {
      API_URL: {
        type: 'string',
        title: 'Service URL',
        format: 'uri'
      },
      API_KEY: {
        type: 'string',
        title: 'API Key',
        sensitive: true    // 显示为密码框，支持 System Keychain
      },
      timeout: {
        type: 'number',
        title: 'Timeout (ms)',
        default: 30000,
        minimum: 1000,
        maximum: 120000
      },
      tlsMode: {
        type: 'string',
        title: 'SSL/TLS',
        enum: ['skip', 'default', 'ca-cert'],
        default: 'skip'    // 前端自动转换为 NODE_TLS_REJECT_UNAUTHORIZED
      }
    },
    // 多认证模式用 oneOf（前端 SchemaForm 支持）
    oneOf: [
      { title: 'API Key Auth', required: ['API_URL', 'API_KEY'] },
      { title: 'Basic Auth',   required: ['API_URL', 'username', 'password'],
        properties: {
          username: { type: 'string', title: 'Username' },
          password: { type: 'string', title: 'Password', sensitive: true }
        }
      }
    ]
  },

  // --- 计费 ---
  tokenCost: 0.1,
  tokenRequired: 0.1,
  tokenPriceUnit: 'request',

  // --- 展示标志 ---
  popular: false,
  new: true,
  isActive: true
}
```

### 3.3 `configSchema` 支持的字段类型

| 类型 | 渲染方式 | 特殊属性 |
|------|----------|----------|
| `string` | 文本输入框 | `sensitive: true` → 密码框 + Keychain 选项 |
| `string` + `format: "uri"` | 文本输入框（URL） | — |
| `string` + `format: "file"` | 文件路径选择器 | — |
| `string` + `enum: [...]` | 下拉选择框 | `enumNames: [...]`（数组）或 `enumLabels: {}`（对象）提供显示标签 |
| `number` | 数字输入框 | `minimum`, `maximum`, `default` |
| `boolean` | Toggle Switch | — |
| `oneOf` (顶层) | 认证模式选择器 | `title` 字段作为选项名 |
| `dependencies.<field>.oneOf` | 条件字段显隐 | 见下方双模式设计 |

### 3.4 前端特殊转换规则

`IntegrationMarket.tsx` 在提交配置时会对以下字段做特殊处理：

| 字段 | 转换逻辑 |
|------|----------|
| `tlsMode = 'skip'` | → `NODE_TLS_REJECT_UNAUTHORIZED = '0'`，删除 tlsMode |
| `tlsMode = 'default'/'ca-cert'` | → `NODE_TLS_REJECT_UNAUTHORIZED = '1'`，删除 tlsMode |
| `keyMode = 'hub'` | → 注入 `VIRUSTOTAL_BASE_URL` + `VIRUSTOTAL_AUTH_TOKEN`（OAP token），删除 keyMode 和 API_KEY |
| `keyMode = 'byok'` | → 保留 `VIRUSTOTAL_API_KEY`，删除 hub 相关变量，删除 keyMode |

如需为新工具添加类似的模式切换逻辑，在 `IntegrationMarket.tsx` 的 `createInstance` 函数的 `tlsMode` 处理之后添加。

---

## 4. 打包发布规范

### 4.1 ⚠️ 关键要求：tar.gz 必须平铺且包含 node_modules

**mcp-host 的 `package_manager.py` 行为**：
- 将 tar.gz 解压到 `~/.attacktrace/mcp-packages/<Name>@<version>/`
- `{{install_path}}` = 该目录
- **不会自动运行 npm install**
- 检查 `install_path/node_modules` 是否存在，不存在只警告不报错

因此 tar.gz 必须满足：

```
# ✅ 正确结构（平铺，含 node_modules）
./dist/index.js          ← install_path/dist/index.js 对应 args 配置
./dist/index.js.map
./node_modules/          ← 必须包含！
./package.json
./README.md
...

# ❌ 错误结构（多了一层子目录）
./mcp-virustotal/dist/index.js   ← 会导致 args 路径找不到文件
./mcp-virustotal/node_modules/
```

### 4.2 正确的打包命令

```bash
cd /path/to/mcp-<toolname>

# 先编译
node --max-old-space-size=8192 ./node_modules/.bin/tsc

# 打包（从项目根目录出发，平铺结构）
tar -czf ../mcp-<toolname>-v1.0.0.tar.gz \
  --exclude='.git' \
  --exclude='*.tar.gz' \
  --exclude='*.sha256' \
  --exclude='*.sha512' \
  --exclude='.env' \
  --exclude='logs' \
  -C . .

# 生成校验和
shasum -a 256 ../mcp-<toolname>-v1.0.0.tar.gz > ../mcp-<toolname>-v1.0.0.tar.gz.sha256
```

关键是 `-C . .`：切换到项目目录后打包当前目录，避免出现子目录前缀。

### 4.3 验证打包结构

```bash
# 检查 dist/index.js 是否在根层
tar -tzf mcp-<toolname>-v1.0.0.tar.gz | grep "dist/index.js" | head -3
# 应该看到：./dist/index.js   而不是 ./mcp-<toolname>/dist/index.js

# 检查 node_modules 是否包含
tar -tzf mcp-<toolname>-v1.0.0.tar.gz | grep "^./node_modules/" | head -3
# 应该有输出

# 大小检查（含 node_modules 通常 5MB+）
ls -lh mcp-<toolname>-v1.0.0.tar.gz
```

### 4.4 上传到 GitHub Release

> **命名规则**：Release 的 `--title` 必须与 tag 保持一致，统一为 `v{version}`（如 `v1.0.1`），**不要**加项目名前缀。

```bash
GITHUB_TOKEN="your_token"
REPO="TocharianOU/mcp-<toolname>"
RELEASE_ID="xxxxxxx"   # 从 API 获取：curl https://api.github.com/repos/$REPO/releases/tags/v1.0.0

# 上传 tar.gz
curl -X POST \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Content-Type: application/gzip" \
  --data-binary @mcp-<toolname>-v1.0.0.tar.gz \
  "https://uploads.github.com/repos/$REPO/releases/$RELEASE_ID/assets?name=mcp-<toolname>-v1.0.0.tar.gz"

# 上传校验和
curl -X POST \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Content-Type: text/plain" \
  --data-binary @mcp-<toolname>-v1.0.0.tar.gz.sha256 \
  "https://uploads.github.com/repos/$REPO/releases/$RELEASE_ID/assets?name=mcp-<toolname>-v1.0.0.tar.gz.sha256"
```

### 4.5 版本更新时清理缓存

```bash
# 如果已有用户安装了旧版本，更新 release 后需要手动清理缓存
rm -rf ~/.attacktrace/mcp-packages/<Name>@<old_version>
```

---

## 5. 双模式集成设计（Hub Key / BYOK）

适用于需要 API Key 的第三方服务（如 VirusTotal、Shodan、GreyNoise 等）。

### 5.1 设计原则

| 模式 | 用户体验 | 技术实现 |
|------|----------|----------|
| **Hub Key** | 零配置，平台托管 | MCP → 本地 OAP 代理 → 注入 key → 第三方 API |
| **BYOK** | 用户填写自己的 key | MCP → 直连第三方 API |

### 5.2 MCP Server 环境变量约定

| 变量名 | 用途 | 模式 |
|--------|------|------|
| `<SERVICE>_API_KEY` | 直接访问的 API key | BYOK |
| `<SERVICE>_BASE_URL` | 代理端点 URL | Hub |
| `<SERVICE>_AUTH_TOKEN` | 访问 OAP 代理的 Bearer token（OAP device JWT） | Hub |
| `<SERVICE>_TIMEOUT` | 超时时间（毫秒） | 两者 |

`<SERVICE>_AUTH_TOKEN` 与 medium model 使用的 OAP device token 机制完全一致——本地进程向后端服务鉴权的统一方式。

### 5.3 `config.js` 中的双模式 configSchema

```javascript
configSchema: {
  type: 'object',
  required: ['keyMode'],
  properties: {
    keyMode: {
      type: 'string',
      title: 'Access Mode',
      enum: ['hub', 'byok'],
      enumNames: ['Hub Key (Platform Managed)', 'Custom Key (BYOK)'],
      default: 'hub'
    },
    <SERVICE>_API_KEY: {
      type: 'string',
      title: 'API Key',
      description: 'Your personal API key. Required for BYOK mode.',
      sensitive: true
    },
  },
  dependencies: {
    keyMode: {
      oneOf: [
        { properties: { keyMode: { enum: ['hub'] } } },
        {
          properties: { keyMode: { enum: ['byok'] } },
          required: ['<SERVICE>_API_KEY']
        }
      ]
    }
  }
}
```

**工作原理**：`SchemaForm.tsx` 读取 `schema.dependencies` 中的 `oneOf` 分支，当 `keyMode = 'hub'` 时自动隐藏 `<SERVICE>_API_KEY` 字段。

### 5.4 前端 keyMode 转换（`IntegrationMarket.tsx`）

在 `createInstance` 函数中，`tlsMode` 转换之后已经添加了通用的 `keyMode` 处理逻辑：

```javascript
if (stringifiedConfig.keyMode !== undefined) {
  const keyMode = stringifiedConfig.keyMode
  delete stringifiedConfig.keyMode

  if (keyMode === 'hub') {
    delete stringifiedConfig.<SERVICE>_API_KEY
    stringifiedConfig.<SERVICE>_BASE_URL = `${OAP_ROOT_URL}/api/<service>-proxy/v3`
    try {
      const token = await window.ipcRenderer.oapGetToken()
      stringifiedConfig.<SERVICE>_AUTH_TOKEN = token || '{{device_token}}'
    } catch {
      stringifiedConfig.<SERVICE>_AUTH_TOKEN = '{{device_token}}'
    }
  } else {
    delete stringifiedConfig.<SERVICE>_BASE_URL
    delete stringifiedConfig.<SERVICE>_AUTH_TOKEN
  }
}
```

> **注意**：每个新工具都需要在这段逻辑里添加对应的 `<SERVICE>_BASE_URL` 和 `<SERVICE>_AUTH_TOKEN` 变量名，并在后端创建对应的代理路由。

### 5.5 mcp-host 的 `{{device_token}}` 模板变量

`instance_manager.py` 在创建实例时会将 env 变量中的 `{{device_token}}` 替换为实际的 OAP device token：

```python
# mcp-host/attacktrace_mcp_host/oap_plugin/instance_manager.py
if request.env:
    resolved_env = {}
    for k, v in request.env.items():
        if isinstance(v, str) and "{{device_token}}" in v:
            v = v.replace("{{device_token}}", self.device_token or "")
        resolved_env[k] = v
    config_params["env"] = resolved_env
```

这是一个后备机制——如果前端 `oapGetToken()` IPC 调用失败，`{{device_token}}` 会在 mcp-host 侧被解析。

---

## 6. Hub 代理路由实现

### 6.1 路由文件模板

新建 `AttackTraceHub/src/routes/<service>-proxy.js`：

```javascript
import express from 'express';
import fetch from 'node-fetch';
import { authenticateToken } from '../middleware/auth.js';
import { prisma } from '../config/database.js';
import logger from '../utils/logger.js';

const router = express.Router();
const UPSTREAM_API = 'https://api.<service>.com/v3';

// 透明代理：验证 OAP JWT → 注入服务 API Key → 转发请求
router.all('/*', authenticateToken, async (req, res) => {
  const apiKey = process.env.<SERVICE>_HUB_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: '<Service> Hub integration not configured' });
  }

  const targetUrl = `${UPSTREAM_API}${req.path}${req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}`;
  logger.info(`[<Service>-Proxy] ${req.method} ${targetUrl} (user: ${req.user.email})`);

  const fetchOptions = {
    method: req.method,
    headers: {
      // 替换 OAP JWT 为真实 API key
      'x-apikey': apiKey,          // 按各服务要求调整 header 名
      'Accept': req.headers['accept'] || 'application/json',
      'Content-Type': req.headers['content-type'] || 'application/json',
    },
  };

  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
    fetchOptions.body = JSON.stringify(req.body);
  }

  let response;
  try {
    response = await fetch(targetUrl, fetchOptions);
  } catch (err) {
    return res.status(502).json({ error: 'Failed to reach upstream API', details: err.message });
  }

  // 异步记录用量（不阻塞响应）
  prisma.usageRecord.create({
    data: { userId: req.user.id, modelName: '<service>-hub', inputTokens: 1, outputTokens: 0, cost: 0.0001 }
  }).catch(() => {});

  res.status(response.status);
  ['content-type'].forEach(h => { const v = response.headers.get(h); if (v) res.setHeader(h, v); });
  response.body.pipe(res);
});

export default router;
```

### 6.2 在 `server.js` 注册路由

```javascript
// server.js
import <service>ProxyRoutes from './routes/<service>-proxy.js';

// 挂载点格式：/api/<service>-proxy/<api_version>
// 需与前端 IntegrationMarket.tsx 中注入的 BASE_URL 一致
app.use('/api/<service>-proxy/v3', <service>ProxyRoutes);
```

### 6.3 在 `.env` 添加 Hub API Key

```bash
# AttackTraceHub/.env
<SERVICE>_HUB_API_KEY=your_actual_api_key_here
```

---

## 7. 前端 SchemaForm 扩展

`SchemaForm.tsx` 支持的条件显隐机制（`visibleFields` useMemo）：

### 7.1 已内置逻辑

| 字段 | 规则 |
|------|------|
| `tlsMode` | 非 `ca-cert` 时隐藏 `ES_CA_CERT` / `KIBANA_CA_CERT` |
| `schema.dependencies` (通用) | 读取 `oneOf` 分支，当前值匹配某分支时，隐藏其他分支的 required 字段 |

### 7.2 通用 `dependencies` 实现原理

```javascript
// SchemaForm.tsx visibleFields useMemo 中
if (schema.dependencies) {
  for (const [depField, depSchema] of Object.entries(schema.dependencies)) {
    if (!depSchema?.oneOf) continue
    const depValue = formData[depField] ?? schema.properties?.[depField]?.default
    if (depValue === undefined) continue
    for (const branch of depSchema.oneOf) {
      const branchEnum = branch.properties?.[depField]?.enum
      if (!branchEnum) continue
      if (!branchEnum.includes(depValue) && branch.required) {
        branch.required.forEach(f => fields.delete(f))  // 隐藏非活跃分支的字段
      }
    }
  }
}
```

这意味着只要 `config.js` 的 `configSchema.dependencies` 按规范写，`SchemaForm` 就能自动处理条件显隐，**无需修改 `SchemaForm.tsx`**。

### 7.3 `enumNames` 支持

Select 下拉框支持两种标签格式：
- `enumLabels: { 'hub': 'Hub Key', 'byok': 'Custom Key' }` — 对象格式
- `enumNames: ['Hub Key', 'Custom Key']` — 数组格式（与 enum 数组对齐）

两者都已在 `SchemaForm.tsx` 中支持。

---

## 8. 完整集成流程 Checklist

### Step 1：创建 MCP Server 项目

- [ ] Fork 或新建 `mcp-<toolname>` 仓库（参考 `mcp-server-kibana` 结构）
- [ ] 版权头统一使用 `TocharianOU`，不提及 AttackTrace
- [ ] `src/types.ts`：定义 `ConfigSchema`（支持 apiKey / baseUrl / authToken 三变量模式）
- [ ] `index.ts`：移除启动时的凭据检查，允许无凭据启动
- [ ] 所有 `*-tools.ts`：使用类型断言 `(server as any).tool` 避免 TS2589 错误
- [ ] 编译验证：`node --max-old-space-size=8192 ./node_modules/.bin/tsc`
- [ ] 本地测试：`node dist/index.js`（应正常启动，输出 `Starting ... in Stdio mode`）

### Step 2：打包发布

- [ ] 使用 `-C . .` 命令打包（平铺结构，含 node_modules）
- [ ] 验证 `dist/index.js` 在根层：`tar -tzf *.tar.gz | grep "^./dist/index.js"`
- [ ] 验证含 node_modules：`tar -tzf *.tar.gz | grep "^./node_modules/" | head -1`
- [ ] 包大小应 > 5MB（通常 10-20MB，视 deps 而定）
- [ ] 创建 GitHub Release tag（`v1.0.0`）
- [ ] 上传 tar.gz 和 sha256 到 Release Assets

### Step 3：添加集成配置

- [ ] 创建 `AttackTraceHub/integrations/<name>/` 目录
- [ ] 创建 `logo-48.svg`（48×48）和 `logo-240.svg`（240×120）**（只用几何图形，禁止 `<text>` 元素）**
- [ ] 创建 `config.js`（参考上方规范，`name` 字段与 DB 唯一键一致）
- [ ] 运行 `npx prisma db seed` 写入数据库
- [ ] 验证 Marketplace 能显示新集成

### Step 4：Hub 代理路由（如需 Hub 模式）

- [ ] 创建 `AttackTraceHub/src/routes/<service>-proxy.js`
- [ ] 在 `server.js` 注册：`app.use('/api/<service>-proxy/v3', routes)`
- [ ] 在 `.env` 添加 `<SERVICE>_HUB_API_KEY=xxx`
- [ ] 在 `IntegrationMarket.tsx` 的 `keyMode` 处理块中添加该服务的变量注入逻辑

### Step 5：验证

- [ ] 在 Marketplace 安装集成（Hub 模式）
- [ ] 检查 mcp-host 日志：确认 MCP Server 正常启动（`Starting ... in Stdio mode`）
- [ ] 调用一个工具（如查 IP 报告）确认端到端通路

---

## 9. 已知错误与解决方案

### 9.1 `McpError: Connection closed`

**现象**：mcp-host 报 `Client initialization error`，`Connection closed`。

**原因**：MCP Server 进程在 MCP handshake（initialize）完成前退出了。

**常见触发点**：
1. 启动时凭据检查失败 → `process.exit(1)`
2. 包路径错误（`install_path/dist/index.js` 不存在）
3. 缺少 `node_modules`（ES module 找不到依赖包）

**排查**：
```bash
# 直接运行安装的包
node ~/.attacktrace/mcp-packages/<Name>@<version>/dist/index.js
# 如果立刻退出并有错误输出 → 找到原因
```

**修复清单**：
- 移除启动时的凭据 throw
- 修复 tar.gz 结构（平铺 + 含 node_modules）
- 清理旧缓存后重新安装：`rm -rf ~/.attacktrace/mcp-packages/<Name>@<version>`

### 9.2 `TS2589: Type instantiation is excessively deep`

**现象**：`tsc` 编译时报此错误，通常在 `*-tools.ts` 的 `server.tool(...)` 调用处。

**原因**：Zod schema 复杂类型与 MCP SDK 类型系统的推断深度超限。

**解决**：
```typescript
// 用类型断言绕过，在 *-tools.ts 顶部
const registerTool = (server as any).tool.bind(server) as (...) => void;
```

或将大型 `z.enum([...100 items...])` 改为 `z.string().refine(val => validValues.includes(val))`。

### 9.3 内存溢出 `JavaScript heap out of memory`

**现象**：`npx tsc` 或 `npm run build` 时 OOM。

**原因**：`npx tsc` 生成新进程，`NODE_OPTIONS` 环境变量不生效。

**解决**：
```bash
# 直接调用本地 tsc 并显式分配内存
node --max-old-space-size=8192 ./node_modules/.bin/tsc
```

### 9.4 tar.gz 路径结构错误（子目录问题）

**现象**：安装后 `install_path/dist/index.js` 不存在，实际文件在 `install_path/<reponame>/dist/index.js`。

**原因**：打包命令在项目父目录执行，把整个项目目录打进去了：
```bash
# ❌ 错误
tar -czf out.tar.gz mcp-virustotal/   # 内部是 mcp-virustotal/dist/index.js

# ✅ 正确
cd mcp-virustotal && tar -czf ../out.tar.gz -C . .   # 内部是 ./dist/index.js
```

### 9.5 `VIRUSTOTAL_HUB_API_KEY is not configured`（503）

**现象**：Hub 模式调用工具返回 503。

**原因**：`.env` 中 `VIRUSTOTAL_HUB_API_KEY` 未填写。

**解决**：在 `AttackTraceHub/.env` 中填入真实的 VirusTotal API key，重启后端。

### 9.6 SchemaForm 条件字段不响应

**现象**：切换 Hub/BYOK 模式后，字段显隐不变化。

**原因 A**：`config.js` 使用了 `dependencies` 但字段仍在 `schema.properties` 里定义，SchemaForm 默认全部显示。

**解决**：确认 `SchemaForm.tsx` 的 `visibleFields` 中包含了通用 `dependencies` 解析逻辑（已合并）。

**原因 B**：`enumNames` 格式不被识别（期望 `enumLabels` 对象格式）。

**解决**：`SchemaForm.tsx` 已同时支持 `enumNames`（数组）和 `enumLabels`（对象），两种格式都可以用。

---

## 10. Token 限制机制（防 Context 爆炸）

> 本节为设计规范摘要，完整实现说明见 [2.5 节](#25-token-限制机制必须实现的防护规范)。
>
> **参考实现**：`list_tool/elasticsearch-mcp/src/token-limiter.ts`（已在生产验证）

### 10.1 背景

MCP 工具返回的结果会直接进入 AI 的 context window。对于查询类工具，若不加限制：

- **AWS CloudTrail `lake_query` SELECT \***：50 行 × requestParameters/responseElements 大字段 → 可达数 MB
- **Elasticsearch `es_search`**：size=100 的全文文档 → 数百 KB
- **CloudWatch `query_logs`**：Logs Insights 查询结果 → 视日志量可达 MB

这些情况会导致 AI context 爆炸，轻则降低回答质量（早期 token 被驱逐），重则模型报错或产生幻觉。

### 10.2 机制一览

```
工具调用 → 执行 API → 获得结果
                            ↓
                   checkTokenLimit(result, maxTokenCall, break_token_rule)
                            ↓
              ┌─────────────┴──────────────┐
         超限（allowed=false）          未超限（allowed=true）
              ↓                               ↓
    返回 isError: true                  正常返回结果
    + 5 条优化建议                      （包含实际 token 数可用于调试）
    + 提示可用 break_token_rule: true
```

### 10.3 核心文件

| 文件 | 职责 |
|------|------|
| `src/utils/token-limiter.ts` | `calculateTokens()` + `checkTokenLimit()`，每个 MCP 项目各自维护一份 |
| `index.ts` 初始化处 | 读取 `MAX_TOKEN_CALL` 环境变量（默认 20000），传入工具注册函数 |
| `*-tools.ts` 工具注册 | schema 中加 `break_token_rule` 参数；调用 handler 后执行 token 检查 |
| `config.js` configSchema | 暴露 `MAX_TOKEN_CALL` 字段供用户在 Marketplace 配置页调整 |

### 10.4 适用工具类型判断

```
工具返回结果是否可能超过 20,000 tokens？
    │
    ├─ 否（单条情报查询 / 简单状态）→ 无需加入，避免 tiktoken 开销
    │    例：check_ip、lookup_events（已有 maxResults 上限）
    │
    └─ 是（批量 / SQL / 全文日志）→ 必须加入
         例：lake_query、get_query_results、es_search、
             query_logs、list_policies（含策略文档展开）
```

### 10.5 用户可见行为

当 AI 调用某工具且结果超限时，AI 会收到：

```
Token limit exceeded: result contains 45230 tokens (limit: 20000).

Suggestions:
1. Reduce the size/limit parameters in your query
2. Narrow down the time range or date filters
3. Add more specific query filters to reduce result set
4. Use aggregations instead of raw documents when possible
5. If absolutely necessary, retry with break_token_rule: true

Note: Frequent use of break_token_rule may cause context overflow and degraded AI performance.
```

AI 会据此自动调整查询策略（缩小时间窗口、加过滤条件、改用聚合等），或在用户明确要求时以 `break_token_rule: true` 重试。

### 10.6 Checklist

在 Checklist 的 Step 1（创建 MCP Server）中需要额外验证：

- [ ] 判断是否存在可能返回大量数据的工具（见 10.4）
- [ ] 如有，在 `package.json` 中添加 `"tiktoken"` 依赖
- [ ] 创建 `src/utils/token-limiter.ts`
- [ ] 工具 schema 中加入 `break_token_rule` 参数
- [ ] `index.ts` 读取 `MAX_TOKEN_CALL` 环境变量并传入工具注册
- [ ] `config.js` 的 `configSchema` 中暴露 `MAX_TOKEN_CALL` 字段（可选但推荐）
