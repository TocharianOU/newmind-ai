export default {
  name: 'AbuseIPDB',
  version: '1.0.1',
  downloadUrl: 'https://github.com/TocharianOU/abuseipdb-mcp/releases/download/v1.0.1/abuseipdb-mcp-v1.0.1.tar.gz',

  description: 'Community-reported IP reputation: single/bulk abuse confidence scoring, CIDR block analysis, and global blacklist up to 500K entries for SOC triage',
  descriptionI18n: {
    en: 'Community-reported IP reputation: single/bulk abuse confidence scoring, CIDR block analysis, and global blacklist up to 500K entries for SOC triage',
    zh: '基于社区众报的 IP 声誉情报：单个/批量滥用置信度评分、CIDR 网段分析、全球黑名单（最多 50 万条），适用于 SOC 告警快速研判'
  },

  tags: ['TI'],

  transport: 'stdio',
  command: 'node',
  args: ['{{install_path}}/dist/index.js'],
  env: {
    ABUSEIPDB_API_KEY: '',
    ABUSEIPDB_BASE_URL: '',
    ABUSEIPDB_AUTH_TOKEN: '',
  },

  planRequired: 'BASE',
  logo: '/integrations/abuseipdb/logo-48.svg',
  banner: '/integrations/abuseipdb/logo-240.svg',

  document: `# AbuseIPDB MCP Server

Community-powered IP reputation intelligence. Every check draws on millions of crowd-reported abuse incidents contributed by security teams worldwide.

## Tools

- **check_ip** – Single IP reputation lookup. Returns: abuse confidence score (0–100%), community risk level, ISP, usage type, country, total reports, and unique reporter count. Key params: \`max_age_days\` (1–365 lookback window, default 30), \`verbose\` (include individual report details), \`threshold\` (custom flagging cutoff, default 75%)
- **bulk_check** – Batch reputation check for up to 100 IPs in a single call. Returns a flagged-IP summary with confidence scores, risk levels, and ISP/country breakdown. Same \`max_age_days\` and \`threshold\` params as \`check_ip\`
- **check_block** – Check all reported IPs within a CIDR block (e.g. \`198.51.100.0/24\`). Returns network summary, total reported address count, and top threats sorted by confidence. \`confidence_threshold\` sets the high-risk cutoff. *(Requires AbuseIPDB subscription)*
- **get_blacklist** – Retrieve the global AbuseIPDB blacklist. Key params: \`confidence_minimum\` (25–100, default 90), \`limit\` up to **500,000 entries**, \`plain_text: true\` for raw IP list ready for firewall rules. *(Requires AbuseIPDB subscription)*

## Configuration

- **Access Mode**: \`Hub Key\` (platform-managed, zero setup) or \`Custom Key (BYOK)\` (your own AbuseIPDB API key)
- **ABUSEIPDB_API_KEY**: Required in BYOK mode. Free tier covers \`check_ip\` and \`bulk_check\`; \`check_block\` and \`get_blacklist\` require a paid subscription. Get yours at https://www.abuseipdb.com/account/api

## Investigation Workflow

1. \`check_ip ip_address:"<alert-IP>" verbose:true\` → full abuse history with individual report details
2. \`bulk_check ip_addresses:["<IP1>","<IP2>","<IP3>"] threshold:50\` → triage suspicious IPs from firewall logs in one call
3. \`check_block network:"<attacker-CIDR>"\` → assess entire network range linked to a campaign
4. \`get_blacklist confidence_minimum:100 limit:10000 plain_text:true\` → export high-confidence block list for firewall rules`,

  documentI18n: {
    zh: `# AbuseIPDB MCP 服务器

基于社区众报的 IP 声誉情报——全球最大的恶意 IP 协作举报数据库，数百万条安全团队贡献的滥用记录。

## 工具

- **check_ip** – 单 IP 声誉查询。返回：滥用置信度评分（0–100%）、社区风险等级、ISP、使用类型、国家、举报总数和唯一举报人数。关键参数：\`max_age_days\`（1–365 天回溯窗口，默认 30）、\`verbose\`（包含逐条举报详情）、\`threshold\`（自定义标记阈值，默认 75%）
- **bulk_check** – 单次调用批量检查最多 100 个 IP 的声誉。返回被标记 IP 汇总，含置信度评分、风险等级和 ISP/国家分布。支持与 \`check_ip\` 相同的 \`max_age_days\` 和 \`threshold\` 参数
- **check_block** – 检查 CIDR 网段（如 \`198.51.100.0/24\`）内所有被举报的 IP 地址。返回网段摘要、被举报地址总数以及按置信度排序的高危地址列表。\`confidence_threshold\` 控制高危认定阈值。*（需要 AbuseIPDB 订阅）*
- **get_blacklist** – 获取全球 AbuseIPDB 黑名单。关键参数：\`confidence_minimum\`（25–100，默认 90）、\`limit\` 最多 **50 万条**、\`plain_text: true\` 返回原始 IP 列表可直接用于防火墙规则。*（需要 AbuseIPDB 订阅）*

## 配置说明

- **访问模式**：\`Hub 密钥\`（平台托管，无需配置）或\`自定义密钥（BYOK）\`（使用自己的 AbuseIPDB API 密钥）
- **ABUSEIPDB_API_KEY**：BYOK 模式下必填。免费套餐支持 \`check_ip\` 和 \`bulk_check\`；\`check_block\` 和 \`get_blacklist\` 需要付费订阅。获取地址：https://www.abuseipdb.com/account/api

## 调查工作流

1. \`check_ip ip_address:"<告警IP>" verbose:true\` → 查看完整滥用历史和逐条举报详情
2. \`bulk_check ip_addresses:["<IP1>","<IP2>","<IP3>"] threshold:50\` → 一次调用批量研判防火墙日志中的可疑 IP
3. \`check_block network:"<攻击者CIDR>"\` → 评估攻击活动关联的整个网段
4. \`get_blacklist confidence_minimum:100 limit:10000 plain_text:true\` → 导出高置信度黑名单用于防火墙规则`
  },

  configSchema: {
    type: 'object',
    required: ['keyMode'],
    properties: {
      keyMode: {
        type: 'string',
        title: 'Access Mode',
        description: 'Choose how to authenticate with AbuseIPDB',
        enum: ['hub', 'byok'],
        enumNames: ['Hub Key (Platform Managed)', 'Custom Key (BYOK)'],
        default: 'hub'
      },
      ABUSEIPDB_API_KEY: {
        type: 'string',
        title: 'AbuseIPDB API Key',
        description: 'Your personal AbuseIPDB API key. Required when using Custom Key mode. Get yours at https://www.abuseipdb.com/account/api',
        sensitive: true
      },
      ABUSEIPDB_TIMEOUT: {
        type: 'number',
        title: 'Request Timeout (ms)',
        description: 'HTTP request timeout in milliseconds',
        default: 30000,
        minimum: 5000,
        maximum: 120000
      },
      MAX_TOKEN_CALL: {
        type: 'number',
        title: 'Max Token Limit',
        description: 'Maximum number of tokens allowed per tool call result. Prevents context window overflow. Set to 0 to disable.',
        default: 20000,
        minimum: 0,
        maximum: 200000
      }
    },
    dependencies: {
      keyMode: {
        oneOf: [
          {
            properties: {
              keyMode: { enum: ['hub'] }
            }
          },
          {
            properties: {
              keyMode: { enum: ['byok'] }
            },
            required: ['ABUSEIPDB_API_KEY']
          }
        ]
      }
    }
  },

  toolTier: 'C',
  unitPriceUsd: 0.02,
  popular: false,
  new: true,
  isActive: true
}
