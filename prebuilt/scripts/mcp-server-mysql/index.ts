#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { log } from "./src/utils/index.js";
import {
  mcpConfig as config,
  MCP_VERSION as version,
  IS_REMOTE_MCP,
  REMOTE_SECRET_KEY,
  PORT,
} from "./src/config/index.js";
import {
  safeExit,
  getPool,
  poolPromise,
} from "./src/db/index.js";

import path from 'path';
import express, { Request, Response } from "express";
import { fileURLToPath } from 'url';
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

// Removed verbose startup log

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

export default function createMcpServer({
  sessionId,
  config: serverConfig,
}: {
  sessionId?: string;
  config: { debug: boolean };
}) {
  const server = new Server(
    {
      name: "MySQL MCP Server",
      version: process.env.npm_package_version || "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // Register handler for listing tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "query_database",
          description: "执行MySQL查询操作（SELECT/SHOW/DESCRIBE/EXPLAIN）",
          inputSchema: {
            type: "object",
            properties: {
              connection_name: {
                type: "string",
                description: "连接名称（当前使用默认连接）"
              },
              query: {
                type: "string",
                description: "SQL查询语句"
              },
              parameters: {
                type: "array",
                description: "查询参数（用于参数化查询）",
                items: {}
              },
              token_limit: {
                type: "number",
                description: "返回结果的token数量限制，默认8000",
                default: 8000
              },
              break_token_rule: {
                type: "boolean",
                description: "是否打破token限制，默认false",
                default: false
              }
            },
            required: ["connection_name", "query"]
          }
        },
        {
          name: "get_schema_info",
          description: "获取MySQL数据库结构信息",
          inputSchema: {
            type: "object",
            properties: {
              connection_name: {
                type: "string",
                description: "连接名称"
              },
              object_name: {
                type: "string",
                description: "表名（可选，不指定则返回所有表）"
              },
              token_limit: {
                type: "number",
                description: "返回结果的token数量限制，默认8000",
                default: 8000
              },
              break_token_rule: {
                type: "boolean",
                description: "是否打破token限制，默认false",
                default: false
              }
            },
            required: ["connection_name"]
          }
        },
        {
          name: "execute_write",
          description: "执行MySQL写操作（INSERT/UPDATE/DELETE）",
          inputSchema: {
            type: "object",
            properties: {
              connection_name: {
                type: "string",
                description: "连接名称"
              },
              operation: {
                type: "string",
                enum: ["insert", "update", "delete"],
                description: "操作类型"
              },
              data: {
                type: "object",
                description: "操作数据",
                properties: {
                  table: {
                    type: "string",
                    description: "表名"
                  },
                  values: {
                    description: "插入的值（INSERT操作）"
                  },
                  set: {
                    type: "object",
                    description: "更新的字段（UPDATE操作）"
                  },
                  where: {
                    type: "string",
                    description: "WHERE条件（UPDATE/DELETE操作，必需）"
                  },
                  parameters: {
                    type: "array",
                    description: "SQL参数"
                  }
                },
                required: ["table"]
              }
            },
            required: ["connection_name", "operation", "data"]
          }
        },
        {
          name: "aggregate_analyze",
          description: "执行MySQL聚合分析操作",
          inputSchema: {
            type: "object",
            properties: {
              connection_name: {
                type: "string",
                description: "连接名称"
              },
              aggregation_spec: {
                type: "object",
                description: "聚合规范",
                properties: {
                  table: {
                    type: "string",
                    description: "表名"
                  },
                  select: {
                    type: "array",
                    items: { type: "string" },
                    description: "SELECT字段（包含聚合函数）"
                  },
                  where: {
                    type: "string",
                    description: "WHERE条件"
                  },
                  groupBy: {
                    type: "array",
                    items: { type: "string" },
                    description: "GROUP BY字段"
                  },
                  having: {
                    type: "string",
                    description: "HAVING条件"
                  },
                  orderBy: {
                    type: "array",
                    items: { type: "string" },
                    description: "ORDER BY字段"
                  },
                  limit: {
                    type: "number",
                    description: "限制返回数量"
                  },
                  parameters: {
                    type: "array",
                    description: "SQL参数"
                  }
                },
                required: ["table", "select"]
              },
              token_limit: {
                type: "number",
                description: "返回结果的token数量限制，默认8000",
                default: 8000
              },
              break_token_rule: {
                type: "boolean",
                description: "是否打破token限制，默认false",
                default: false
              }
            },
            required: ["connection_name", "aggregation_spec"]
          }
        },
        {
          name: "list_connections",
          description: "列出所有可用的MySQL数据库连接",
          inputSchema: {
            type: "object",
            properties: {
              token_limit: {
                type: "number",
                description: "返回结果的token数量限制，默认8000",
                default: 8000
              },
              break_token_rule: {
                type: "boolean",
                description: "是否打破token限制，默认false",
                default: false
              }
            }
          }
        },
        {
          name: "execute_ddl",
          description: "执行MySQL DDL操作（CREATE/ALTER/DROP/TRUNCATE TABLE）",
          inputSchema: {
            type: "object",
            properties: {
              connection_name: {
                type: "string",
                description: "连接名称"
              },
              ddl_statement: {
                type: "string",
                description: "DDL语句（如：CREATE TABLE, ALTER TABLE, DROP TABLE等）"
              },
              token_limit: {
                type: "number",
                description: "返回结果的token数量限制，默认8000",
                default: 8000
              },
              break_token_rule: {
                type: "boolean",
                description: "是否打破token限制，默认false",
                default: false
              }
            },
            required: ["connection_name", "ddl_statement"]
          }
        },
        {
          name: "list_databases",
          description: "列出所有MySQL数据库",
          inputSchema: {
            type: "object",
            properties: {
              connection_name: {
                type: "string",
                description: "连接名称"
              },
              token_limit: {
                type: "number",
                description: "返回结果的token数量限制，默认8000",
                default: 8000
              },
              break_token_rule: {
                type: "boolean",
                description: "是否打破token限制，默认false",
                default: false
              }
            },
            required: ["connection_name"]
          }
        }
      ]
    };
  });

  // Register handler for tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const pool = await getPool();

      switch (request.params.name) {
        case "query_database": {
          const { query, parameters, token_limit, break_token_rule } = request.params.arguments as any;

          // Validate query type
          const trimmedQuery = query.trim().toUpperCase();
          if (!trimmedQuery.startsWith('SELECT') &&
            !trimmedQuery.startsWith('SHOW') &&
            !trimmedQuery.startsWith('DESCRIBE') &&
            !trimmedQuery.startsWith('EXPLAIN')) {
            return {
              content: [{
                type: "text",
                text: 'Error: query_database只支持SELECT、SHOW、DESCRIBE和EXPLAIN查询'
              }],
              isError: true
            };
          }

          const [rows, fields] = await pool.query<RowDataPacket[]>(query, parameters || []);
          const result = {
            rows,
            rowCount: rows.length,
            fields: fields.map((f: any) => ({
              name: f.name,
              type: f.type,
              table: f.table
            }))
          };

          return checkTokenLimit(result, token_limit || 8000, break_token_rule || false);
        }

        case "get_schema_info": {
          const { object_name, token_limit, break_token_rule } = request.params.arguments as any;

          if (object_name) {
            // Get specific table schema
            const [columns] = await pool.query<RowDataPacket[]>(
              `SELECT 
                column_name as name,
                column_type as type,
                is_nullable as nullable,
                column_key as \`key\`,
                column_default as \`default\`,
                extra,
                column_comment as comment
               FROM information_schema.columns
               WHERE table_name = ? AND table_schema = DATABASE()
               ORDER BY ordinal_position`,
              [object_name]
            );

            const [indexes] = await pool.query<RowDataPacket[]>(
              `SELECT 
                index_name as name,
                GROUP_CONCAT(column_name ORDER BY seq_in_index) as columns,
                non_unique as nonUnique,
                index_type as type
               FROM information_schema.statistics
               WHERE table_name = ? AND table_schema = DATABASE()
               GROUP BY index_name, non_unique, index_type`,
              [object_name]
            );

            const schemaInfo = {
              name: object_name,
              columns,
              indexes
            };

            return checkTokenLimit(schemaInfo, token_limit || 8000, break_token_rule || false);
          } else {
            // Get all tables
            const [tables] = await pool.query<RowDataPacket[]>(
              `SELECT 
                table_name as name,
                table_schema as \`database\`,
                table_rows as rowCount,
                data_length as dataSize,
                index_length as indexSize,
                table_comment as comment
               FROM information_schema.tables
               WHERE table_schema = DATABASE()
               ORDER BY table_name`
            );

            return checkTokenLimit({ tables }, token_limit || 8000, break_token_rule || false);
          }
        }

        case "execute_write": {
          const { operation, data } = request.params.arguments as any;
          let sql: string;
          let params: any[] = [];

          switch (operation) {
            case "insert": {
              if (!data.values) {
                throw new Error('Insert operation requires values');
              }

              if (Array.isArray(data.values)) {
                const keys = Object.keys(data.values[0]);
                const placeholders = data.values.map(() =>
                  `(${keys.map(() => '?').join(', ')})`
                ).join(', ');
                sql = `INSERT INTO ${data.table} (${keys.join(', ')}) VALUES ${placeholders}`;
                params = data.values.flatMap((v: any) => keys.map(k => v[k]));
              } else {
                const keys = Object.keys(data.values);
                const placeholders = keys.map(() => '?').join(', ');
                sql = `INSERT INTO ${data.table} (${keys.join(', ')}) VALUES (${placeholders})`;
                params = keys.map(k => data.values[k]);
              }

              const [insertResult] = await pool.query<ResultSetHeader>(sql, params);
              return {
                content: [{
                  type: "text",
                  text: JSON.stringify({
                    affectedRows: insertResult.affectedRows,
                    insertId: insertResult.insertId
                  }, null, 2)
                }]
              };
            }

            case "update": {
              if (!data.set) {
                throw new Error('Update operation requires set parameter');
              }
              if (!data.where) {
                throw new Error('Update operation requires where parameter for safety');
              }

              const setClause = Object.keys(data.set).map(k => `${k} = ?`).join(', ');
              sql = `UPDATE ${data.table} SET ${setClause} WHERE ${data.where}`;
              params = [...Object.values(data.set), ...(data.parameters || [])];

              const [updateResult] = await pool.query<ResultSetHeader>(sql, params);
              return {
                content: [{
                  type: "text",
                  text: JSON.stringify({
                    affectedRows: updateResult.affectedRows,
                    changedRows: updateResult.changedRows
                  }, null, 2)
                }]
              };
            }

            case "delete": {
              if (!data.where) {
                throw new Error('Delete operation requires where parameter for safety');
              }

              sql = `DELETE FROM ${data.table} WHERE ${data.where}`;
              params = data.parameters || [];

              const [deleteResult] = await pool.query<ResultSetHeader>(sql, params);
              return {
                content: [{
                  type: "text",
                  text: JSON.stringify({
                    affectedRows: deleteResult.affectedRows
                  }, null, 2)
                }]
              };
            }

            default:
              throw new Error(`Unknown operation: ${operation}`);
          }
        }

        case "aggregate_analyze": {
          const { aggregation_spec, token_limit, break_token_rule } = request.params.arguments as any;

          let sql = `SELECT ${aggregation_spec.select.join(', ')} FROM ${aggregation_spec.table}`;

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

          const [rows] = await pool.query<RowDataPacket[]>(sql, aggregation_spec.parameters || []);
          return checkTokenLimit(rows, token_limit || 8000, break_token_rule || false);
        }

        case "list_connections": {
          const { token_limit, break_token_rule } = request.params.arguments as any;

          const connections = [{
            name: "default",
            type: "mysql",
            status: "connected",
            config: {
              host: process.env.MYSQL_HOST || "127.0.0.1",
              port: process.env.MYSQL_PORT || "3306",
              database: config.mysql.database || "MULTI_DB_MODE"
            }
          }];

          return checkTokenLimit(connections, token_limit || 8000, break_token_rule || false);
        }

        case "execute_ddl": {
          const { ddl_statement, token_limit, break_token_rule } = request.params.arguments as any;

          // Validate DDL statement
          const trimmedDDL = ddl_statement.trim().toUpperCase();
          const validDDLKeywords = ['CREATE', 'ALTER', 'DROP', 'TRUNCATE', 'RENAME'];
          const isValidDDL = validDDLKeywords.some(keyword => trimmedDDL.startsWith(keyword));

          if (!isValidDDL) {
            return {
              content: [{
                type: "text",
                text: `Error: execute_ddl只支持DDL操作（CREATE/ALTER/DROP/TRUNCATE/RENAME）`
              }],
              isError: true
            };
          }

          const [result] = await pool.query<ResultSetHeader>(ddl_statement);
          const response = {
            success: true,
            message: "DDL操作执行成功",
            affectedRows: result.affectedRows || 0,
            info: result.info || "Operation completed"
          };

          return checkTokenLimit(response, token_limit || 8000, break_token_rule || false);
        }

        case "list_databases": {
          const { token_limit, break_token_rule } = request.params.arguments as any;

          const [databases] = await pool.query<RowDataPacket[]>(
            `SELECT 
              schema_name as name,
              default_character_set_name as charset,
              default_collation_name as collation
             FROM information_schema.schemata
             WHERE schema_name NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
             ORDER BY schema_name`
          );

          const result = {
            databases: databases,
            count: databases.length
          };

          return checkTokenLimit(result, token_limit || 8000, break_token_rule || false);
        }

        default:
          throw new Error(`Unknown tool: ${request.params.name}`);
      }
    } catch (err) {
      const error = err as Error;
      console.error("Error in CallToolRequest handler:", error.message);
      return {
        content: [{
          type: "text",
          text: `Error: ${error.message}`
        }],
        isError: true
      };
    }
  });

  // Initialize database connection
  (async () => {
    try {
      const pool = await getPool();
      const connection = await pool.getConnection();
      console.error("✓ MySQL database connection successful");
      connection.release();
    } catch (error) {
      console.error("✗ MySQL database connection failed:", error);
      safeExit(1);
    }
  })();

  // Setup shutdown handlers
  const shutdown = async (signal: string): Promise<void> => {
    try {
      if (poolPromise) {
        const pool = await poolPromise;
        await pool.end();
      }
    } catch (err) {
      console.error("Error closing pool:", err);
      throw err;
    }
  };

  process.on("SIGINT", async () => {
    try {
      await shutdown("SIGINT");
      process.exit(0);
    } catch (err) {
      console.error("Error during SIGINT shutdown:", err);
      safeExit(1);
    }
  });

  process.on("SIGTERM", async () => {
    try {
      await shutdown("SIGTERM");
      process.exit(0);
    } catch (err) {
      console.error("Error during SIGTERM shutdown:", err);
      safeExit(1);
    }
  });

  process.on("uncaughtException", (error) => {
    console.error("Uncaught exception:", error);
    safeExit(1);
  });

  process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled rejection:", reason);
    safeExit(1);
  });

  return server;
}

