export default {
  name: 'Shodan',
  version: '1.0.1',
  downloadUrl: 'https://github.com/TocharianOU/mcp-shodan/releases/download/v1.0.1/mcp-shodan-v1.0.1.tar.gz',

  description: 'IP exposure analysis, internet device search, batch DNS resolution, and CVE intelligence with KEV/EPSS prioritization for attack surface management',
  descriptionI18n: {
    en: 'IP exposure analysis, internet device search, batch DNS resolution, and CVE intelligence with KEV/EPSS prioritization for attack surface management',
    zh: 'IP 资产暴露分析、互联网设备搜索（含高级过滤）、批量 DNS 解析，以及含 KEV 状态、EPSS 评分和勒索软件关联的 CVE 漏洞情报'
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

Internet intelligence platform for attack surface analysis and vulnerability research.
Query live internet data: exposed services, open ports, device banners, and CVE risk scores.

## Tools

- **ip_lookup** – Full reconnaissance report for an IP address: geolocation, open ports, running services, SSL certificate chain, reverse hostnames, and cloud provider identification (AWS/Azure/GCP/etc.)
- **shodan_search** – Search Shodan's live device database using advanced filter syntax (e.g. \`port:22 country:CN org:"Amazon"\`, \`product:nginx vuln:CVE-2021-44228\`). Returns per-device service details plus country-level distribution statistics. Use \`max_results\` to cap response size
- **dns_lookup** – Batch-resolve multiple hostnames to IP addresses in a single call
- **reverse_dns_lookup** – Batch reverse-DNS: find all hostnames associated with a list of IPs. Useful for pivoting from network IOCs to domain infrastructure
- **cve_lookup** – Detailed intelligence for a specific CVE ID. Returns: CVSS v2/v3 scores, EPSS exploitation probability + percentile ranking, KEV (CISA Known Exploited Vulnerabilities) status, ransomware gang associations, proposed mitigations, and full affected CPE list
- **cpe_lookup** – Search CPE entries by product name to get standardized platform identifiers. Use before \`cves_by_product\` to find the exact CPE 2.3 string
- **cves_by_product** – List all CVEs for a product or CPE 2.3 identifier. Key filters: \`is_kev: true\` (exploited-in-wild only), \`sort_by_epss: true\` (highest exploitation probability first), date range filtering, and pagination for large result sets

## Configuration

- **Access Mode**: \`Hub Key\` (platform-managed API key, zero setup) or \`Custom Key (BYOK)\` (your own Shodan API key for direct access)
- **SHODAN_API_KEY**: Required in BYOK mode. Free keys have limited search credits; paid plans unlock the full Search API. Get yours at https://account.shodan.io

## Investigation Workflow

1. \`ip_lookup ip:"<suspicious-IP>"\` → identify exposed services and cloud provider
2. \`shodan_search query:"net:<CIDR> port:3389"\` → find RDP-exposed hosts in a network range
3. \`reverse_dns_lookup ips:["<IP1>","<IP2>"]\` → resolve attacker IPs to hostnames for pivoting
4. \`cve_lookup cve:"CVE-2021-44228"\` → check exploit risk: EPSS score, KEV status, ransomware gangs
5. \`cves_by_product product:"Apache Log4j" is_kev:true sort_by_epss:true\` → get prioritized CVE list`,

  documentI18n: {
    zh: `# Shodan MCP 服务器

互联网情报平台，用于攻击面分析和漏洞研究。查询实时互联网数据：暴露服务、开放端口、设备 Banner 和 CVE 风险评分。

## 工具

- **ip_lookup** – IP 地址完整侦察报告：地理位置、开放端口、运行服务、SSL 证书链、反向主机名以及云服务商识别（AWS/Azure/GCP 等）
- **shodan_search** – 使用高级过滤语法搜索 Shodan 实时设备数据库（如 \`port:22 country:CN org:"Amazon"\`、\`product:nginx vuln:CVE-2021-44228\`）。返回每台设备的服务详情及国家分布统计，支持 \`max_results\` 控制结果数量
- **dns_lookup** – 单次调用批量解析多个域名为 IP 地址
- **reverse_dns_lookup** – 批量反向 DNS：根据 IP 列表查找关联主机名，适用于网络 IOC 到域名基础设施的溯源
- **cve_lookup** – 指定 CVE ID 的详细漏洞情报：CVSS v2/v3 评分、EPSS 利用概率及百分位排名、KEV（CISA 已知被利用漏洞）状态、勒索软件团伙关联、修复建议及受影响 CPE 列表
- **cpe_lookup** – 按产品名搜索 CPE 标准化平台标识符，在调用 \`cves_by_product\` 前用于获取精确的 CPE 2.3 字符串
- **cves_by_product** – 查询影响指定产品或 CPE 2.3 标识符的所有 CVE。支持过滤：\`is_kev: true\`（仅已被利用漏洞）、\`sort_by_epss: true\`（按利用概率降序）、日期范围过滤和分页

## 配置说明

- **访问模式**：\`Hub 密钥\`（平台托管 API 密钥，无需配置）或\`自定义密钥（BYOK）\`（使用自己的 Shodan API 密钥直连）
- **SHODAN_API_KEY**：BYOK 模式下必填。免费密钥有搜索配额限制；付费计划解锁完整 Search API。获取地址：https://account.shodan.io

## 调查工作流

1. \`ip_lookup ip:"<可疑IP>"\` → 识别暴露的服务和云服务商
2. \`shodan_search query:"net:<CIDR> port:3389"\` → 查找网段内 RDP 暴露主机
3. \`reverse_dns_lookup ips:["<IP1>","<IP2>"]\` → 将攻击者 IP 解析为域名进行关联溯源
4. \`cve_lookup cve:"CVE-2021-44228"\` → 检查漏洞利用风险：EPSS 评分、KEV 状态、勒索软件团伙
5. \`cves_by_product product:"Apache Log4j" is_kev:true sort_by_epss:true\` → 获取优先级排序的 CVE 列表`
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
