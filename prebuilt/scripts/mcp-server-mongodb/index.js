#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { randomUUID } from 'crypto';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { MongoClient, ObjectId } from 'mongodb';

// Configuration from environment variables (similar to MySQL)
const MONGODB_HOST = process.env.MONGODB_HOST || 'localhost';
const MONGODB_PORT = process.env.MONGODB_PORT || '27017';
const MONGODB_USER = process.env.MONGODB_USER || process.env.MONGODB_USERNAME;
const MONGODB_PASS = process.env.MONGODB_PASS || process.env.MONGODB_PASSWORD;
const MONGODB_DB = process.env.MONGODB_DB || process.env.MONGODB_DATABASE;

const MCP_TRANSPORT = process.env.MCP_TRANSPORT || 'stdio';
const MCP_HTTP_PORT = parseInt(process.env.MCP_HTTP_PORT || '3002', 10);
const MCP_HTTP_HOST = process.env.MCP_HTTP_HOST || 'localhost';

// Global MongoDB client
let mongoClient = null;
let currentDb = null;
let currentDbName = null;

// Token estimation function
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

// Token limit wrapper
function checkTokenLimit(data, tokenLimit = 8000, breakRule = false) {
  const jsonString = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  const currentTokens = estimateTokens(jsonString);

  if (breakRule || currentTokens <= tokenLimit) {
    return {
      success: true,
      content: [{ type: "text", text: jsonString }]
    };
  }

  return {
    success: false,
    isError: true,
    content: [{
      type: "text",
      text: `结果超出token限制（当前：${currentTokens.toLocaleString()} tokens，限制：${tokenLimit.toLocaleString()} tokens）

建议优化方案：
1. 使用limit()减少返回文档数量
2. 添加更具体的查询条件过滤数据
3. 使用分页查询（skip/limit）
4. 使用projection只返回需要的字段

如果必须获取完整结果，请设置 break_token_rule=true`
    }]
  };
}

// Build connection URI from environment variables (similar to MySQL)
function buildConnectionUri() {
  const host = MONGODB_HOST;
  const port = MONGODB_PORT;
  const user = MONGODB_USER;
  const pass = MONGODB_PASS;
  const db = MONGODB_DB;

  let uri = 'mongodb://';

  // Add credentials if provided
  if (user && pass) {
    uri += `${encodeURIComponent(user)}:${encodeURIComponent(pass)}@`;
  }

  // Add host and port
  uri += `${host}:${port}`;

  // Add database if specified
  if (db) {
    uri += `/${db}`;
  }

  // Add authSource parameter for authentication
  const params = new URLSearchParams();
  if (user && pass) {
    params.set('authSource', 'admin');
  }

  if (params.toString()) {
    uri += `?${params.toString()}`;
  }

  return uri;
}

// Obfuscate MongoDB URI for logging
function obfuscateMongoUri(uri) {
  try {
    const url = new URL(uri);
    if (url.password) {
      url.password = '****';
    }
    return url.toString();
  } catch (e) {
    return uri.replace(/\/\/[^:]+:[^@]+@/, '//****:****@');
  }
}

// Test MongoDB connection
async function testConnection(uri) {
  let testClient = null;

  try {
    testClient = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
    });

    await testClient.connect();
    const adminDb = testClient.db('admin');
    await adminDb.command({ ping: 1 });
    await testClient.close();

    console.error('✓ MongoDB database connection successful');
    return true;
  } catch (error) {
    console.error('✗ MongoDB database connection failed:', error.message);

    if (testClient) {
      try {
        await testClient.close();
      } catch (closeError) {
        // Ignore close errors
      }
    }

    return false;
  }
}