const isMainModule = () => {
  if (typeof require !== 'undefined' && require.main === module) {
    return true;
  }
  if (typeof import.meta !== 'undefined' && import.meta.url && process.argv[1]) {
    const currentModulePath = fileURLToPath(import.meta.url);
    const mainScriptPath = path.resolve(process.argv[1]);
    return currentModulePath === mainScriptPath;
  }
  return false;
}

if (isMainModule()) {
  (async () => {
    try {
      const mcpServer = createMcpServer({ config: { debug: false } });
      if (IS_REMOTE_MCP && REMOTE_SECRET_KEY?.length) {
        const app = express();
        app.use(express.json());
        app.post("/mcp", async (req: Request, res: Response) => {
          if (
            !req.get("Authorization") ||
            !req.get("Authorization")?.startsWith("Bearer ") ||
            !req.get("Authorization")?.endsWith(REMOTE_SECRET_KEY)
          ) {
            console.error("Missing or invalid Authorization header");
            res.status(401).json({
              jsonrpc: "2.0",
              error: {
                code: -32603,
                message: "Missing or invalid Authorization header",
              },
              id: null,
            });
            return;
          }
          try {
            const server = mcpServer;
            const transport: StreamableHTTPServerTransport =
              new StreamableHTTPServerTransport({
                sessionIdGenerator: undefined,
              });
            res.on("close", () => {
              transport.close();
              server.close();
            });
            await server.connect(transport);
            await transport.handleRequest(req, res, req.body);
          } catch (error) {
            console.error("Error handling MCP request:", error);
            if (!res.headersSent) {
              res.status(500).json({
                jsonrpc: "2.0",
                error: {
                  code: -32603,
                  message: (error as any).message,
                },
                id: null,
              });
            }
          }
        });

        app.get("/mcp", async (req: Request, res: Response) => {
          res.writeHead(405).end(
            JSON.stringify({
              jsonrpc: "2.0",
              error: {
                code: -32000,
                message: "Method not allowed.",
              },
              id: null,
            }),
          );
        });

        app.delete("/mcp", async (req: Request, res: Response) => {
          res.writeHead(405).end(
            JSON.stringify({
              jsonrpc: "2.0",
              error: {
                code: -32000,
                message: "Method not allowed.",
              },
              id: null,
            }),
          );
        });

        app.listen(PORT, (error) => {
          if (error) {
            console.error("Failed to start server:", error);
            process.exit(1);
          }
          console.log(`\n✓ MySQL MCP Server (HTTP Mode) is running`);
          console.log(`  Endpoint: http://localhost:${PORT}/mcp`);
          console.log(`  Transport: Streamable HTTP\n`);
        });
      } else {
        process.stderr.write("Starting MySQL MCP Server in Stdio mode\n");
        const transport = new StdioServerTransport();
        await mcpServer.connect(transport);
      }
    } catch (error) {
      console.error("Server error:", error);
      safeExit(1);
    }
  })();
}
