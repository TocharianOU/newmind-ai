export default {
  name: 'Elasticsearch',
  version: '0.6.3',
  downloadUrl: 'https://github.com/TocharianOU/elasticsearch-mcp/releases/download/v0.6.3/elasticsearch-mcp-v0.6.3.tar.gz',
  
  description: 'Full version support (ES 5.x-9.x) with comprehensive API access',
  descriptionI18n: {
    en: 'Elasticsearch MCP Server with full version support (ES 5.x-9.x) and comprehensive API access',
    zh: 'Elasticsearch MCP 服务器，支持完整版本（ES 5.x-9.x）和全面的 API 访问'
  },
  
  tags: ['Search', 'Database', 'Analytics'],
  
  transport: 'stdio',
  command: 'node',
  args: ['{{install_path}}/dist/index.js'],
  env: {
    ES_URL: '',
    ES_API_KEY: '',
    ES_USERNAME: '',
    ES_PASSWORD: '',
    MAX_TOKEN_CALL: '8000'
  },
  
  planRequired: 'BASE',
  banner: 'https://raw.githubusercontent.com/elastic/elasticsearch/main/docs/src/test/resources/logos/elastic-logo.svg',
  
  document: `# Elasticsearch MCP Server

Full version support for Elasticsearch (5.x-9.x) with comprehensive API access.

## Features
- Support ES versions 5.x through 9.x
- Comprehensive REST API coverage
- Flexible authentication (API key, basic auth)
- Token usage tracking
- Connection pooling

## Configuration
Set the following environment variables:
- ES_URL: Elasticsearch endpoint
- ES_API_KEY or ES_USERNAME/ES_PASSWORD: Authentication
- NODE_TLS_REJECT_UNAUTHORIZED: Set to '0' for self-signed certs

## Usage Examples
- Search documents
- Create and manage indices
- Execute aggregations
- Bulk operations`,
  
  documentI18n: {
    en: `# Elasticsearch MCP Server

Full version support for Elasticsearch (5.x-9.x) with comprehensive API access.

## Features
- Support ES versions 5.x through 9.x
- Comprehensive REST API coverage
- Flexible authentication (API key, basic auth)
- Token usage tracking
- Connection pooling`,
    zh: `# Elasticsearch MCP 服务器

支持 Elasticsearch 完整版本（5.x-9.x）的全面 API 访问。

## 功能特性
- 支持 ES 5.x 到 9.x 版本
- 全面的 REST API 覆盖
- 灵活的认证方式（API 密钥、基础认证）
- Token 使用量跟踪
- 连接池管理`
  },
  
  configSchema: {
    type: 'object',
    required: ['url', 'NODE_TLS_REJECT_UNAUTHORIZED'],
    properties: {
      url: {
        type: 'string',
        title: 'Elasticsearch URL',
        description: 'Elasticsearch server endpoint (e.g., https://localhost:9200)',
        format: 'uri'
      },
      apiKey: {
        type: 'string',
        title: 'API Key',
        description: 'Elasticsearch API key for authentication',
        sensitive: true
      },
      username: {
        type: 'string',
        title: 'Username',
        description: 'Username for basic authentication'
      },
      password: {
        type: 'string',
        title: 'Password',
        description: 'Password for basic authentication',
        sensitive: true
      },
      NODE_TLS_REJECT_UNAUTHORIZED: {
        type: 'string',
        title: 'SSL/TLS Verification',
        description: 'Choose how to verify SSL/TLS certificates',
        enum: ['0', '1', 'ca-cert'],
        default: '1',
        enumLabels: {
          '0': 'Skip Verification (Insecure)',
          '1': 'Default Verification',
          'ca-cert': 'Custom CA Certificate'
        }
      },
      caCert: {
        type: 'string',
        title: 'CA Certificate',
        description: 'Upload custom CA certificate file',
        format: 'file'
      }
    },
    oneOf: [
      {
        required: ['url', 'apiKey'],
        title: 'API Key Authentication'
      },
      {
        required: ['url', 'username', 'password'],
        title: 'Basic Authentication'
      }
    ],
    dependencies: {
      NODE_TLS_REJECT_UNAUTHORIZED: {
        oneOf: [
          {
            properties: {
              NODE_TLS_REJECT_UNAUTHORIZED: { enum: ['ca-cert'] }
            },
            required: ['caCert']
          },
          {
            properties: {
              NODE_TLS_REJECT_UNAUTHORIZED: { enum: ['0', '1'] }
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