// Connect to MongoDB
async function connect(uri) {
  try {
    mongoClient = new MongoClient(uri, {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    await mongoClient.connect();

    // If MONGODB_DB is set, use it; otherwise use admin as default
    // When no database is specified, user can access all databases
    currentDbName = MONGODB_DB || 'admin';
    currentDb = mongoClient.db(currentDbName);

    return true;
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error.message);
    return false;
  }
}

// Cleanup function
async function cleanup() {
  if (mongoClient) {
    try {
      await mongoClient.close();
      mongoClient = null;
    } catch (error) {
      console.error('Error closing MongoDB connection:', error.message);
    }
  }
}

// Create MCP Server
function createMcpServer() {
  const server = new Server(
    {
      name: 'MongoDB MCP Server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'query_database',
          description: '执行MongoDB查询操作（find查询）',
          inputSchema: {
            type: 'object',
            properties: {
              connection_name: {
                type: 'string',
                description: '连接名称（当前使用默认连接）'
              },
              query: {
                type: 'object',
                description: 'MongoDB查询对象（filter）'
              },
              parameters: {
                type: 'object',
                description: '查询参数（collection, projection, sort, limit等）',
                properties: {
                  collection: {
                    type: 'string',
                    description: '集合名称（必需）'
                  },
                  projection: {
                    type: 'object',
                    description: '投影（指定返回的字段）'
                  },
                  sort: {
                    type: 'object',
                    description: '排序规则'
                  },
                  limit: {
                    type: 'number',
                    description: '限制返回文档数量'
                  },
                  skip: {
                    type: 'number',
                    description: '跳过文档数量'
                  }
                }
              },
              token_limit: {
                type: 'number',
                description: '返回结果的token数量限制，默认8000',
                default: 8000
              },
              break_token_rule: {
                type: 'boolean',
                description: '是否打破token限制，默认false',
                default: false
              }
            },
            required: ['connection_name', 'query', 'parameters']
          }
        },
        {
          name: 'get_schema_info',
          description: '获取MongoDB数据库结构信息',
          inputSchema: {
            type: 'object',
            properties: {
              connection_name: {
                type: 'string',
                description: '连接名称'
              },
              object_name: {
                type: 'string',
                description: '集合名称（可选，不指定则返回所有集合）'
              },
              token_limit: {
                type: 'number',
                description: '返回结果的token数量限制，默认8000',
                default: 8000
              },
              break_token_rule: {
                type: 'boolean',
                description: '是否打破token限制，默认false',
                default: false
              }
            },
            required: ['connection_name']
          }
        },
        {
          name: 'execute_write',
          description: '执行MongoDB写操作（insert/update/delete）',
          inputSchema: {
            type: 'object',
            properties: {
              connection_name: {
                type: 'string',
                description: '连接名称'
              },
              operation: {
                type: 'string',
                enum: ['insert', 'update', 'delete'],
                description: '操作类型'
              },
              data: {
                type: 'object',
                description: '操作数据',
                properties: {
                  collection: {
                    type: 'string',
                    description: '集合名称'
                  },
                  document: {
                    description: '插入的文档或文档数组（INSERT）'
                  },
                  filter: {
                    type: 'object',
                    description: '过滤条件（UPDATE/DELETE）'
                  },
                  update: {
                    type: 'object',
                    description: '更新操作（UPDATE）'
                  },
                  options: {
                    type: 'object',
                    description: '操作选项（upsert等）'
                  }
                }
              },
              token_limit: {
                type: 'number',
                description: '返回结果的token数量限制，默认8000',
                default: 8000
              },
              break_token_rule: {
                type: 'boolean',
                description: '是否打破token限制，默认false',
                default: false
              }
            },
            required: ['connection_name', 'operation', 'data']
          }
        },
        {
          name: 'aggregate_analyze',
          description: '执行MongoDB聚合分析操作',
          inputSchema: {
            type: 'object',
            properties: {
              connection_name: {
                type: 'string',
                description: '连接名称'
              },
              aggregation_spec: {
                type: 'object',
                description: '聚合规范',
                properties: {
                  collection: {
                    type: 'string',
                    description: '集合名称'
                  },
                  pipeline: {
                    type: 'array',
                    description: 'MongoDB聚合管道'
                  }
                }
              },
              token_limit: {
                type: 'number',
                description: '返回结果的token数量限制，默认8000',
                default: 8000
              },
              break_token_rule: {
                type: 'boolean',
                description: '是否打破token限制，默认false',
                default: false
              }
            },
            required: ['connection_name', 'aggregation_spec']
          }
        },
        {
          name: 'list_connections',
          description: '列出可用的MongoDB连接',
          inputSchema: {
            type: 'object',
            properties: {
              token_limit: {
                type: 'number',
                description: '返回结果的token数量限制，默认8000',
                default: 8000
              },
              break_token_rule: {
                type: 'boolean',
                description: '是否打破token限制，默认false',
                default: false
              }
            }
          }
        },
        {
          name: 'execute_ddl',
          description: '执行MongoDB集合操作（创建/删除集合、创建/删除索引）',
          inputSchema: {
            type: 'object',
            properties: {
              connection_name: {
                type: 'string',
                description: '连接名称'
              },
              operation: {
                type: 'string',
                enum: ['createCollection', 'dropCollection', 'createIndex', 'dropIndex', 'renameCollection'],
                description: '操作类型'
              },
              data: {
                type: 'object',
                description: '操作数据',
                properties: {
                  collection: {
                    type: 'string',
                    description: '集合名称'
                  },
                  options: {
                    type: 'object',
                    description: '操作选项（如索引定义、集合选项等）'
                  },
                  newName: {
                    type: 'string',
                    description: '新集合名称（用于重命名操作）'
                  }
                }
              },
              token_limit: {
                type: 'number',
                description: '返回结果的token数量限制，默认8000',
                default: 8000
              },
              break_token_rule: {
                type: 'boolean',
                description: '是否打破token限制，默认false',
                default: false
              }
            },
            required: ['connection_name', 'operation', 'data']
          }
        },
        {
          name: 'list_databases',
          description: '列出所有MongoDB数据库',
          inputSchema: {
            type: 'object',
            properties: {
              connection_name: {
                type: 'string',
                description: '连接名称'
              },
              token_limit: {
                type: 'number',
                description: '返回结果的token数量限制，默认8000',
                default: 8000
              },
              break_token_rule: {
                type: 'boolean',
                description: '是否打破token限制，默认false',
                default: false
              }
            },
            required: ['connection_name']
          }
        }
      ]
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const { name, arguments: args } = request.params;
      const token_limit = args.token_limit || 8000;
      const break_token_rule = args.break_token_rule || false;

      switch (name) {
        case 'query_database': {
          if (!args.parameters || !args.parameters.collection) {
            throw new Error('参数中必须指定collection（集合名称）');
          }

          const collection = currentDb.collection(args.parameters.collection);
          const filter = args.query || {};
          const options = {};

          if (args.parameters.projection) {
            options.projection = args.parameters.projection;
          }
          if (args.parameters.sort) {
            options.sort = args.parameters.sort;
          }
          if (args.parameters.limit) {
            options.limit = args.parameters.limit;
          }
          if (args.parameters.skip) {
            options.skip = args.parameters.skip;
          }

          const results = await collection.find(filter, options).toArray();

          const response = {
            collection: args.parameters.collection,
            count: results.length,
            documents: results
          };

          return checkTokenLimit(response, token_limit, break_token_rule);
        }

        case 'get_schema_info': {
          if (args.object_name) {
            // Get specific collection info
            const collection = currentDb.collection(args.object_name);
            const sample = await collection.findOne({});
            const indexes = await collection.indexes();
            const stats = await currentDb.command({ collStats: args.object_name });

            const response = {
              database: currentDbName,
              collection: args.object_name,
              document_count: stats.count,
              size: stats.size,
              indexes: indexes,
              sample_document: sample,
              schema_fields: sample ? Object.keys(sample) : []
            };

            return checkTokenLimit(response, token_limit, break_token_rule);
          } else {
            // Get all collections
            const collections = await currentDb.listCollections().toArray();
            const response = {
              database: currentDbName,
              collections: collections.map(col => ({
                name: col.name,
                type: col.type
              }))
            };

            return checkTokenLimit(response, token_limit, break_token_rule);
          }
        }

        case 'execute_write': {
          if (!args.data || !args.data.collection) {
            throw new Error('data参数中必须指定collection（集合名称）');
          }

          const collection = currentDb.collection(args.data.collection);
          let result;

          switch (args.operation) {
            case 'insert': {
              if (!args.data.document) {
                throw new Error('insert操作需要document参数');
              }

              if (Array.isArray(args.data.document)) {
                result = await collection.insertMany(args.data.document);
                result = {
                  operation: 'insertMany',
                  acknowledged: result.acknowledged,
                  insertedCount: result.insertedCount,
                  insertedIds: result.insertedIds
                };
              } else {
                result = await collection.insertOne(args.data.document);
                result = {
                  operation: 'insertOne',
                  acknowledged: result.acknowledged,
                  insertedId: result.insertedId
                };
              }
              break;
            }

            case 'update': {
              if (!args.data.filter || !args.data.update) {
                throw new Error('update操作需要filter和update参数');
              }

              const options = args.data.options || {};

              if (options.multi === false) {
                result = await collection.updateOne(args.data.filter, args.data.update, options);
                result = {
                  operation: 'updateOne',
                  acknowledged: result.acknowledged,
                  matchedCount: result.matchedCount,
                  modifiedCount: result.modifiedCount,
                  upsertedId: result.upsertedId
                };
              } else {
                result = await collection.updateMany(args.data.filter, args.data.update, options);
                result = {
                  operation: 'updateMany',
                  acknowledged: result.acknowledged,
                  matchedCount: result.matchedCount,
                  modifiedCount: result.modifiedCount,
                  upsertedId: result.upsertedId
                };
              }
              break;
            }

            case 'delete': {
              if (!args.data.filter) {
                throw new Error('delete操作需要filter参数');
              }

              const options = args.data.options || {};

              if (options.multi === false) {
                result = await collection.deleteOne(args.data.filter);
                result = {
                  operation: 'deleteOne',
                  acknowledged: result.acknowledged,
                  deletedCount: result.deletedCount
                };
              } else {
                result = await collection.deleteMany(args.data.filter);
                result = {
                  operation: 'deleteMany',
                  acknowledged: result.acknowledged,
                  deletedCount: result.deletedCount
                };
              }
              break;
            }

            default:
              throw new Error(`不支持的操作类型: ${args.operation}`);
          }

          return checkTokenLimit(result, token_limit, break_token_rule);
        }

        case 'aggregate_analyze': {
          if (!args.aggregation_spec || !args.aggregation_spec.collection) {
            throw new Error('aggregation_spec中必须指定collection');
          }
          if (!args.aggregation_spec.pipeline || !Array.isArray(args.aggregation_spec.pipeline)) {
            throw new Error('aggregation_spec中必须指定pipeline数组');
          }

          const collection = currentDb.collection(args.aggregation_spec.collection);
          const results = await collection.aggregate(args.aggregation_spec.pipeline).toArray();

          const response = {
            collection: args.aggregation_spec.collection,
            pipeline: args.aggregation_spec.pipeline,
            result_count: results.length,
            results: results
          };

          return checkTokenLimit(response, token_limit, break_token_rule);
        }

        case 'list_connections': {
          const connections = [{
            name: 'default',
            type: 'mongodb',
            status: mongoClient ? 'connected' : 'disconnected',
            database: currentDbName,
            uri: obfuscateMongoUri(buildConnectionUri())
          }];

          return checkTokenLimit(connections, token_limit, break_token_rule);
        }

        case 'execute_ddl': {
          const { operation, data } = args;
          
          if (!mongoClient || !currentDb) {
            throw new Error('MongoDB未连接');
          }

          let result;
          
          switch (operation) {
            case 'createCollection':
              await currentDb.createCollection(data.collection, data.options || {});
              result = {
                success: true,
                message: `集合 ${data.collection} 创建成功`,
                operation: 'createCollection'
              };
              break;

            case 'dropCollection':
              await currentDb.dropCollection(data.collection);
              result = {
                success: true,
                message: `集合 ${data.collection} 删除成功`,
                operation: 'dropCollection'
              };
              break;

            case 'createIndex':
              const collection = currentDb.collection(data.collection);
              const indexResult = await collection.createIndex(data.options.keys, data.options.options || {});
              result = {
                success: true,
                message: `索引创建成功`,
                indexName: indexResult,
                operation: 'createIndex'
              };
              break;

            case 'dropIndex':
              const coll = currentDb.collection(data.collection);
              await coll.dropIndex(data.options.indexName);
              result = {
                success: true,
                message: `索引 ${data.options.indexName} 删除成功`,
                operation: 'dropIndex'
              };
              break;

            case 'renameCollection':
              await currentDb.renameCollection(data.collection, data.newName, data.options || {});
              result = {
                success: true,
                message: `集合 ${data.collection} 重命名为 ${data.newName} 成功`,
                operation: 'renameCollection'
              };
              break;

            default:
              throw new Error(`不支持的DDL操作: ${operation}`);
          }

          return checkTokenLimit(result, token_limit, break_token_rule);
        }

        case 'list_databases': {
          if (!mongoClient) {
            throw new Error('MongoDB未连接');
          }

          const adminDb = mongoClient.db().admin();
          const { databases } = await adminDb.listDatabases();
          
          const result = {
            databases: databases.map(db => ({
              name: db.name,
              sizeOnDisk: db.sizeOnDisk,
              empty: db.empty
            })),
            count: databases.length
          };

          return checkTokenLimit(result, token_limit, break_token_rule);
        }

        default:
          throw new Error(`未知的工具: ${name}`);
      }
    } catch (error) {
      console.error('Error in CallToolRequest handler:', error.message);
      return {
        content: [{
          type: 'text',
          text: `Error: ${error.message}\n\nStack: ${error.stack}`
        }],
        isError: true
      };
    }
  });

  return server;
}

