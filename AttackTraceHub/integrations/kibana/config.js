export default {
  name: 'Kibana',
  version: '0.7.2',
  downloadUrl: 'https://github.com/TocharianOU/mcp-server-kibana/releases/download/v0.7.2/mcp-server-kibana-v0.7.2.tar.gz',
  
  description: 'Comprehensive Kibana management and visualization tools',
  descriptionI18n: {
    en: 'Kibana MCP Server with comprehensive API access for dashboards, visualizations, and data exploration',
    zh: 'Kibana MCP 服务器，提供仪表板、可视化和数据探索的全面 API 访问'
  },
  
  tags: ['Visualization', 'Dashboard', 'Analytics', 'Monitoring'],
  
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

Comprehensive Kibana management with full API coverage for dashboards, visualizations, and data exploration.

## Features
- Dashboard management and creation
- Visualization tools integration
- Index pattern management
- Saved objects operations
- Multi-space support
- Health and dependency analysis

## Configuration
Set the following environment variables:
- KIBANA_URL: Kibana endpoint
- KIBANA_API_KEY or KIBANA_USERNAME/KIBANA_PASSWORD: Authentication
- KIBANA_DEFAULT_SPACE: Default Kibana space (optional)
- NODE_TLS_REJECT_UNAUTHORIZED: Set to '0' for self-signed certs

## Usage Examples
- Create and manage dashboards
- Execute Kibana API calls
- Manage visualizations and saved objects
- Analyze dashboard health`,
  
  documentI18n: {
    en: `# Kibana MCP Server

Comprehensive Kibana management with full API coverage for dashboards, visualizations, and data exploration.

## Features
- Dashboard management and creation
- Visualization tools integration
- Index pattern management
- Saved objects operations
- Multi-space support
- Health and dependency analysis`,
    zh: `# Kibana MCP 服务器

全面的 Kibana 管理，提供仪表板、可视化和数据探索的完整 API 覆盖。

## 功能特性
- 仪表板管理和创建
- 可视化工具集成
- 索引模式管理
- 保存对象操作
- 多空间支持
- 健康状态和依赖分析`
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
