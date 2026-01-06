#!/usr/bin/env node
import { program } from 'commander';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express, { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { Pool } from 'pg';

// Configuration from environment variables (similar to MySQL)
const POSTGRES_HOST = process.env.POSTGRES_HOST || 'localhost';
const POSTGRES_PORT = process.env.POSTGRES_PORT || '5432';
const POSTGRES_USER = process.env.POSTGRES_USER || 'postgres';
const POSTGRES_PASS = process.env.POSTGRES_PASS || process.env.POSTGRES_PASSWORD || '';
const POSTGRES_DB = process.env.POSTGRES_DB || process.env.POSTGRES_DATABASE;

// Build connection configuration
function getConnectionConfig() {
  return {
    host: POSTGRES_HOST,
    port: parseInt(POSTGRES_PORT, 10),
    user: POSTGRES_USER,
    password: POSTGRES_PASS,
    database: POSTGRES_DB || 'postgres', // Default to 'postgres' database if not specified
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };
}

// Token estimation function
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Token limit wrapper
function checkTokenLimit(data: any, tokenLimit: number = 8000, breakRule: boolean = false) {
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
1. 使用LIMIT子句减少返回行数（如：LIMIT 100）
2. 添加更具体的WHERE条件过滤数据
3. 使用分页查询（OFFSET/LIMIT）
4. 只SELECT需要的字段，避免SELECT *

如果必须获取完整结果，请设置 break_token_rule=true`
    }]
  };
}

class PostgreSQLServer {
  private server: Server;
  private pool: Pool | null = null;

  constructor() {
    this.server = new Server(
      {
        name: 'mcp-server-pgsql',
        version: '1.0.5',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.server.onerror = (error) => console.error('MCP Error:', error);

    process.on('SIGINT', async () => {
      await this.cleanup();
      process.exit(0);
    });
    process.on('SIGTERM', async () => {
      await this.cleanup();
      process.exit(0);
    });
  }

  private async getPool(): Promise<Pool> {
    if (!this.pool) {
      const config = getConnectionConfig();
      this.pool = new Pool(config);
    }
    return this.pool;
  }

  private async testConnection(): Promise<void> {
    try {
      const pool = await this.getPool();
      await pool.query('SELECT 1');
      console.error('✓ PostgreSQL database connection successful');
    } catch (error) {
      console.error('✗ PostgreSQL database connection failed:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  private async cleanup(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
    }
    if (this.server) {
      await this.server.close();
    }
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'query_database',
          description: '执行PostgreSQL查询操作（SELECT/SHOW/EXPLAIN/WITH）',
          inputSchema: zodToJsonSchema(z.object({
            connection_name: z.string().describe('连接名称'),
            query: z.string().describe('SQL查询语句'),
            parameters: z.array(z.any()).optional().describe('查询参数（用于参数化查询）'),
            token_limit: z.number().default(8000).optional().describe('返回结果的token数量限制，默认8000'),
            break_token_rule: z.boolean().default(false).optional().describe('是否打破token限制，默认false')
          }))
        },
        {
          name: 'get_schema_info',
          description: '获取PostgreSQL数据库结构信息',
          inputSchema: zodToJsonSchema(z.object({
            connection_name: z.string().describe('连接名称'),
            object_name: z.string().optional().describe('表名（可选，不指定则返回所有表）'),
            schema: z.string().optional().describe('Schema名（可选，默认public）'),
            token_limit: z.number().default(8000).optional().describe('返回结果的token数量限制，默认8000'),
            break_token_rule: z.boolean().default(false).optional().describe('是否打破token限制，默认false')
          }))
        },
        {
          name: 'execute_write',
          description: '执行PostgreSQL写操作（INSERT/UPDATE/DELETE）',
          inputSchema: zodToJsonSchema(z.object({
            connection_name: z.string().describe('连接名称'),
            operation: z.enum(['insert', 'update', 'delete']).describe('操作类型'),
            data: z.object({
              table: z.string().describe('表名'),
              schema: z.string().optional().describe('Schema名（可选，默认public）'),
              values: z.any().optional().describe('插入的值'),
              set: z.record(z.any()).optional().describe('更新的字段'),
              where: z.string().optional().describe('WHERE条件'),
              parameters: z.array(z.any()).optional().describe('SQL参数'),
              returning: z.array(z.string()).optional().describe('RETURNING字段')
            }).describe('操作数据')
          }))
        },
        {
          name: 'aggregate_analyze',
          description: '执行PostgreSQL聚合分析操作',
          inputSchema: zodToJsonSchema(z.object({
            connection_name: z.string().describe('连接名称'),
            aggregation_spec: z.object({
              table: z.string().describe('表名'),
              schema: z.string().optional().describe('Schema名（可选，默认public）'),
              select: z.array(z.string()).describe('SELECT字段（包含聚合函数）'),
              where: z.string().optional().describe('WHERE条件'),
              groupBy: z.array(z.string()).optional().describe('GROUP BY字段'),
              having: z.string().optional().describe('HAVING条件'),
              orderBy: z.array(z.string()).optional().describe('ORDER BY字段'),
              limit: z.number().optional().describe('限制返回数量'),
              parameters: z.array(z.any()).optional().describe('SQL参数')
            }).describe('聚合规范'),
            token_limit: z.number().default(8000).optional().describe('返回结果的token数量限制，默认8000'),
            break_token_rule: z.boolean().default(false).optional().describe('是否打破token限制，默认false')
          }))
        },
        {
          name: 'list_connections',
          description: '列出所有可用的PostgreSQL数据库连接',
          inputSchema: zodToJsonSchema(z.object({
            token_limit: z.number().default(8000).optional().describe('返回结果的token数量限制，默认8000'),
            break_token_rule: z.boolean().default(false).optional().describe('是否打破token限制，默认false')
          }))
        },
        {
          name: 'execute_ddl',
          description: '执行PostgreSQL DDL操作（CREATE/ALTER/DROP/TRUNCATE TABLE）',
          inputSchema: zodToJsonSchema(z.object({
            connection_name: z.string().describe('连接名称'),
            ddl_statement: z.string().describe('DDL语句（如：CREATE TABLE, ALTER TABLE, DROP TABLE等）'),
            token_limit: z.number().default(8000).optional().describe('返回结果的token数量限制，默认8000'),
            break_token_rule: z.boolean().default(false).optional().describe('是否打破token限制，默认false')
          }))
        },
        {
          name: 'list_databases',
          description: '列出所有PostgreSQL数据库',
          inputSchema: zodToJsonSchema(z.object({
            connection_name: z.string().describe('连接名称'),
            token_limit: z.number().default(8000).optional().describe('返回结果的token数量限制，默认8000'),
            break_token_rule: z.boolean().default(false).optional().describe('是否打破token限制，默认false')
          }))
        }
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
      try {
        const pool = await this.getPool();

        switch (request.params.name) {
          case 'query_database': {
            const { query, parameters, token_limit, break_token_rule } = request.params.arguments;

            // Validate query type
            const trimmedQuery = query.trim().toUpperCase();
            if (!trimmedQuery.startsWith('SELECT') &&
              !trimmedQuery.startsWith('SHOW') &&
              !trimmedQuery.startsWith('EXPLAIN') &&
              !trimmedQuery.startsWith('WITH')) {
              return {
                content: [{
                  type: "text",
                  text: 'Error: query_database只支持SELECT、SHOW、EXPLAIN和WITH查询'
                }],
                isError: true
              };
            }

            const result = await pool.query(query, parameters || []);
            const response = {
              rows: result.rows,
              rowCount: result.rowCount,
              fields: result.fields.map(f => ({
                name: f.name,
                dataTypeID: f.dataTypeID
              }))
            };

            return checkTokenLimit(response, token_limit || 8000, break_token_rule || false);
          }

          case 'get_schema_info': {
            const { object_name, schema, token_limit, break_token_rule } = request.params.arguments;
            const schemaName = schema || 'public';

            if (object_name) {
              // Get specific table schema
              const columnsResult = await pool.query(
                `SELECT 
                  column_name as name,
                  data_type as type,
                  character_maximum_length as max_length,
                  is_nullable as nullable,
                  column_default as default_value
                 FROM information_schema.columns
                 WHERE table_schema = $1 AND table_name = $2
                 ORDER BY ordinal_position`,
                [schemaName, object_name]
              );

              const indexesResult = await pool.query(
                `SELECT 
                  indexname as name,
                  indexdef as definition
                 FROM pg_indexes
                 WHERE schemaname = $1 AND tablename = $2`,
                [schemaName, object_name]
              );

              const schemaInfo = {
                name: object_name,
                schema: schemaName,
                columns: columnsResult.rows,
                indexes: indexesResult.rows
              };

              return checkTokenLimit(schemaInfo, token_limit || 8000, break_token_rule || false);
            } else {
              // Get all tables
              const tablesResult = await pool.query(
                `SELECT 
                  table_name as name,
                  table_schema as schema,
                  table_type as type
                 FROM information_schema.tables
                 WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
                 ORDER BY table_schema, table_name`
              );

              return checkTokenLimit({ tables: tablesResult.rows }, token_limit || 8000, break_token_rule || false);
            }
          }

          case 'execute_write': {
            const { operation, data } = request.params.arguments;
            const schema = data.schema || 'public';
            const fullTableName = `${schema}.${data.table}`;
            let sql: string;
            let params: any[] = [];

            switch (operation) {
              case 'insert': {
                if (!data.values) {
                  throw new Error('Insert operation requires values');
                }

                if (Array.isArray(data.values)) {
                  const keys = Object.keys(data.values[0]);
                  const valuePlaceholders = data.values.map((_: any, idx: number) => {
                    const offset = idx * keys.length;
                    return `(${keys.map((_k: string, keyIdx: number) => `$${offset + keyIdx + 1}`).join(', ')})`;
                  }).join(', ');

                  sql = `INSERT INTO ${fullTableName} (${keys.join(', ')}) VALUES ${valuePlaceholders}`;
                  params = data.values.flatMap((v: any) => keys.map(k => v[k]));
                } else {
                  const keys = Object.keys(data.values);
                  const placeholders = keys.map((_, idx) => `$${idx + 1}`).join(', ');

                  sql = `INSERT INTO ${fullTableName} (${keys.join(', ')}) VALUES (${placeholders})`;
                  params = keys.map(k => data.values[k]);
                }

                if (data.returning && data.returning.length > 0) {
                  sql += ` RETURNING ${data.returning.join(', ')}`;
                }

                const insertResult = await pool.query(sql, params);
                return {
                  content: [{
                    type: "text",
                    text: JSON.stringify({
                      rowCount: insertResult.rowCount,
                      rows: insertResult.rows
                    }, null, 2)
                  }]
                };
              }

              case 'update': {
                if (!data.set) {
                  throw new Error('Update operation requires set parameter');
                }
                if (!data.where) {
                  throw new Error('Update operation requires where parameter for safety');
                }

                const setKeys = Object.keys(data.set);
                const setClause = setKeys.map((k, idx) => `${k} = $${idx + 1}`).join(', ');
                const whereParams = data.parameters || [];

                sql = `UPDATE ${fullTableName} SET ${setClause} WHERE ${data.where}`;
                params = [...Object.values(data.set), ...whereParams];

                if (data.returning && data.returning.length > 0) {
                  sql += ` RETURNING ${data.returning.join(', ')}`;
                }

                const updateResult = await pool.query(sql, params);
                return {
                  content: [{
                    type: "text",
                    text: JSON.stringify({
                      rowCount: updateResult.rowCount,
                      rows: updateResult.rows
                    }, null, 2)
                  }]
                };
              }

              case 'delete': {
                if (!data.where) {
                  throw new Error('Delete operation requires where parameter for safety');
                }

                sql = `DELETE FROM ${fullTableName} WHERE ${data.where}`;
                params = data.parameters || [];

                if (data.returning && data.returning.length > 0) {
                  sql += ` RETURNING ${data.returning.join(', ')}`;
                }

                const deleteResult = await pool.query(sql, params);
                return {
                  content: [{
                    type: "text",
                    text: JSON.stringify({
                      rowCount: deleteResult.rowCount,
                      rows: deleteResult.rows
                    }, null, 2)
                  }]
                };
              }

              default:
                throw new Error(`Unknown operation: ${operation}`);
            }
          }

          case 'aggregate_analyze': {
            const { aggregation_spec, token_limit, break_token_rule } = request.params.arguments;
            const schema = aggregation_spec.schema || 'public';
            const fullTableName = `${schema}.${aggregation_spec.table}`;

            let sql = `SELECT ${aggregation_spec.select.join(', ')} FROM ${fullTableName}`;

            if (aggregation_spec.where) {
              sql += ` WHERE ${aggregation_spec.where}`;
            }

            if (aggregation_spec.groupBy && aggregation_spec.groupBy.length > 0) {
              sql += ` GROUP BY ${aggregation_spec.groupBy.join(', ')}`;
            }

            if (aggregation_spec.having) {
              sql += ` HAVING ${aggregation_spec.having}`;
            }

            if (aggregation_spec.orderBy && aggregation_spec.orderBy.length > 0) {
              sql += ` ORDER BY ${aggregation_spec.orderBy.join(', ')}`;
            }

            if (aggregation_spec.limit) {
              sql += ` LIMIT ${aggregation_spec.limit}`;
            }

            const result = await pool.query(sql, aggregation_spec.parameters || []);
            return checkTokenLimit(result.rows, token_limit || 8000, break_token_rule || false);
          }

          case 'list_connections': {
            const { token_limit, break_token_rule } = request.params.arguments;

            const connections = [{
              name: "default",
              type: "postgresql",
              status: "connected",
              database: POSTGRES_DB || 'postgres (multi-DB mode)',
              config: {
                host: POSTGRES_HOST,
                port: POSTGRES_PORT,
                user: POSTGRES_USER,
                database: POSTGRES_DB || 'postgres'
              }
            }];

            return checkTokenLimit(connections, token_limit || 8000, break_token_rule || false);
          }

          case 'execute_ddl': {
            const { ddl_statement, token_limit, break_token_rule } = request.params.arguments;

            // Validate DDL statement
            const trimmedDDL = ddl_statement.trim().toUpperCase();
            const validDDLKeywords = ['CREATE', 'ALTER', 'DROP', 'TRUNCATE', 'COMMENT'];
            const isValidDDL = validDDLKeywords.some(keyword => trimmedDDL.startsWith(keyword));

            if (!isValidDDL) {
              return {
                content: [{
                  type: "text",
                  text: `Error: execute_ddl只支持DDL操作（CREATE/ALTER/DROP/TRUNCATE/COMMENT）`
                }],
                isError: true
              };
            }

            const result = await pool.query(ddl_statement);
            const response = {
              success: true,
              message: "DDL操作执行成功",
              command: result.command,
              rowCount: result.rowCount || 0
            };

            return checkTokenLimit(response, token_limit || 8000, break_token_rule || false);
          }

          case 'list_databases': {
            const { token_limit, break_token_rule } = request.params.arguments;

            const result = await pool.query(`
              SELECT 
                datname as name,
                pg_catalog.pg_get_userbyid(datdba) as owner,
                pg_encoding_to_char(encoding) as encoding,
                datcollate as collate,
                datctype as ctype,
                pg_catalog.pg_database_size(datname) as size
              FROM pg_catalog.pg_database
              WHERE datistemplate = false
              ORDER BY datname
            `);

            const response = {
              databases: result.rows,
              count: result.rowCount
            };

            return checkTokenLimit(response, token_limit || 8000, break_token_rule || false);
          }

          default:
            throw new McpError(ErrorCode.MethodNotFound, `Tool '${request.params.name}' not found`);
        }
      } catch (error) {
        console.error(`Error handling request for tool ${request.params.name}:`, error);
        return {
          content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    });
  }

  async run() {
    await this.testConnection();
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }

  async runHttp(port: number, host: string) {
    await this.testConnection();

    const app = express();
    app.use(express.json());

    const transports = new Map<string, StreamableHTTPServerTransport>();

    app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'ok', transport: 'streamable-http' });
    });

    app.post('/mcp', async (req: Request, res: Response) => {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;

      try {
        let transport: StreamableHTTPServerTransport;

        if (sessionId && transports.has(sessionId)) {
          transport = transports.get(sessionId)!;
        } else {
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: async (newSessionId: string) => {
              transports.set(newSessionId, transport);
              console.error(`New MCP session initialized: ${newSessionId}`);
            },
            onsessionclosed: async (closedSessionId: string) => {
              transports.delete(closedSessionId);
              console.error(`MCP session closed: ${closedSessionId}`);
            }
          });

          await this.server.connect(transport);
        }

        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        console.error(`Error handling MCP request: ${error}`);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'Internal server error',
            },
            id: null,
          });
        }
      }
    });

    app.get('/mcp', async (req: Request, res: Response) => {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;

      if (!sessionId || !transports.has(sessionId)) {
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Invalid or missing session ID',
          },
          id: null,
        });
        return;
      }

      try {
        const transport = transports.get(sessionId)!;
        await transport.handleRequest(req, res);
      } catch (error) {
        console.error(`Error handling SSE stream: ${error}`);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'Failed to establish SSE stream',
            },
            id: null,
          });
        }
      }
    });

    app.listen(port, host, () => {
      console.log(`\n✓ PostgreSQL MCP Server (HTTP Mode) is running`);
      console.log(`  Endpoint: http://${host}:${port}/mcp`);
      console.log(`  Health: http://${host}:${port}/health`);
      console.log(`  Transport: Streamable HTTP\n`);
    });

    process.on("SIGINT", async () => {
      for (const [sessionId, transport] of transports.entries()) {
        await transport.close();
      }
      process.exit(0);
    });
  }
}

const serverInstance = new PostgreSQLServer();

const useHttp = process.env.MCP_TRANSPORT === 'http';
const httpPort = parseInt(process.env.MCP_HTTP_PORT || '3000', 10);
const httpHost = process.env.MCP_HTTP_HOST || 'localhost';

if (useHttp) {
  serverInstance.runHttp(httpPort, httpHost).catch(error => {
    console.error('Failed to run the server in HTTP mode:', error);
    process.exit(1);
  });
} else {
  process.stderr.write('Starting PostgreSQL MCP Server in Stdio mode\n');
  serverInstance.run().catch(error => {
    console.error('Failed to run the server:', error);
    process.exit(1);
  });
}