// Start the server
async function start() {
  const uri = buildConnectionUri();

  // Test connection
  const testResult = await testConnection(uri);
  if (!testResult) {
    console.error('✗ Connection test failed. Server will not start.');
    process.exit(1);
  }

  // Establish actual connection
  const connected = await connect(uri);
  if (!connected) {
    console.error('✗ Failed to establish connection.');
    process.exit(1);
  }

  const server = createMcpServer();

  // Setup signal handlers
  process.on('SIGINT', async () => {
    await cleanup();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await cleanup();
    process.exit(0);
  });

  if (MCP_TRANSPORT === 'http') {
    // HTTP Mode
    const app = express();
    app.use(express.json());

    const transports = new Map();

    app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        transport: 'streamable-http',
        database: currentDbName,
        connected: mongoClient ? true : false
      });
    });

    app.post('/mcp', async (req, res) => {
      const sessionId = req.headers['x-session-id'] || randomUUID();

      let transport = transports.get(sessionId);
      if (!transport) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => sessionId
        });
        transports.set(sessionId, transport);
        await server.connect(transport);
      }

      try {
        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        console.error('Error handling MCP request:', error);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: error.message
            },
            id: null
          });
        }
      }
    });

    app.listen(MCP_HTTP_PORT, MCP_HTTP_HOST, () => {
      console.log(`\n✓ MongoDB MCP Server (HTTP Mode) is running`);
      console.log(`  Endpoint: http://${MCP_HTTP_HOST}:${MCP_HTTP_PORT}/mcp`);
      console.log(`  Health: http://${MCP_HTTP_HOST}:${MCP_HTTP_PORT}/health`);
      console.log(`  Transport: Streamable HTTP\n`);
    });
  } else {
    // Stdio Mode
    process.stderr.write('Starting MongoDB MCP Server in Stdio mode\n');
    const transport = new StdioServerTransport();
    await server.connect(transport);
  }
}

// Run the server
start().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
