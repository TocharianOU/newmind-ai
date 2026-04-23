import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const elasticsearchSchema = {
  type: "object",
  properties: {
    ES_URL: {
      type: "string",
      title: "Elasticsearch URL",
      description: "The URL of your Elasticsearch cluster (e.g., https://localhost:9200)",
      placeholder: "https://localhost:9200",
      required: true
    },
    ES_API_KEY: {
      type: "string",
      title: "API Key",
      description: "API Key for authentication (recommended)",
      format: "password",
      placeholder: "Enter your API key..."
    },
    ES_USERNAME: {
      type: "string",
      title: "Username",
      description: "Username for basic authentication",
      placeholder: "elastic"
    },
    ES_PASSWORD: {
      type: "string",
      title: "Password",
      description: "Password for basic authentication",
      format: "password",
      placeholder: "Enter password..."
    },
    NODE_TLS_REJECT_UNAUTHORIZED: {
      type: "boolean",
      title: "验证服务器证书",
      description: "验证证书的有效性（如域名、有效期）。连接始终加密。",
      default: true
    },
    ES_CA_FILE: {
      type: "string",
      title: "CA 证书",
      description: "选择本地 CA 证书文件（自动获取绝对路径）",
      format: "file",
      placeholder: "选择文件..."
    },
    MAX_TOKEN_CACHE_SIZE: {
      type: "string",
      title: "Max Token Cache Size",
      description: "Maximum token cache size",
      placeholder: "8000",
      default: "8000"
    }
  },
  required: ["ES_URL"],
  oneOf: [
    {
      title: "API Key Authentication",
      description: "Use API Key for authentication (recommended)",
      required: ["ES_API_KEY"],
      properties: {
        ES_API_KEY: {
          type: "string"
        }
      }
    },
    {
      title: "Basic Authentication",
      description: "Use username and password for authentication",
      required: ["ES_USERNAME", "ES_PASSWORD"],
      properties: {
        ES_USERNAME: {
          type: "string"
        },
        ES_PASSWORD: {
          type: "string"
        }
      }
    }
  ]
};

async function main() {
  console.log('Updating Elasticsearch MCP Server with configSchema...');

  // Find Elasticsearch server by name
  const elasticsearchServer = await prisma.mcpServer.findFirst({
    where: {
      name: 'Elasticsearch'
    }
  });

  if (!elasticsearchServer) {
    console.log('❌ Elasticsearch server not found in database');
    console.log('Creating Elasticsearch server with schema...');
    
    await prisma.mcpServer.create({
      data: {
        id: 'elasticsearch-mcp-v1',
        name: 'Elasticsearch',
        description: 'Elasticsearch MCP Server for querying and managing Elasticsearch clusters',
        transport: 'stdio',
        command: 'node',
        args: ['{{install_path}}/dist/index.js'],
        env: {
          ES_URL: '',
          ES_API_KEY: '',
          ES_USERNAME: '',
          ES_PASSWORD: '',
          NODE_TLS_REJECT_UNAUTHORIZED: '1',
          ES_CA_FILE: '',
          MAX_TOKEN_CACHE_SIZE: '8000'
        },
        configSchema: elasticsearchSchema,
        version: '0.6.2',
        downloadUrl: 'https://github.com/newmindai/mcp-server-elasticsearch-sl/releases/download/v0.6.2/Elasticsearch@0.6.2.tar.gz',
        planRequired: 'BASE',
        isActive: true,
        tokenCost: 0,
        tokenRequired: 0,
        tokenPriceUnit: 'request',
        popular: true,
        new: false
      }
    });
    
    console.log('✅ Created Elasticsearch server with configSchema');
  } else {
    // Update existing server
    await prisma.mcpServer.update({
      where: {
        id: elasticsearchServer.id
      },
      data: {
        configSchema: elasticsearchSchema
      }
    });
    
    console.log('✅ Updated Elasticsearch server with configSchema');
  }
}

main()
  .catch((e) => {
    console.error('Error updating schema:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
