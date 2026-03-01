export default {
  name: 'Splunk',
  version: '1.0.1',
  downloadUrl: 'https://github.com/TocharianOU/splunk-mcp/releases/download/v1.0.1/splunk-mcp-v1.0.1.tar.gz',

  description: 'Async SPL search with job polling, tstats-based index and sourcetype discovery, saved search and alert inventory for Splunk SIEM threat hunting',
  descriptionI18n: {
    en: 'Async SPL search with job polling, tstats-based index and sourcetype discovery, saved search and alert inventory for Splunk SIEM threat hunting',
    zh: '异步 SPL 查询（作业轮询）、基于 tstats 的索引和 sourcetype 发现、保存搜索与告警清单，支持 Bearer Token 和用户名/密码认证，适用于 Splunk SIEM 威胁狩猎'
  },

  tags: ['SIEM'],

  transport: 'stdio',
  command: 'node',
  args: ['{{install_path}}/dist/index.js'],
  env: {
    SPLUNK_HOST: '',
    SPLUNK_PORT: '8089',
    SPLUNK_SCHEME: 'https',
    SPLUNK_USERNAME: '',
    SPLUNK_PASSWORD: '',
    SPLUNK_TOKEN: '',
    SPLUNK_VERIFY_SSL: 'false',
    SPLUNK_TIMEOUT: '30000',
    MAX_TOKEN_CALL: '20000',
  },

  planRequired: 'BASE',
  logo: '/integrations/splunk/logo-48.svg',
  banner: '/integrations/splunk/logo-240.svg',

  document: `# Splunk MCP Server

Splunk SIEM integration for SOC/DFIR investigations. All SPL searches run as async Splunk jobs —
the tool creates the job, polls until complete, then fetches and formats results.

## Tools

- **search_splunk** – Execute any SPL query. Creates an async search job, polls status until complete, then returns results with field headers. Key params: \`earliest_time\`/\`latest_time\` (e.g. \`-24h\`, \`-1h@h\`) for time scoping; \`max_count\` to cap result rows (default 100). Use full SPL including pipes, stats, eval, and subsearches
- **splunk_health_check** – Test connectivity, retrieve server info (Splunk version, OS, CPU arch, license type), and list all installed apps. Run first to verify credentials and confirm environment
- **list_indexes** – List every index with: event count, current disk size (MB), max size (MB), and earliest/latest event timestamp. Use to identify which indexes hold relevant data and whether they have recent activity
- **get_index_info** – Detailed metadata for a single index: data paths, replication factor, frozen/thawed paths, min/max timestamps, and event count breakdown
- **get_indexes_and_sourcetypes** – Runs an async \`tstats\` search to discover all active index/sourcetype combinations. Returns a \`index → [sourcetypes]\` map — use this to scope investigations before writing queries
- **list_saved_searches** – Inventory all saved searches and alerts: SPL query, schedule (cron), last run time, alert action type. Shows existing detection coverage and scheduled reports

## Configuration

- **SPLUNK_HOST**: Hostname or IP (e.g. \`splunk.corp.com\` or \`192.168.1.10\`)
- **SPLUNK_PORT**: Management API port, default \`8089\`
- **Authentication** (Token takes precedence over Username/Password if both are set):
  - \`SPLUNK_TOKEN\` — Splunk Bearer token (recommended; generate in Settings → Tokens)
  - \`SPLUNK_USERNAME\` + \`SPLUNK_PASSWORD\` — basic authentication
- **SPLUNK_SCHEME**: \`https\` (default) or \`http\`
- **SPLUNK_VERIFY_SSL**: \`false\` (default, ignores self-signed certs) or \`true\` (enforces cert validation)

## Investigation Workflow

1. \`splunk_health_check\` → confirm connection, check version and installed apps
2. \`get_indexes_and_sourcetypes\` → discover all \`index → sourcetype\` combinations to scope the investigation
3. \`list_indexes\` → check latest event times to confirm which indexes have recent data
4. \`search_splunk spl:"index=windows sourcetype=WinEventLog:Security EventCode=4625 earliest=-1h | stats count by src_ip, user | sort -count" max_count:50\` → find brute-force login failures
5. \`list_saved_searches\` → review existing detections to avoid duplicating alert logic`,

  documentI18n: {
    zh: `# Splunk MCP 服务器

Splunk SIEM 集成，面向 SOC/DFIR 调查。所有 SPL 搜索均以异步 Splunk 作业方式运行——工具创建作业、轮询至完成后返回格式化结果。

## 工具

- **search_splunk** – 执行任意 SPL 查询。创建异步搜索作业并轮询至完成，返回含字段标题的格式化结果。关键参数：\`earliest_time\`/\`latest_time\`（如 \`-24h\`、\`-1h@h\`）控制时间范围；\`max_count\` 限制结果行数（默认 100）。支持完整 SPL 包括管道、stats、eval 和子搜索
- **splunk_health_check** – 测试连通性，获取服务器信息（Splunk 版本、操作系统、CPU 架构、许可证类型）及已安装应用列表。首次使用时运行以验证凭据并确认环境
- **list_indexes** – 列出所有索引：事件数、当前磁盘大小（MB）、最大大小（MB）以及最早/最晚事件时间戳。用于确认哪些索引包含相关数据及是否有近期活动
- **get_index_info** – 单个索引的详细元数据：数据路径、复制因子、冻结/解冻路径、时间戳范围和事件数分布
- **get_indexes_and_sourcetypes** – 运行异步 \`tstats\` 搜索，发现所有活跃的 index/sourcetype 组合，返回 \`索引 → [sourcetype 列表]\` 映射——编写查询前用于界定调查范围
- **list_saved_searches** – 盘点所有保存的搜索和告警：SPL 查询、调度计划（cron）、最后运行时间、告警动作类型。展示现有检测覆盖范围和计划报告

## 配置说明

- **SPLUNK_HOST**：主机名或 IP（如 \`splunk.corp.com\` 或 \`192.168.1.10\`）
- **SPLUNK_PORT**：管理 API 端口，默认 \`8089\`
- **认证方式**（若同时设置，Token 优先级高于用户名/密码）：
  - \`SPLUNK_TOKEN\` — Splunk Bearer Token（推荐；在 Settings → Tokens 中生成）
  - \`SPLUNK_USERNAME\` + \`SPLUNK_PASSWORD\` — 基础认证
- **SPLUNK_SCHEME**：\`https\`（默认）或 \`http\`
- **SPLUNK_VERIFY_SSL**：\`false\`（默认，忽略自签名证书）或 \`true\`（强制证书验证）

## 调查工作流

1. \`splunk_health_check\` → 确认连接，检查版本和已安装应用
2. \`get_indexes_and_sourcetypes\` → 发现所有 \`index → sourcetype\` 组合，界定调查范围
3. \`list_indexes\` → 检查最晚事件时间，确认哪些索引有近期数据
4. \`search_splunk spl:"index=windows sourcetype=WinEventLog:Security EventCode=4625 earliest=-1h | stats count by src_ip, user | sort -count" max_count:50\` → 查找暴力破解登录失败
5. \`list_saved_searches\` → 审查现有检测规则，避免重复告警逻辑`
  },

  configSchema: {
    type: 'object',
    required: ['SPLUNK_HOST'],
    properties: {
      SPLUNK_HOST: {
        type: 'string',
        title: 'Splunk Host',
        description: 'Hostname or IP address of your Splunk instance (e.g. splunk.corp.com)',
      },
      SPLUNK_PORT: {
        type: 'string',
        title: 'Management Port',
        description: 'Splunk management API port',
        default: '8089'
      },
      SPLUNK_SCHEME: {
        type: 'string',
        title: 'Scheme',
        description: 'Connection scheme',
        default: 'https',
        enum: ['https', 'http']
      },
      SPLUNK_TOKEN: {
        type: 'string',
        title: 'Bearer Token',
        description: 'Splunk Bearer token. If provided, takes precedence over username/password.',
        sensitive: true
      },
      SPLUNK_USERNAME: {
        type: 'string',
        title: 'Username',
        description: 'Splunk username for basic authentication',
      },
      SPLUNK_PASSWORD: {
        type: 'string',
        title: 'Password',
        description: 'Splunk password for basic authentication',
        sensitive: true
      },
      SPLUNK_VERIFY_SSL: {
        type: 'string',
        title: 'SSL/TLS Verification',
        description: 'Choose how to verify SSL/TLS certificates. Use "false" for self-signed certs.',
        enum: ['false', 'true'],
        default: 'false'
      },
      SPLUNK_TIMEOUT: {
        type: 'string',
        title: 'Request Timeout (ms)',
        description: 'HTTP request timeout in milliseconds',
        default: '30000'
      },
      MAX_TOKEN_CALL: {
        type: 'string',
        title: 'Max Token Limit',
        description: 'Maximum tokens per tool call result. Prevents context window overflow.',
        default: '20000'
      }
    },
    oneOf: [
      {
        required: ['SPLUNK_HOST', 'SPLUNK_TOKEN'],
        title: 'Token Authentication'
      },
      {
        required: ['SPLUNK_HOST', 'SPLUNK_USERNAME', 'SPLUNK_PASSWORD'],
        title: 'Basic Authentication (Username / Password)'
      }
    ]
  },

  tokenCost: 0.03,
  tokenRequired: 0.03,
  tokenPriceUnit: 'request',
  popular: false,
  new: true,
  isActive: true
};
