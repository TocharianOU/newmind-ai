import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

  // Auto-load MCP servers from integrations directory
  console.log('📦 Loading MCP integrations...');
  const integrationsDir = path.join(__dirname, '../integrations');
  const integrationDirs = fs.readdirSync(integrationsDir)
    .filter(dir => !dir.startsWith('_') && !dir.startsWith('.'));
  
  for (const dir of integrationDirs) {
    try {
      const configPath = path.join(integrationsDir, dir, 'config.js');
      if (!fs.existsSync(configPath)) {
        console.log(`⚠️  Skipping ${dir}: config.js not found`);
        continue;
      }
      
      // Dynamic import for ES modules
      const configModule = await import(pathToFileURL(configPath).href);
      const config = configModule.default;
      
      // Transform config to database format
      const serverData = {
        name: config.name,
        version: config.version,
        downloadUrl: config.downloadUrl,
        description: config.description,
        descriptionI18n: JSON.stringify(config.descriptionI18n),
        tags: JSON.stringify(config.tags),
        transport: config.transport,
        command: config.command,
        args: JSON.stringify(config.args),
        env: JSON.stringify(config.env),
        planRequired: config.planRequired,
        logo: config.logo,
        banner: config.banner,
        document: config.document,
        documentI18n: JSON.stringify(config.documentI18n),
        configSchema: JSON.stringify(config.configSchema),
        tokenCost: config.tokenCost,
        tokenRequired: config.tokenRequired,
        tokenPriceUnit: config.tokenPriceUnit,
        popular: config.popular,
        new: config.new,
        isActive: config.isActive
      };
      
      // Check if server exists
      const existing = await prisma.mcpServer.findFirst({
        where: { name: config.name }
      });
      
      if (existing) {
        await prisma.mcpServer.update({
          where: { id: existing.id },
          data: serverData
        });
        console.log(`✅ Updated: ${config.name} v${config.version}`);
      } else {
        await prisma.mcpServer.create({
          data: serverData
        });
        console.log(`✅ Created: ${config.name} v${config.version}`);
      }
    } catch (error) {
      console.error(`❌ Error loading ${dir}:`, error.message);
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
