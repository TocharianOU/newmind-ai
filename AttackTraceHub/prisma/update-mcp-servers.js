import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateMcpServers() {
  console.log('🔄 Updating MCP servers...');

  // First, add unique constraint to name field if it doesn't exist
  try {
    await prisma.$executeRaw`
      CREATE UNIQUE INDEX IF NOT EXISTS "McpServer_name_key" ON "McpServer"("name");
    `;
    console.log('✅ Added unique constraint to McpServer.name');
  } catch (error) {
    console.log('ℹ️ Unique constraint already exists or error:', error.message);
  }

  // MCP servers data
  const mcpServers = [
    {
      name: 'Elasticsearch',
      description: 'Full version support (ES 5.x-9.x) with comprehensive API access',
      descriptionI18n: JSON.stringify({
        en: 'Elasticsearch MCP Server with full version support (ES 5.x-9.x) and comprehensive API access',
        zh: 'Elasticsearch MCP 服务器，支持完整版本（ES 5.x-9.x）和全面的 API 访问'
      }),
      tags: JSON.stringify(['Search', 'Database', 'Analytics']),
      transport: 'stdio',
      command: 'node',
      args: JSON.stringify(['{{install_path}}/dist/index.js']),
      env: JSON.stringify({
        ES_URL: '',
        ES_API_KEY: '',
        ES_USERNAME: '',
        ES_PASSWORD: '',
        NODE_TLS_REJECT_UNAUTHORIZED: '0',
        MAX_TOKEN_CALL: '8000'
      }),
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
      documentI18n: JSON.stringify({
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
      }),
      version: '0.6.3',
      downloadUrl: 'https://github.com/TocharianOU/elasticsearch-mcp/releases/download/v0.6.3/elasticsearch-mcp-v0.6.3.tar.gz',
      configSchema: JSON.stringify({
        type: 'object',
        required: ['url'],
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
            description: 'Elasticsearch API key for authentication (optional)',
            sensitive: true
          },
          username: {
            type: 'string',
            title: 'Username',
            description: 'Username for basic authentication (optional)'
          },
          password: {
            type: 'string',
            title: 'Password',
            description: 'Password for basic authentication (optional)',
            sensitive: true
          },
          caCert: {
            type: 'string',
            title: 'CA Certificate',
            description: 'Upload custom CA certificate file for SSL verification (optional)',
            format: 'file'
          }
        },
        dependencies: {
          username: {
            required: ['password'],
            errorMessage: 'Password is required when username is provided'
          },
          password: {
            required: ['username'],
            errorMessage: 'Username is required when password is provided'
          }
        }
      }),
      tokenCost: 0.1,
      tokenRequired: 0.1,
      tokenPriceUnit: 'request',
      popular: true,
      new: false,
      isActive: true
    },
    {
      name: 'Kibana',
      description: 'Comprehensive Kibana management and visualization tools',
      descriptionI18n: JSON.stringify({
        en: 'Kibana MCP Server with comprehensive API access for dashboards, visualizations, and data exploration',
        zh: 'Kibana MCP 服务器，提供仪表板、可视化和数据探索的全面 API 访问'
      }),
      tags: JSON.stringify(['Visualization', 'Dashboard', 'Analytics', 'Monitoring']),
      transport: 'stdio',
      command: 'node',
      args: JSON.stringify(['{{install_path}}/dist/index.js']),
      env: JSON.stringify({
        KIBANA_URL: '',
        KIBANA_API_KEY: '',
        KIBANA_USERNAME: '',
        KIBANA_PASSWORD: '',
        KIBANA_DEFAULT_SPACE: 'default',
        NODE_TLS_REJECT_UNAUTHORIZED: '0'
      }),
      planRequired: 'BASE',
      banner: 'https://raw.githubusercontent.com/elastic/kibana/main/src/core/server/core_app/assets/logos/kibana.svg',
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
      documentI18n: JSON.stringify({
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
      }),
      version: '0.6.2',
      downloadUrl: 'https://github.com/TocharianOU/mcp-server-kibana/releases/download/v0.6.2/mcp-server-kibana-v0.6.2.tar.gz',
      configSchema: JSON.stringify({
        type: 'object',
        required: ['url'],
        properties: {
          url: {
            type: 'string',
            title: 'Kibana URL',
            description: 'Kibana server endpoint (e.g., https://localhost:5601)',
            format: 'uri'
          },
          apiKey: {
            type: 'string',
            title: 'API Key',
            description: 'Kibana API key for authentication (optional, recommended)',
            sensitive: true
          },
          username: {
            type: 'string',
            title: 'Username',
            description: 'Username for basic authentication (optional)'
          },
          password: {
            type: 'string',
            title: 'Password',
            description: 'Password for basic authentication (optional)',
            sensitive: true
          },
          cookies: {
            type: 'string',
            title: 'Cookies',
            description: 'Session cookies for authentication (optional)',
            sensitive: true
          },
          defaultSpace: {
            type: 'string',
            title: 'Default Space',
            description: 'Default Kibana space to operate in',
            default: 'default'
          },
          caCert: {
            type: 'string',
            title: 'CA Certificate Path',
            description: 'Path to custom CA certificate file for SSL verification (optional)'
          },
          timeout: {
            type: 'number',
            title: 'Timeout (ms)',
            description: 'Request timeout in milliseconds',
            default: 30000,
            minimum: 1000,
            maximum: 120000
          },
          maxRetries: {
            type: 'number',
            title: 'Max Retries',
            description: 'Maximum number of retry attempts for failed requests',
            default: 3,
            minimum: 0,
            maximum: 10
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
          },
          {
            required: ['url', 'cookies'],
            title: 'Cookie Authentication'
          },
          {
            required: ['url'],
            title: 'No Authentication (Local Development)'
          }
        ]
      }),
      tokenCost: 0.1,
      tokenRequired: 0.1,
      tokenPriceUnit: 'request',
      popular: true,
      new: false,
      isActive: true
    }
  ];
  
  for (const server of mcpServers) {
    // Check if server exists
    const existing = await prisma.mcpServer.findFirst({
      where: { name: server.name }
    });

    if (existing) {
      // Update existing server
      await prisma.mcpServer.update({
        where: { id: existing.id },
        data: {
          description: server.description,
          descriptionI18n: server.descriptionI18n,
          tags: server.tags,
          transport: server.transport,
          command: server.command,
          args: server.args,
          env: server.env,
          planRequired: server.planRequired,
          banner: server.banner,
          document: server.document,
          documentI18n: server.documentI18n,
          version: server.version,
          downloadUrl: server.downloadUrl,
          configSchema: server.configSchema,
          tokenCost: server.tokenCost,
          tokenRequired: server.tokenRequired,
          tokenPriceUnit: server.tokenPriceUnit,
          popular: server.popular,
          new: server.new,
          isActive: server.isActive
        }
      });
      console.log(`✅ Updated: ${server.name} v${server.version}`);
    } else {
      // Create new server
      await prisma.mcpServer.create({
        data: server
      });
      console.log(`✅ Created: ${server.name} v${server.version}`);
    }
  }

  console.log('🎉 MCP servers updated successfully!');
}

updateMcpServers()
  .catch((e) => {
    console.error('❌ Update error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
