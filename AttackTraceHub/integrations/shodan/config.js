export default {
  name: 'Shodan',
  version: '1.0.0',
  downloadUrl: 'https://github.com/TocharianOU/mcp-shodan/releases/download/v1.0.0/mcp-shodan-v1.0.0.tar.gz',

  description: 'Network reconnaissance and vulnerability intelligence via Shodan',
  descriptionI18n: {
    en: 'Shodan MCP Server for IP reconnaissance, device search, DNS operations, and CVE intelligence',
    zh: 'Shodan MCP 服务器，用于 IP 侦察、设备搜索、DNS 解析和 CVE 漏洞情报'
  },

  tags: ['TI'],

  transport: 'stdio',
  command: 'node',
  args: ['{{install_path}}/dist/index.js'],
  env: {
    SHODAN_API_KEY: '',
    SHODAN_BASE_URL: '',
    SHODAN_AUTH_TOKEN: '',
  },

  planRequired: 'BASE',
  logo: '/integrations/shodan/logo-48.svg',
  banner: '/integrations/shodan/logo-240.svg',

  document: `# Shodan MCP Server

Network intelligence and vulnerability research powered by Shodan.

## Features
- IP address reconnaissance: open ports, services, banners, cloud provider
- Internet device search with geographic distribution
- Forward and reverse DNS lookups
- CVE details: CVSS v2/v3, EPSS score, KEV status, ransomware associations
- CPE lookups and product-specific vulnerability tracking
- Supports Hub-managed key and custom BYOK

## Configuration
Choose your access mode:
- **Hub Key**: No setup required. The platform manages the API key and routes requests through a secure proxy.
- **Custom Key (BYOK)**: Enter your own Shodan API key for direct access.

## Usage Examples
- Investigate suspicious IPs from security alerts
- Check exposure of internet-facing assets
- Research CVE severity before patching decisions
- Enumerate vulnerable product versions across the internet`,

  documentI18n: {
    en: `# Shodan MCP Server

Network intelligence and vulnerability research powered by Shodan.

## Features
- IP address reconnaissance: open ports, services, banners, cloud provider
- Internet device search with geographic distribution
- Forward and reverse DNS lookups
- CVE details: CVSS v2/v3, EPSS score, KEV status, ransomware associations
- CPE lookups and product-specific vulnerability tracking
- Supports Hub-managed key and custom BYOK`,
    zh: `# Shodan MCP 服务器

通过 Shodan 提供网络情报和漏洞研究服务。

## 功能特性
- IP 地址侦察：开放端口、服务、Banner、云服务商识别
- 互联网设备搜索，含地理分布统计
- 正向和反向 DNS 解析
- CVE 详情：CVSS v2/v3、EPSS 评分、KEV 状态、勒索软件关联
- CPE 查询和产品维度漏洞追踪
- 支持 Hub 托管密钥和自带密钥（BYOK）

## 配置说明
选择您的访问模式：
- **Hub 密钥**：无需配置，平台自动管理 API 密钥并通过安全代理路由请求。
- **自定义密钥（BYOK）**：输入您自己的 Shodan API 密钥，直接访问 Shodan API。`
  },

  configSchema: {
    type: 'object',
    required: ['keyMode'],
    properties: {
      keyMode: {
        type: 'string',
        title: 'Access Mode',
        description: 'Choose how to authenticate with Shodan',
        enum: ['hub', 'byok'],
        enumNames: ['Hub Key (Platform Managed)', 'Custom Key (BYOK)'],
        default: 'hub'
      },
      SHODAN_API_KEY: {
        type: 'string',
        title: 'Shodan API Key',
        description: 'Your personal Shodan API key. Required when using Custom Key mode. Get yours at https://account.shodan.io',
        sensitive: true
      },
      SHODAN_TIMEOUT: {
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
            required: ['SHODAN_API_KEY']
          }
        ]
      }
    }
  },

  tokenCost: 0.05,
  tokenRequired: 0.05,
  tokenPriceUnit: 'request',
  popular: false,
  new: true,
  isActive: true
}
