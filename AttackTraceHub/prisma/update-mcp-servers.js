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

  // Now run the seed logic
  await prisma.$executeRaw`DELETE FROM "McpServer"`;
  console.log('🗑️  Cleared existing MCP servers');
  
  const { mcpServers } = await import('./seed-data.js');
  
  for (const server of mcpServers) {
    await prisma.mcpServer.upsert({
      where: { name: server.name },
      update: {
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
      },
      create: server
    });
    console.log(`✅ Updated/Created: ${server.name} v${server.version}`);
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
