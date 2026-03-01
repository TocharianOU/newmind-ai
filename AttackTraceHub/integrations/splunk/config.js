export default {
  name: 'Splunk',
  version: '1.0.1',
  downloadUrl: 'https://github.com/TocharianOU/splunk-mcp/releases/download/v1.0.1/splunk-mcp-v1.0.1.tar.gz',

  description: 'Splunk SIEM integration for SPL search, index discovery, sourcetype enumeration, and saved search management',
  descriptionI18n: {
    en: 'Splunk MCP Server for SOC/DFIR – execute SPL queries with job polling, health check with server info, list indexes with event counts and size, discover indexes and sourcetypes via tstats, and manage saved searches and alerts',
    zh: 'Splunk MCP 服务器，面向 SOC/DFIR 场景，支持 SPL 查询执行（含作业轮询）、服务器健康检查、索引列表（含事件数和大小）、通过 tstats 发现索引和 sourcetype，以及保存搜索与告警管理'
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

Splunk SIEM integration for SOC/DFIR investigations. Executes SPL queries, discovers indexes and sourcetypes, and manages saved searches.

## Tools

- **search_splunk** – Execute any SPL query against Splunk. Polls job status until completion, returns formatted results with field headers. Supports \`earliest_time\`/\`latest_time\` for time range, \`max_count\` to cap result rows
- **splunk_health_check** – Test connection to Splunk, retrieve server info (version, OS, CPU arch), and list installed apps. Use to verify credentials before investigation
- **list_indexes** – List all Splunk indexes with event count, current size (MB), max size (MB), and earliest/latest event time. Helps identify which indexes contain relevant data
- **get_index_info** – Get detailed metadata for a specific index: paths, replica config, event counts, and time range
- **get_indexes_and_sourcetypes** – Discover all active indexes and their sourcetypes using \`tstats\`. Returns a mapping of \`index → [sourcetypes]\` — ideal for scoping an investigation
- **list_saved_searches** – List all saved searches and alerts with schedule, search query, and last run time. Useful for understanding existing detection coverage

## Configuration

- **SPLUNK_HOST**: Hostname or IP of your Splunk instance (e.g. \`splunk.corp.com\`)
- **SPLUNK_PORT**: Management port, default \`8089\`
- **SPLUNK_USERNAME** / **SPLUNK_PASSWORD**: Standard credentials for basic auth
- **SPLUNK_TOKEN**: Bearer token (alternative to username/password)
- **SPLUNK_SCHEME**: \`https\` (default) or \`http\`

## Investigation Workflow
1. \`splunk_health_check\` → verify connection and see available apps
2. \`get_indexes_and_sourcetypes\` → map all indexes and their sourcetypes
3. \`list_indexes\` → identify indexes with recent data (check latest event time)
4. \`search_splunk spl:"index=main sourcetype=syslog earliest=-1h | stats count by host"\` → hunt for anomalies`,

  documentI18n: {
    zh: `# Splunk MCP 服务器

Splunk SIEM 集成，用于 SOC/DFIR 调查。支持执行 SPL 查询、发现索引和 sourcetype、管理保存的搜索。

## 工具

- **search_splunk** – 对 Splunk 执行任意 SPL 查询，轮询作业状态直到完成，返回格式化结果。支持时间范围和结果数量限制
- **splunk_health_check** – 测试 Splunk 连接，获取服务器信息（版本、操作系统、CPU 架构）及已安装应用列表
- **list_indexes** – 列出所有 Splunk 索引，含事件数、当前大小（MB）、最大大小（MB）以及最早/最晚事件时间
- **get_index_info** – 获取指定索引的详细元数据：路径、副本配置、事件数和时间范围
- **get_indexes_and_sourcetypes** – 通过 \`tstats\` 发现所有活跃索引及其 sourcetype，返回 \`索引 → [sourcetype 列表]\` 映射
- **list_saved_searches** – 列出所有保存的搜索和告警，含调度时间、SPL 查询和最后运行时间

## 调查工作流
1. \`splunk_health_check\` → 验证连接并查看可用应用
2. \`get_indexes_and_sourcetypes\` → 映射所有索引和 sourcetype
3. \`list_indexes\` → 识别有近期数据的索引
4. \`search_splunk\` → 执行 SPL 查询进行威胁狩猎`
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
