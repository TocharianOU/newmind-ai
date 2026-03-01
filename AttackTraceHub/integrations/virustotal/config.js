export default {
  name: 'VirusTotal',
  version: '1.0.1',
  downloadUrl: 'https://github.com/TocharianOU/mcp-virustotal/releases/download/v1.0.1/mcp-virustotal-v1.0.1.tar.gz',

  description: 'File, URL, IP, and domain threat intelligence via VirusTotal',
  descriptionI18n: {
    en: 'VirusTotal MCP Server for file, URL, IP address, and domain threat intelligence analysis',
    zh: 'VirusTotal MCP 服务器，用于文件、URL、IP 地址和域名的威胁情报分析'
  },

  tags: ['TI'],

  transport: 'stdio',
  command: 'node',
  args: ['{{install_path}}/dist/index.js'],
  env: {
    VIRUSTOTAL_API_KEY: '',
    VIRUSTOTAL_BASE_URL: '',
    VIRUSTOTAL_AUTH_TOKEN: '',
  },

  planRequired: 'BASE',
  logo: '/integrations/virustotal/logo-48.svg',
  banner: '/integrations/virustotal/logo-240.svg',

  document: `# VirusTotal MCP Server

Threat intelligence for files, URLs, IP addresses, and domains powered by VirusTotal.

## Features
- File hash reputation and scan reports
- URL analysis and safety assessment
- IP address geolocation and threat data
- Domain WHOIS and DNS intelligence
- Relationship and network graph queries
- Supports Hub-managed key and custom BYOK

## Configuration
Choose your access mode:
- **Hub Key**: No setup required. The platform manages the API key and routes requests through a secure proxy.
- **Custom Key (BYOK)**: Enter your own VirusTotal API key for direct access.

## Usage Examples
- Analyze suspicious file hashes from alerts
- Check URLs found in phishing emails
- Investigate IP addresses in network logs
- Enumerate domain infrastructure`,

  documentI18n: {
    en: `# VirusTotal MCP Server

Threat intelligence for files, URLs, IP addresses, and domains powered by VirusTotal.

## Features
- File hash reputation and scan reports
- URL analysis and safety assessment
- IP address geolocation and threat data
- Domain WHOIS and DNS intelligence
- Relationship and network graph queries
- Supports Hub-managed key and custom BYOK`,
    zh: `# VirusTotal MCP 服务器

通过 VirusTotal 提供文件、URL、IP 地址和域名的威胁情报服务。

## 功能特性
- 文件哈希信誉和扫描报告
- URL 分析和安全评估
- IP 地址地理位置和威胁数据
- 域名 WHOIS 和 DNS 情报
- 关系图和网络图谱查询
- 支持 Hub 托管密钥和自带密钥（BYOK）

## 配置说明
选择您的访问模式：
- **Hub 密钥**：无需配置，平台自动管理 API 密钥并通过安全代理路由请求。
- **自定义密钥（BYOK）**：输入您自己的 VirusTotal API 密钥，直接访问 VirusTotal API。`
  },

  configSchema: {
    type: 'object',
    required: ['keyMode'],
    properties: {
      keyMode: {
        type: 'string',
        title: 'Access Mode',
        description: 'Choose how to authenticate with VirusTotal',
        enum: ['hub', 'byok'],
        enumNames: ['Hub Key (Platform Managed)', 'Custom Key (BYOK)'],
        default: 'hub'
      },
      VIRUSTOTAL_API_KEY: {
        type: 'string',
        title: 'VirusTotal API Key',
        description: 'Your personal VirusTotal API key. Required when using Custom Key mode.',
        sensitive: true
      },
      VIRUSTOTAL_TIMEOUT: {
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
            required: ['VIRUSTOTAL_API_KEY']
          }
        ]
      }
    }
  },

  tokenCost: 0.05,
  tokenRequired: 0.05,
  tokenPriceUnit: 'request',
  popular: true,
  new: true,
  isActive: true
}
