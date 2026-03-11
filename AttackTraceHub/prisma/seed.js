import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pathToFileURL } from 'url';
import { randomUUID } from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  const now = new Date();

  // Create test users
  const hashedPassword = await bcrypt.hash('password123', 10);

  // Create BASE user
  const baseUser = await prisma.user.upsert({
    where: { email: 'base@test.com' },
    update: {},
    create: {
      id: randomUUID(),
      email: 'base@test.com',
      username: 'Base User',
      password: hashedPassword,
      updatedAt: now,
      Subscription: {
        create: {
          id: randomUUID(),
          planName: 'BASE',
          isDefaultPlan: true,
          isActive: true,
          updatedAt: now,
        }
      }
    }
  });

  // Create PRO user
  const proUser = await prisma.user.upsert({
    where: { email: 'pro@test.com' },
    update: {},
    create: {
      id: randomUUID(),
      email: 'pro@test.com',
      username: 'Pro User',
      password: hashedPassword,
      updatedAt: now,
      Subscription: {
        create: {
          id: randomUUID(),
          planName: 'PRO',
          isDefaultPlan: false,
          isActive: true,
          updatedAt: now,
        }
      }
    }
  });

  // Create ENTERPRISE user
  const enterpriseUser = await prisma.user.upsert({
    where: { email: 'enterprise@test.com' },
    update: {},
    create: {
      id: randomUUID(),
      email: 'enterprise@test.com',
      username: 'Enterprise User',
      password: hashedPassword,
      updatedAt: now,
      Subscription: {
        create: {
          id: randomUUID(),
          planName: 'ENTERPRISE',
          isDefaultPlan: false,
          isActive: true,
          updatedAt: now,
        }
      }
    }
  });

  console.log(`✅ Users created: ${baseUser.email}, ${proUser.email}, ${enterpriseUser.email}`);

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
        descriptionI18n: config.descriptionI18n ? JSON.stringify(config.descriptionI18n) : null,
        tags: config.tags ? JSON.stringify(config.tags) : null,
        transport: config.transport,
        command: config.command,
        args: config.args ? JSON.stringify(config.args) : null,
        env: config.env ? JSON.stringify(config.env) : null,
        planRequired: config.planRequired,
        logo: config.logo,
        banner: config.banner,
        document: config.document,
        documentI18n: config.documentI18n ? JSON.stringify(config.documentI18n) : null,
        configSchema: config.configSchema ? JSON.stringify(config.configSchema) : null,
        tokenCost: config.tokenCost,
        tokenRequired: config.tokenRequired,
        tokenPriceUnit: config.tokenPriceUnit,
        popular: config.popular,
        new: config.new,
        isActive: config.isActive,
        updatedAt: now,
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
          data: { id: randomUUID(), ...serverData }
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
      modelId: 'medium-agent',
      name: 'OAP Medium Agent',
      provider: 'oap',
      tokenCost: 0.015,
      description: 'Advanced reasoning and analysis',
      extra: JSON.stringify({
        feature: 'Advanced reasoning',
        special: ['coding', 'analysis', 'creative']
      }),
      updatedAt: now,
    },
    {
      modelId: 'strong-agent',
      name: 'OAP Strong Agent',
      provider: 'oap',
      tokenCost: 0.075,
      description: 'Most capable model for complex tasks',
      extra: JSON.stringify({
        feature: 'Maximum capability',
        special: ['research', 'complex-reasoning', 'long-context']
      }),
      updatedAt: now,
    }
  ];

  for (const model of models) {
    const existing = await prisma.modelDescription.findFirst({
      where: { modelId: model.modelId }
    });
    
    if (!existing) {
      await prisma.modelDescription.create({
        data: { id: randomUUID(), ...model }
      });
      console.log(`✅ Model: ${model.name}`);
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
