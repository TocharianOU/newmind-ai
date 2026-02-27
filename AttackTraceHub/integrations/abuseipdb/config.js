export default {
  name: 'AbuseIPDB',
  version: '1.0.0',
  downloadUrl: 'https://github.com/TocharianOU/abuseipdb-mcp/releases/download/v1.0.0/abuseipdb-mcp-v1.0.0.tar.gz',

  description: 'IP reputation intelligence and threat blacklist via AbuseIPDB',
  descriptionI18n: {
    en: 'AbuseIPDB MCP Server for IP reputation checks, abuse confidence scoring, CIDR block analysis, and threat blacklist',
    zh: 'AbuseIPDB MCP 服务器，用于 IP 声誉检查、滥用置信度评分、CIDR 网段分析和威胁黑名单查询'
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

IP reputation intelligence powered by AbuseIPDB — the world's largest collaborative database of reported malicious IP addresses.

## Features
- Single IP reputation check with abuse confidence score (0–100%) and risk level
- Bulk check up to 100 IP addresses in one call with flagged-IP summary
- CIDR network block analysis with per-address confidence breakdown *(subscription required)*
- Threat blacklist retrieval with confidence distribution and country statistics *(subscription required)*
- Supports Hub-managed key and custom BYOK

## Configuration
Choose your access mode:
- **Hub Key**: No setup required. The platform manages the API key and routes requests through a secure proxy.
- **Custom Key (BYOK)**: Enter your own AbuseIPDB API key for direct access. Get yours at https://www.abuseipdb.com/account/api

## Usage Examples
- Check reputation of IPs extracted from security alerts or firewall logs
- Bulk-validate a list of suspicious IP addresses from an incident
- Investigate CIDR blocks linked to attack campaigns
- Enrich SOC alerts with abuse confidence scores and reporter statistics`,

  documentI18n: {
    en: `# AbuseIPDB MCP Server

IP reputation intelligence powered by AbuseIPDB — the world's largest collaborative database of reported malicious IP addresses.

## Features
- Single IP reputation check with abuse confidence score (0–100%) and risk level
- Bulk check up to 100 IP addresses in one call with flagged-IP summary
- CIDR network block analysis with per-address confidence breakdown *(subscription required)*
- Threat blacklist retrieval with confidence distribution and country statistics *(subscription required)*
- Supports Hub-managed key and custom BYOK`,
    zh: `# AbuseIPDB MCP 服务器

基于 AbuseIPDB 的 IP 声誉情报服务——全球最大的恶意 IP 协作举报数据库。

## 功能特性
- 单 IP 声誉检查：滥用置信度评分（0–100%）和风险等级
- 批量检查最多 100 个 IP，含被标记 IP 汇总
- CIDR 网段分析：每个地址的置信度分布 *（需要订阅）*
- 威胁黑名单查询：置信度分布和国家统计 *（需要订阅）*
- 支持 Hub 托管密钥和自带密钥（BYOK）

## 配置说明
选择您的访问模式：
- **Hub 密钥**：无需配置，平台自动管理 API 密钥并通过安全代理路由请求。
- **自定义密钥（BYOK）**：输入您自己的 AbuseIPDB API 密钥。前往 https://www.abuseipdb.com/account/api 获取。`
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

  tokenCost: 0.03,
  tokenRequired: 0.03,
  tokenPriceUnit: 'request',
  popular: false,
  new: true,
  isActive: true
}
