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

  // Create sample MCP servers
  const mcpServers = [
    {
      name: 'Elasticsearch Security MCP',
      description: 'Professional security-focused Elasticsearch interaction with advanced threat detection, anomaly detection, and incident investigation capabilities',
      tags: JSON.stringify(['elasticsearch', 'security', 'search', 'analytics', 'monitoring']),
      transport: 'stdio',
      command: 'npx',
      args: JSON.stringify(['@tocharian/mcp-server-elasticsearch-sl']),
      env: JSON.stringify({
        ES_URL: process.env.PRODUCTION_ES_URL || 'https://localhost:9201',
        ES_USERNAME: 'elastic',
        ES_PASSWORD: 'tocharian!',
        NODE_TLS_REJECT_UNAUTHORIZED: '0'
      }),
      planRequired: 'BASE',
      banner: 'https://raw.githubusercontent.com/elastic/elasticsearch/main/docs/src/test/resources/logos/elastic-logo.svg',
      document: `# Elasticsearch Security MCP Server

This is a professional security-focused solution for Elasticsearch interaction, specifically optimized for security analysis, threat detection, and incident investigation.

## Key Features
- Real-time threat detection and security monitoring
- Advanced machine learning for anomaly detection
- Root cause analysis and attack chain tracking
- Security incident investigation and forensics
- Compliance monitoring and audit reporting

## Prerequisites
- An Elasticsearch instance with valid license (trial, platinum, or enterprise)
- Elasticsearch authentication credentials
- MCP Client (e.g. Dive, Claude Desktop)

## Security Analysis Examples
- **Threat Detection**: "Analyze brute force attack attempts in the past 24 hours"
- **Root Cause Analysis**: "Trace the complete attack chain for security incidents"
- **Threat Intelligence**: "Create ML models to detect zero-day attacks"
- **Real-time Monitoring**: "Monitor active threats in the current system"`,
      tokenCost: 0.05,
      tokenRequired: 0.05,
      tokenPriceUnit: 'query',
      popular: true,
      new: true,
      isActive: true
    },
    {
      name: 'File System MCP',
      description: 'Access and manage local file system',
      tags: JSON.stringify(['filesystem', 'local', 'files']),
      transport: 'stdio',
      command: 'npx',
      args: JSON.stringify(['@modelcontextprotocol/server-filesystem']),
      planRequired: 'BASE',
      banner: 'https://raw.githubusercontent.com/modelcontextprotocol/servers/main/docs/assets/mcp-logo.png',
      tokenCost: 0.01,
      tokenRequired: 0.01,
      tokenPriceUnit: 'operation',
      isActive: true
    },
    {
      name: 'GitHub MCP',
      description: 'Interact with GitHub repositories',
      tags: JSON.stringify(['github', 'git', 'repository']),
      transport: 'stdio',
      command: 'npx',
      args: JSON.stringify(['@modelcontextprotocol/server-github']),
      planRequired: 'PRO',
      banner: 'https://raw.githubusercontent.com/logos/GitHub-Logos/master/2011/GitHub_Logo.png',
      tokenCost: 0.02,
      tokenRequired: 0.02,
      tokenPriceUnit: 'operation',
      isActive: true
    },
    {
      name: 'Database MCP',
      description: 'Connect to various databases',
      tags: JSON.stringify(['database', 'sql', 'query']),
      transport: 'stdio',
      command: 'npx',
      args: JSON.stringify(['@modelcontextprotocol/server-database']),
      planRequired: 'ENTERPRISE',
      banner: 'https://raw.githubusercontent.com/modelcontextprotocol/servers/main/docs/assets/database-icon.svg',
      tokenCost: 0.03,
      tokenRequired: 0.03,
      tokenPriceUnit: 'query',
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
      name: 'Newmind Medium (Claude Sonnet)',
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
      name: 'Newmind Strong (Claude Opus)',
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
