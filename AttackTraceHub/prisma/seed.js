import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Create test users
  const hashedPassword = await bcrypt.hash('password123', 10);

  // Create BASE user
  const baseUser = await prisma.user.upsert({
    where: { email: 'base@test.com' },
    update: {},
    create: {
      email: 'base@test.com',
      username: 'Base User',
      password: hashedPassword,
      subscription: {
        create: {
          planName: 'BASE',
          isDefaultPlan: true,
          isActive: true
        }
      }
    }
  });

  // Create PRO user
  const proUser = await prisma.user.upsert({
    where: { email: 'pro@test.com' },
    update: {},
    create: {
      email: 'pro@test.com',
      username: 'Pro User',
      password: hashedPassword,
      subscription: {
        create: {
          planName: 'PRO',
          isDefaultPlan: false,
          isActive: true
        }
      }
    }
  });

  // Create ENTERPRISE user
  const enterpriseUser = await prisma.user.upsert({
    where: { email: 'enterprise@test.com' },
    update: {},
    create: {
      email: 'enterprise@test.com',
      username: 'Enterprise User',
      password: hashedPassword,
      subscription: {
        create: {
          planName: 'ENTERPRISE',
          isDefaultPlan: false,
          isActive: true
        }
      }
    }
  });

  // Create MCP servers
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
      tokenCost: 0.1,
      tokenRequired: 0.1,
      tokenPriceUnit: 'request',
      popular: true,
      new: false,
      isActive: true
    }
  ];

  for (const server of mcpServers) {
    const existing = await prisma.mcpServer.findFirst({
      where: { name: server.name }
    });
    
    if (!existing) {
      await prisma.mcpServer.create({
        data: server
      });
    }
  }

  // Create model descriptions
  const models = [
    {
      modelId: 'gpt-3.5-turbo',
      name: 'GPT-3.5 Turbo',
      provider: 'openai',
      tokenCost: 0.0015,
      description: 'Fast and efficient model for general tasks',
      extra: JSON.stringify({
        feature: 'General purpose',
        special: ['fast', 'cost-effective']
      })
    },
    {
      modelId: 'newmind-medium',
      name: 'AttackTrace Medium (Claude Sonnet)',
      provider: 'anthropic',
      tokenCost: 0.015,
      description: 'Advanced reasoning and analysis',
      extra: JSON.stringify({
        feature: 'Advanced reasoning',
        special: ['coding', 'analysis', 'creative']
      })
    },
    {
      modelId: 'newmind-strong',
      name: 'AttackTrace Strong (Claude Opus)',
      provider: 'anthropic',
      tokenCost: 0.075,
      description: 'Most capable model for complex tasks',
      extra: JSON.stringify({
        feature: 'Maximum capability',
        special: ['research', 'complex-reasoning', 'long-context']
      })
    }
  ];

  for (const model of models) {
    const existing = await prisma.modelDescription.findFirst({
      where: { modelId: model.modelId }
    });
    
    if (!existing) {
      await prisma.modelDescription.create({
        data: model
      });
    }
  }

  console.log('✅ Seed completed!');
  console.log('Test users:');
  console.log('  - base@test.com / password123 (BASE plan)');
  console.log('  - pro@test.com / password123 (PRO plan)');
  console.log('  - enterprise@test.com / password123 (ENTERPRISE plan)');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
