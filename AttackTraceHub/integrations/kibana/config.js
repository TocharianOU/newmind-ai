export default {
  name: 'Kibana',
  version: '0.7.3',
  downloadUrl: 'https://github.com/TocharianOU/mcp-server-kibana/releases/download/v0.7.3/mcp-server-kibana-v0.7.3.tar.gz',
  
  description: 'Saved object CRUD, dashboard health scanning, dependency impact analysis, and arbitrary API access for Kibana management with multi-space support',
  descriptionI18n: {
    en: 'Saved object CRUD, dashboard health scanning, dependency impact analysis, and arbitrary API access for Kibana management with multi-space support',
    zh: '保存对象增删改查、仪表板健康扫描、依赖影响分析和完整 API 执行，支持多 Space 及 API Key / 基础认证 / Cookie 三种认证方式'
  },
  
  tags: ['SIEM'],  // Primary category only
  
  transport: 'stdio',
  command: 'node',
  args: ['{{install_path}}/dist/index.js'],
  env: {
    KIBANA_URL: '',
    KIBANA_API_KEY: '',
    KIBANA_USERNAME: '',
    KIBANA_PASSWORD: '',
    KIBANA_DEFAULT_SPACE: 'default'
  },
  
  planRequired: 'BASE',
  logo: '/integrations/kibana/logo-48.svg',
  banner: '/integrations/kibana/logo-240.svg',
  
  document: `# Kibana MCP Server

Full Kibana management integration with 16 tools across four capability groups.
Manage saved objects, analyze dashboard health, discover API endpoints, and execute arbitrary Kibana REST API calls.

## Tools

### Connectivity & API Access
- **get_status** – Retrieve Kibana server status, version, and plugin health
- **get_available_spaces** – List all Kibana spaces with current context; use to switch target space for subsequent operations
- **execute_kb_api** – Execute **any** Kibana REST API directly. Accepts \`method\` (GET/POST/PUT/DELETE/PATCH), \`path\`, \`body\`, and \`headers\`. Covers any operation not provided by the other tools

### API Discovery
- **search_kibana_api_paths** – Full-text search across all available Kibana API paths. Use to discover the right endpoint when you know what you want to do but not the exact path
- **list_all_kibana_api_paths** – List every documented Kibana API path. Returns a comprehensive reference for building \`execute_kb_api\` calls
- **get_kibana_api_detail** – Get full parameter schema and description for a specific API path

### Dashboard & Object Health Analysis
- **check_dashboard_health** – Run a health check on a specific dashboard. Detects broken visualization references, missing index patterns, and performance issues. Returns a health score with actionable findings
- **scan_all_dashboards_health** – Scan every dashboard in a Kibana space and produce a summary health report. Identifies broken dashboards at scale before users notice
- **analyze_object_dependencies** – Trace the full dependency tree of a saved object (dashboard → visualizations → index patterns). Essential before modifying shared objects
- **analyze_deletion_impact** – Predict what breaks if a saved object is deleted or modified. Shows all dependent objects that will be affected. Run before any destructive operation

### Saved Object CRUD
- **vl_search_saved_objects** – Search across any saved object type using ES query syntax. Supports \`types\` filter, \`fields\` projection, \`perPage\`, and \`page\` for full pagination. Covers: dashboard, visualization, index-pattern, search, lens, map, tag, canvas-workpad, etc.
- **vl_get_saved_object** – Fetch a single saved object by exact \`type\` + \`id\`. Faster than searching when you have the ID
- **vl_create_saved_object** – Create any saved object type with full attribute control. \`title\` is required for most types; complex fields like \`panelsJSON\` and \`visState\` must be JSON strings
- **vl_update_saved_object** – Partial update a single saved object. Only specified attributes change; use \`version\` for optimistic concurrency control
- **vl_bulk_update_saved_objects** – Update multiple saved objects of mixed types in one call. More efficient than repeated single updates
- **vl_bulk_delete_saved_objects** – Permanently delete multiple saved objects. **Irreversible.** Use \`analyze_deletion_impact\` first. Objects in multiple namespaces require \`force: true\`

## Configuration

- **KIBANA_URL**: Kibana endpoint (e.g. \`https://localhost:5601\`)
- **Authentication** (choose one):
  - \`KIBANA_API_KEY\` — recommended for production
  - \`KIBANA_USERNAME\` + \`KIBANA_PASSWORD\` — basic auth
  - \`KIBANA_COOKIES\` — session cookie (useful for SSO environments)
- **KIBANA_DEFAULT_SPACE**: Target space for all operations (default: \`default\`)
- **SSL/TLS Mode**: \`skip\` / \`default\` / \`ca-cert\` (same as Elasticsearch integration)

## Investigation Workflow

1. \`get_status\` → verify Kibana is healthy and check version
2. \`get_available_spaces\` → list spaces to find the right target
3. \`scan_all_dashboards_health\` → identify broken dashboards in bulk
4. \`analyze_object_dependencies id:"<dashboard-id>" type:"dashboard"\` → map what a dashboard depends on before modifying
5. \`analyze_deletion_impact id:"<index-pattern-id>" type:"index-pattern"\` → check impact before removing a shared index pattern`,

  documentI18n: {
    zh: `# Kibana MCP 服务器

完整的 Kibana 管理集成，包含 16 个工具，分为四大功能组：保存对象管理、仪表板健康分析、API 发现和任意 API 执行。

## 工具

### 连接 & API 执行
- **get_status** – 获取 Kibana 服务器状态、版本和插件健康信息
- **get_available_spaces** – 列出所有 Kibana Space 及当前上下文；用于切换后续操作的目标 Space
- **execute_kb_api** – **直接执行任意** Kibana REST API。接受 \`method\`（GET/POST/PUT/DELETE/PATCH）、\`path\`、\`body\` 和 \`headers\`，覆盖其他工具未提供的所有操作

### API 发现
- **search_kibana_api_paths** – 全文搜索所有可用 Kibana API 路径，适合知道目标但不确定具体路径时使用
- **list_all_kibana_api_paths** – 列出所有已文档化的 Kibana API 路径，作为构建 \`execute_kb_api\` 调用的完整参考
- **get_kibana_api_detail** – 获取指定 API 路径的完整参数 Schema 和说明

### 仪表板 & 对象健康分析
- **check_dashboard_health** – 对指定仪表板执行健康检查，检测断开的可视化引用、缺失索引模式和性能问题，返回健康评分和可操作的发现
- **scan_all_dashboards_health** – 扫描一个 Space 内所有仪表板并生成汇总健康报告，在用户发现问题前识别损坏的仪表板
- **analyze_object_dependencies** – 追踪保存对象的完整依赖树（仪表板 → 可视化 → 索引模式），修改共享对象前必须先调用
- **analyze_deletion_impact** – 预测删除或修改保存对象会导致哪些内容损坏，显示所有受影响的依赖对象，任何破坏性操作前必须先运行

### 保存对象 CRUD
- **vl_search_saved_objects** – 使用 ES 查询语法搜索任意类型的保存对象，支持 \`types\` 过滤、\`fields\` 投影、\`perPage\` 和 \`page\` 完整分页
- **vl_get_saved_object** – 通过精确 \`type\` + \`id\` 获取单个保存对象，有 ID 时比搜索更快
- **vl_create_saved_object** – 创建任意类型保存对象，完整属性控制。大多数类型需要 \`title\`；\`panelsJSON\`、\`visState\` 等复杂字段须为 JSON 字符串
- **vl_update_saved_object** – 部分更新单个保存对象，仅修改指定属性；使用 \`version\` 进行乐观并发控制
- **vl_bulk_update_saved_objects** – 一次调用更新多个混合类型的保存对象，比多次单独更新更高效
- **vl_bulk_delete_saved_objects** – 永久删除多个保存对象。**不可恢复**，操作前先调用 \`analyze_deletion_impact\`。存在于多个命名空间的对象需要 \`force: true\`

## 配置说明

- **KIBANA_URL**：Kibana 端点（如 \`https://localhost:5601\`）
- **认证方式**（三选一）：
  - \`KIBANA_API_KEY\` — 生产环境推荐
  - \`KIBANA_USERNAME\` + \`KIBANA_PASSWORD\` — 基础认证
  - \`KIBANA_COOKIES\` — Session Cookie（适用于 SSO 环境）
- **KIBANA_DEFAULT_SPACE**：所有操作的目标 Space（默认：\`default\`）
- **SSL/TLS 模式**：\`skip\` / \`default\` / \`ca-cert\`（与 Elasticsearch 集成一致）

## 调查工作流

1. \`get_status\` → 验证 Kibana 健康状态并确认版本
2. \`get_available_spaces\` → 列出 Space，找到目标 Space
3. \`scan_all_dashboards_health\` → 批量识别损坏的仪表板
4. \`analyze_object_dependencies id:"<dashboard-id>" type:"dashboard"\` → 修改前梳理仪表板完整依赖树
5. \`analyze_deletion_impact\` → 删除共享资源前评估影响范围`
  },
  
  configSchema: {
    type: 'object',
    required: ['KIBANA_URL', 'tlsMode'],
    properties: {
      KIBANA_URL: {
        type: 'string',
        title: 'Kibana URL',
        description: 'Kibana server endpoint (e.g., https://localhost:5601)',
        format: 'uri'
      },
      KIBANA_API_KEY: {
        type: 'string',
        title: 'API Key',
        description: 'Kibana API key for authentication (recommended)',
        sensitive: true
      },
      KIBANA_USERNAME: {
        type: 'string',
        title: 'Username',
        description: 'Username for basic authentication'
      },
      KIBANA_PASSWORD: {
        type: 'string',
        title: 'Password',
        description: 'Password for basic authentication',
        sensitive: true
      },
      KIBANA_COOKIES: {
        type: 'string',
        title: 'Cookies',
        description: 'Session cookies for authentication',
        sensitive: true
      },
      KIBANA_DEFAULT_SPACE: {
        type: 'string',
        title: 'Default Space',
        description: 'Default Kibana space to operate in',
        default: 'default'
      },
      KIBANA_TIMEOUT: {
        type: 'number',
        title: 'Timeout (ms)',
        description: 'Request timeout in milliseconds',
        default: 30000,
        minimum: 1000,
        maximum: 120000
      },
      KIBANA_MAX_RETRIES: {
        type: 'number',
        title: 'Max Retries',
        description: 'Maximum number of retry attempts for failed requests',
        default: 3,
        minimum: 0,
        maximum: 10
      },
      tlsMode: {
        type: 'string',
        title: 'SSL/TLS Verification',
        description: 'Choose how to verify SSL/TLS certificates',
        enum: ['skip', 'default', 'ca-cert'],
        default: 'skip'
      },
      KIBANA_CA_CERT: {
        type: 'string',
        title: 'CA Certificate',
        description: 'Upload custom CA certificate file',
        format: 'file'
      }
    },
    oneOf: [
      {
        required: ['KIBANA_URL', 'KIBANA_API_KEY'],
        title: 'API Key Authentication'
      },
      {
        required: ['KIBANA_URL', 'KIBANA_USERNAME', 'KIBANA_PASSWORD'],
        title: 'Basic Authentication'
      },
      {
        required: ['KIBANA_URL', 'KIBANA_COOKIES'],
        title: 'Cookie Authentication'
      }
    ],
    dependencies: {
      tlsMode: {
        oneOf: [
          {
            properties: {
              tlsMode: { enum: ['ca-cert'] }
            },
            required: ['KIBANA_CA_CERT']
          },
          {
            properties: {
              tlsMode: { enum: ['skip', 'default'] }
            }
          }
        ]
      }
    }
  },
  
  tokenCost: 0.1,
  tokenRequired: 0.1,
  tokenPriceUnit: 'request',
  popular: true,
  new: false,
  isActive: true
}
