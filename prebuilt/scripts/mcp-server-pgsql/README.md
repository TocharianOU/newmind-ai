# PostgreSQL MCP Server
[![npm version](https://badge.fury.io/js/@tocharian%2Fmcp-server-pgsql.svg)](https://www.npmjs.com/package/@tocharian/mcp-server-pgsql)
[![Downloads](https://img.shields.io/npm/dm/@tocharian/mcp-server-pgsql.svg)](https://www.npmjs.com/package/@tocharian/mcp-server-pgsql)

A Model Context Protocol (MCP) server that provides comprehensive PostgreSQL database management capabilities for AI assistants.

**This project is community-maintained and is not an official product of PostgreSQL or MCP.**

---

## 🚀 Installation

### Quick Install
```bash
# Global installation (recommended)
npm install -g @tocharian/mcp-server-pgsql

# Or local installation
npm install @tocharian/mcp-server-pgsql
```

### Alternative: From Source
```bash
git clone https://github.com/TocharianOU/mcp-server-pgsql.git
cd mcp-server-pgsql
npm install
npm run build
```

---

## 🎯 Quick Start

### Method 1: Direct CLI Usage

```bash
# Using environment variables
POSTGRES_HOST=localhost \
POSTGRES_PORT=5432 \
POSTGRES_USER=postgres \
POSTGRES_PASS=password \
POSTGRES_DB=mydb \
/path/to/build/index.js
```

### Method 2: Claude Desktop Integration (Recommended)
Add to your Claude Desktop configuration file:

**Config file locations:**
- **MacOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "pgsql-mcp-server": {
      "command": "node",
      "args": ["/path/to/build/index.js"],
      "env": {
        "POSTGRES_HOST": "localhost",
        "POSTGRES_PORT": "5432",
        "POSTGRES_USER": "postgres",
        "POSTGRES_PASS": "password",
        "POSTGRES_DB": "mydb"
      }
    }
  }
}
```

### Method 3: Using Environment File
```bash
# Create .env file
cat > pgsql-mcp.env << EOF
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASS=password
POSTGRES_DB=mydb
EOF

# Run with environment file
env $(cat pgsql-mcp.env | xargs) /path/to/build/index.js
```

### Method 4: Streamable HTTP Mode (NEW)

Run the server as a standalone HTTP service for remote access and API integration:

```bash
# Start HTTP server (default port 3001)
MCP_TRANSPORT=http \
POSTGRES_HOST=localhost \
POSTGRES_PORT=5432 \
POSTGRES_USER=postgres \
POSTGRES_PASS=password \
POSTGRES_DB=mydb \
/path/to/build/index.js

# Or with custom port and host
MCP_TRANSPORT=http \
MCP_HTTP_PORT=9000 \
MCP_HTTP_HOST=0.0.0.0 \
POSTGRES_HOST=localhost \
POSTGRES_USER=postgres \
POSTGRES_PASS=password \
/path/to/build/index.js
```

**HTTP Mode Features:**
- Exposes MCP server at `http://host:port/mcp` endpoint
- Health check available at `http://host:port/health`
- Session-based connection management
- Supports both POST (JSON-RPC requests) and GET (SSE streams)
- Compatible with any HTTP client or MCP SDK

**Example HTTP client usage:**
```javascript
// Initialize connection
const response = await fetch('http://localhost:3000/mcp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'my-client', version: '1.0.0' }
    },
    id: 1
  })
});

const sessionId = response.headers.get('mcp-session-id');

// Subsequent requests include session ID
const toolsResponse = await fetch('http://localhost:3000/mcp', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'mcp-session-id': sessionId
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    method: 'tools/list',
    params: {},
    id: 2
  })
});
```

---

## Features

### Core Features
- Connect to local or remote PostgreSQL instances
- **Dual transport modes**:
  - **Stdio transport** (default) - For Claude Desktop and local MCP clients
  - **Streamable HTTP transport** (NEW) - For remote access, API integration, and web applications
- Flexible connection configuration (CLI args, env vars, or per-tool)
- SSL/TLS and custom certificate support
- Type-safe, extensible, and easy to integrate
- **Session management** with automatic UUID generation for HTTP mode
- **Health check endpoint** for monitoring and load balancing

### Five Core Tools

This server implements the **Database MCP Tools Standard v1.0** with five essential tools:

#### 1. **query_database**
Execute SELECT queries against PostgreSQL database.

**Parameters:**
- `connection_name` (required): Connection identifier
- `query` (required): SQL query string (SELECT/SHOW/EXPLAIN)
- `parameters` (optional): Query parameters for prepared statements
- `token_limit` (optional): Result size limit in tokens (default: 8000)
- `break_token_rule` (optional): Bypass token limit (default: false)

**Returns:** Query results in JSON format

**Use Cases:**
- Log queries and analysis
- Security event retrieval
- Data exploration
- Application data access

#### 2. **get_schema_info**
Retrieve database structure and table information.

**Parameters:**
- `connection_name` (required): Connection identifier
- `object_name` (optional): Table name (omit to list all tables/schemas)
- `token_limit` (optional): Result size limit in tokens (default: 8000)
- `break_token_rule` (optional): Bypass token limit (default: false)

**Returns:**
- Schema/table list (if no object_name specified)
- Table structure with columns, indexes, and constraints (if object_name specified)

**Use Cases:**
- Understanding data structure
- Schema discovery
- Database documentation
- Query planning

#### 3. **execute_write**
Perform data modification operations (INSERT/UPDATE/DELETE).

**Parameters:**
- `connection_name` (required): Connection identifier
- `operation` (required): Operation type - "insert", "update", or "delete"
- `data` (required): Operation-specific data:
  - `table` (required): Table name
  - For INSERT: `values` - data to insert
  - For UPDATE: `set` and `where` - update data and filter
  - For DELETE: `where` - deletion criteria
  - `parameters` - SQL parameters for prepared statements
- `token_limit` (optional): Result size limit in tokens (default: 8000)
- `break_token_rule` (optional): Bypass token limit (default: false)

**Returns:** Operation result with affected rows count

**Use Cases:**
- Data modification
- Configuration updates
- Threat intelligence ingestion
- User management

#### 4. **aggregate_analyze**
Execute aggregation and statistical queries (GROUP BY, COUNT, SUM, etc.).

**Parameters:**
- `connection_name` (required): Connection identifier
- `aggregation_spec` (required): Aggregation specification:
  - `query` (required): SQL query with GROUP BY, aggregation functions
  - `parameters` (optional): Query parameters
- `token_limit` (optional): Result size limit in tokens (default: 8000)
- `break_token_rule` (optional): Bypass token limit (default: false)

**Returns:** Aggregation results

**Use Cases:**
- Security event statistics
- Trend analysis
- Threat indicator aggregation
- Performance metrics
- Complex reporting

#### 5. **list_connections**
List available database connections and their status.

**Parameters:**
- `token_limit` (optional): Result size limit in tokens (default: 8000)
- `break_token_rule` (optional): Bypass token limit (default: false)

**Returns:** Array of connection information including:
- Connection name
- Database type
- Connection status
- Database configuration

**Use Cases:**
- Connection management
- System diagnostics
- Multi-database scenarios

### Token Limiting

All tools implement automatic token limiting to prevent context overflow:

- **Default Limit**: 8,000 tokens per response
- **Automatic Rejection**: Responses exceeding the limit are rejected with optimization suggestions
- **Bypass Option**: Set `break_token_rule: true` to force return of complete results

**Optimization Suggestions When Limit Exceeded:**
1. Use LIMIT clause to reduce returned rows
2. Add more specific WHERE conditions
3. Use pagination with OFFSET/LIMIT
4. SELECT only needed columns instead of SELECT *
5. Set `break_token_rule: true` if full results are essential

---

## Directory Structure

```
├── src/
│   ├── index.ts                # Server entry point & tool registration
│   ├── types/
│   │   └── tool.ts             # Type definitions and schemas
│   ├── utils/
│   │   └── connection.ts       # Database connection management
│   └── tools/
│       ├── analyze.ts          # Database analysis tools
│       ├── comments.ts         # Comment management tools
│       ├── constraints.ts      # Constraint management tools
│       ├── data.ts             # Data operation tools
│       ├── debug.ts            # Debug tools
│       ├── enums.ts            # Enum management tools
│       ├── functions.ts        # Function management tools
│       ├── indexes.ts          # Index management tools
│       ├── migration.ts        # Data migration tools
│       ├── monitor.ts          # Monitoring tools
│       ├── performance.ts      # Performance tools
│       ├── query.ts            # Query management tools
│       ├── schema.ts           # Schema management tools
│       ├── triggers.ts         # Trigger management tools
│       └── users.ts            # User management tools
├── start-http.sh               # HTTP mode startup script
├── README.md                   # English documentation
└── README_zh.md                # Chinese documentation
```

---

## Configuration

Configure the server via environment variables or command line arguments:

### PostgreSQL Connection Settings
| Variable Name                    | Description                                         | Required | Default |
|----------------------------------|-----------------------------------------------------|----------|---------|
| `POSTGRES_HOST`                  | PostgreSQL server host                              | No       | `localhost` |
| `POSTGRES_PORT`                  | PostgreSQL server port                              | No       | `5432` |
| `POSTGRES_USER`                  | PostgreSQL username                                 | No       | `postgres` |
| `POSTGRES_PASS`                  | PostgreSQL password                                 | No       | - |
| `POSTGRES_DB`                    | Database name (leave empty for multi-DB mode)       | No       | `postgres` |
| `NODE_TLS_REJECT_UNAUTHORIZED`   | Set to `0` to disable SSL certificate validation (use with caution) | No | - |

**Compatibility**: Also supports `POSTGRES_PASSWORD`, `POSTGRES_DATABASE` aliases

### Transport Mode Settings
| Variable Name     | Description                                    | Default   | Values          |
|-------------------|------------------------------------------------|-----------|-----------------|
| `MCP_TRANSPORT`   | Transport mode selection                       | `stdio`   | `stdio`, `http` |
| `MCP_HTTP_PORT`   | HTTP server port (when using HTTP transport)   | `3000`    | 1-65535         |
| `MCP_HTTP_HOST`   | HTTP server host (when using HTTP transport)   | `localhost` | Any valid host  |

**Transport Mode Details:**
- **Stdio mode** (default): For Claude Desktop and local MCP clients
- **HTTP mode**: Runs as a standalone HTTP server for remote access, API integration, and web applications

---

## 📦 Package Information

- **NPM Package**: [@tocharian/mcp-server-pgsql](https://www.npmjs.com/package/@tocharian/mcp-server-pgsql)
- **GitHub Repository**: [TocharianOU/mcp-server-pgsql](https://github.com/TocharianOU/mcp-server-pgsql)
- **Node.js**: >= 18.0.0

---

## 🔧 Troubleshooting

### Common Issues

#### Connection issues
- Verify PostgreSQL connection string is correct
- Check authentication credentials
- Ensure database is accessible from your network
- For SSL issues, try setting `NODE_TLS_REJECT_UNAUTHORIZED=0`

#### Claude Desktop not detecting the server
- Restart Claude Desktop after config changes
- Check config file syntax with a JSON validator
- Verify environment variables or command line arguments are set correctly
- Ensure the path to `build/index.js` is absolute and correct

---

## Example Queries

### Basic Queries
- "Analyze the performance of my database"
- "Show me all tables in the database"
- "Get the structure of the users table"
- "Find slow queries running in the database"

### Schema Management
- "Create a new table called 'products' with id, name, and price columns"
- "Add a new column 'email' to the users table"
- "Create an index on the email column for faster lookups"
- "Show me all foreign key constraints"

### Data Operations
- "Query all users created after 2024-01-01"
- "Insert a new product with name 'Widget' and price 29.99"
- "Update the price of product with id 5 to 39.99"
- "Delete all inactive users older than 1 year"

### Performance & Debugging
- "Explain the query plan for SELECT * FROM orders WHERE user_id = 123"
- "Show me database locks and blocking queries"
- "Monitor database connections and active queries"
- "Check table statistics and vacuum status"

---

## Development

Install dependencies:

```bash
npm install
```

Build the server:

```bash
npm run build
```

Auto-rebuild in development mode:

```bash
npm run watch
```

Run in different modes:

```bash
# Stdio mode (default)
npm start

# HTTP mode
npm run start:http

# Development with TypeScript
npm run start:ts

# HTTP mode with TypeScript
npm run start:http:ts
```

---

## 📚 Documentation

For additional information, see the [`docs/`](./docs/) folder:

- **[📖 Usage Guide](./docs/USAGE.md)** - Comprehensive tool usage and examples
- **[🛠️ Development Guide](./docs/DEVELOPMENT.md)** - Setup and contribution guide  
- **[⚙️ Technical Details](./docs/TECHNICAL.md)** - Architecture and implementation
- **[👨‍💻 Developer Reference](./docs/DEVELOPER.md)** - API reference and advanced usage
- **[📋 Documentation Index](./docs/INDEX.md)** - Complete documentation overview
- **[📋 Tool Schemas](./TOOL_SCHEMAS.md)** - All tool parameters & examples

---

## Community

This project is community-maintained. Contributions and feedback are welcome! Please be respectful and inclusive in all communications.

---

## License

This project is licensed under the AGPLv3 License. See the [LICENSE](LICENSE) file for details.

---

## Troubleshooting

- Check if MCP configuration is correct
- Ensure the PostgreSQL address is accessible
- Verify authentication credentials have sufficient permissions
- If using a custom certificate, ensure the certificate path is correct and readable
- If using `NODE_TLS_REJECT_UNAUTHORIZED=0`, be aware of security risks
- Check error messages output in the terminal
