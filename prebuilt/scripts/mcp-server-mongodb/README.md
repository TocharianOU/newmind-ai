# MongoDB MCP Server

[![npm version](https://badge.fury.io/js/@tocharian%2Fmcp-server-mongodb.svg)](https://www.npmjs.com/package/@tocharian/mcp-server-mongodb)
[![License](https://img.shields.io/github/license/tocharian/mcp-server-mongodb)](./LICENSE)

A MongoDB MCP server implementation that provides standardized database access through five core tools, designed for AI assistants and security operations.

**This project is community-maintained and is not an official product of MongoDB or MCP.**

---

## 🚀 Installation

### Quick Install
```bash
# Global installation (recommended)
npm install -g @tocharian/mcp-server-mongodb

# Or local installation
npm install @tocharian/mcp-server-mongodb
```

### Alternative: From Source
```bash
git clone https://github.com/tocharian/mcp-server-mongodb.git
cd mcp-server-mongodb
npm install
```

---

## 🎯 Quick Start

### Method 1: Direct CLI Usage

```bash
# Using environment variables
MONGODB_HOST=localhost \
MONGODB_PORT=27017 \
MONGODB_USER=admin \
MONGODB_PASS=password \
/path/to/index.js
```

### Method 2: Claude Desktop Integration (Recommended)
Add to your Claude Desktop configuration file:

**Config file locations:**
- **MacOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "mcp-server-mongodb": {
      "command": "/path/to/node",
      "args": [
        "/path/to/index.js"
      ],
      "env": {
        "MONGODB_HOST": "localhost",
        "MONGODB_PORT": "27017",
        "MONGODB_USER": "admin",
        "MONGODB_PASS": "password"
      }
    }
  }
}
```

### Method 3: Streamable HTTP Mode

Run the server as a standalone HTTP service for remote access and API integration:

```bash
# Start HTTP server (default port 3002)
MCP_TRANSPORT=http \
MCP_HTTP_PORT=3002 \
MCP_HTTP_HOST=0.0.0.0 \
MONGODB_HOST=localhost \
MONGODB_PORT=27017 \
MONGODB_USER=admin \
MONGODB_PASS=password \
/path/to/index.js

# Or use the startup script
./start-http.sh
```

**HTTP Mode Features:**
- Exposes MCP server at `http://host:port/mcp` endpoint
- Health check available at `http://host:port/health`
- Session-based connection management
- Supports both POST (JSON-RPC requests) and GET (SSE streams)
- Compatible with any HTTP client or MCP SDK

---

## Features

### Core Features
- Connect to local or remote MongoDB instances
- **Dual transport modes**:
  - **Stdio transport** (default) - For Claude Desktop and local MCP clients
  - **Streamable HTTP transport** - For remote access, API integration, and web applications
- **Token-limited responses** - Automatic result size management with configurable limits
- Natural language query support via LLMs
- SSL/TLS and authentication support
- Type-safe, extensible, and easy to integrate

### Five Core Tools

This server implements the **Database MCP Tools Standard v1.0** with five essential tools:

#### 1. **query_database**
Execute MongoDB find queries with full control over filters and options.

**Parameters:**
- `connection_name` (required): Connection identifier
- `query` (required): MongoDB query filter object
- `parameters` (required): Query options including:
  - `collection` (required): Collection name
  - `projection`: Fields to return
  - `sort`: Sort specification
  - `limit`: Maximum documents to return
  - `skip`: Number of documents to skip
- `token_limit` (optional): Result size limit in tokens (default: 8000)
- `break_token_rule` (optional): Bypass token limit (default: false)

**Returns:** Query results with document count

**Use Cases:**
- Log queries and analysis
- Security event retrieval
- Data exploration
- Application data access

**Example:**
```json
{
  "connection_name": "default",
  "query": { "status": "active", "created_at": { "$gte": "2024-01-01" } },
  "parameters": {
    "collection": "users",
    "projection": { "name": 1, "email": 1 },
    "sort": { "created_at": -1 },
    "limit": 100
  },
  "token_limit": 8000
}
```

#### 2. **get_schema_info**
Retrieve database structure, collection information, and sample documents.

**Parameters:**
- `connection_name` (required): Connection identifier
- `object_name` (optional): Collection name (omit to list all collections)
- `token_limit` (optional): Result size limit in tokens (default: 8000)
- `break_token_rule` (optional): Bypass token limit (default: false)

**Returns:**
- Database name
- Collections list (if no object_name specified)
- Collection details with sample document, indexes, and statistics (if object_name specified)

**Use Cases:**
- Understanding data structure
- Schema discovery
- Database documentation
- Query planning

**Example:**
```json
{
  "connection_name": "default",
  "object_name": "users",
  "token_limit": 8000
}
```

#### 3. **execute_write**
Perform data modification operations (INSERT/UPDATE/DELETE).

**Parameters:**
- `connection_name` (required): Connection identifier
- `operation` (required): Operation type - "insert", "update", or "delete"
- `data` (required): Operation-specific data:
  - `collection` (required): Collection name
  - For INSERT: `document` - single document or array of documents
  - For UPDATE: `filter` and `update` - filter criteria and update operations
  - For DELETE: `filter` - deletion criteria
  - `options` - Additional options (e.g., `upsert`, `multi`)
- `token_limit` (optional): Result size limit in tokens (default: 8000)
- `break_token_rule` (optional): Bypass token limit (default: false)

**Returns:** Operation result with acknowledged status and affected count

**Use Cases:**
- Data modification
- Configuration updates
- Threat intelligence ingestion
- User management

**Example INSERT:**
```json
{
  "connection_name": "default",
  "operation": "insert",
  "data": {
    "collection": "logs",
    "document": { "level": "info", "message": "System started", "timestamp": "2024-12-15T10:00:00Z" }
  }
}
```

**Example UPDATE:**
```json
{
  "connection_name": "default",
  "operation": "update",
  "data": {
    "collection": "users",
    "filter": { "email": "user@example.com" },
    "update": { "$set": { "status": "inactive" } }
  }
}
```

#### 4. **aggregate_analyze**
Execute MongoDB aggregation pipelines for complex data analysis.

**Parameters:**
- `connection_name` (required): Connection identifier
- `aggregation_spec` (required): Aggregation specification:
  - `collection` (required): Collection name
  - `pipeline` (required): MongoDB aggregation pipeline array
- `token_limit` (optional): Result size limit in tokens (default: 8000)
- `break_token_rule` (optional): Bypass token limit (default: false)

**Returns:** Aggregation results with pipeline details

**Use Cases:**
- Security event statistics
- Trend analysis
- Threat indicator aggregation
- Performance metrics
- Complex reporting

**Example:**
```json
{
  "connection_name": "default",
  "aggregation_spec": {
    "collection": "security_events",
    "pipeline": [
      { "$match": { "severity": "high", "timestamp": { "$gte": "2024-12-01" } } },
      { "$group": { "_id": "$event_type", "count": { "$sum": 1 } } },
      { "$sort": { "count": -1 } }
    ]
  }
}
```

#### 5. **list_connections**
List available database connections and their status.

**Parameters:**
- `token_limit` (optional): Result size limit in tokens (default: 8000)
- `break_token_rule` (optional): Bypass token limit (default: false)

**Returns:** Array of connection information including:
- Connection name
- Database type
- Connection status
- Current database name
- Obfuscated URI

**Use Cases:**
- Connection management
- System diagnostics
- Multi-database scenarios

**Example Response:**
```json
[
  {
    "name": "default",
    "type": "mongodb",
    "status": "connected",
    "database": "security_db",
    "uri": "mongodb://****:****@localhost:27017"
  }
]
```

---

## Token Limiting

All tools implement automatic token limiting to prevent context overflow:

- **Default Limit**: 8,000 tokens per response
- **Automatic Rejection**: Responses exceeding the limit are rejected with optimization suggestions
- **Bypass Option**: Set `break_token_rule: true` to force return of complete results

**Optimization Suggestions When Limit Exceeded:**
1. Use `limit` to reduce returned documents
2. Add more specific filter conditions
3. Use pagination with `skip` and `limit`
4. Use `projection` to return only needed fields
5. Set `break_token_rule: true` if full results are essential

---

## Configuration

Configure the server via environment variables:

### MongoDB Connection Settings
| Variable Name     | Description                              | Required | Default |
|-------------------|------------------------------------------|----------|---------|
| `MONGODB_HOST`    | MongoDB server host                      | No       | `localhost` |
| `MONGODB_PORT`    | MongoDB server port                      | No       | `27017` |
| `MONGODB_USER`    | MongoDB username                         | No       | - |
| `MONGODB_PASS`    | MongoDB password                         | No       | - |
| `MONGODB_DB`      | Database name (leave empty for multi-DB mode) | No  | - |

**Compatibility**: Also supports `MONGODB_USERNAME`, `MONGODB_PASSWORD` aliases

### Transport Mode Settings
| Variable Name     | Description                              | Default     | Values          |
|-------------------|------------------------------------------|-------------|-----------------|
| `MCP_TRANSPORT`   | Transport mode selection                 | `stdio`     | `stdio`, `http` |
| `MCP_HTTP_PORT`   | HTTP server port (when using HTTP)       | `3002`      | 1-65535         |
| `MCP_HTTP_HOST`   | HTTP server host (when using HTTP)       | `localhost` | Any valid host  |

**Transport Mode Details:**
- **Stdio mode** (default): For Claude Desktop and local MCP clients
- **HTTP mode**: Runs as a standalone HTTP server for remote access, API integration, and web applications

---

## Example Queries

### Basic Queries
- "Find all users created after 2024-01-01"
- "Count documents in the logs collection"
- "Show me the structure of the security_events collection"
- "List all available databases"

### Data Operations
- "Insert a new security event with severity high"
- "Update all inactive users to set status as archived"
- "Delete logs older than 30 days"

### Aggregation Analysis
- "Show me security events grouped by severity"
- "Analyze login patterns by hour of day"
- "Count failed authentication attempts by user"
- "Show top 10 most frequent event types"

---

## Development

Install dependencies:

```bash
npm install
```

Run in different modes:

```bash
# Stdio mode (default)
npm start

# HTTP mode
npm run start:http

# With custom configuration
MONGODB_HOST=localhost \
MONGODB_USER=admin \
MONGODB_PASS=password \
node index.js
```

---

## 📦 Package Information

- **NPM Package**: [@tocharian/mcp-server-mongodb](https://www.npmjs.com/package/@tocharian/mcp-server-mongodb)
- **GitHub Repository**: [tocharian/mcp-server-mongodb](https://github.com/tocharian/mcp-server-mongodb)
- **Node.js**: >= 18.0.0
- **Author**: @tocharian

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

## Troubleshooting

### Common Issues

#### Connection issues
- Verify MongoDB URI is accessible
- Check authentication credentials
- Ensure database server is running
- For SSL issues, try setting `NODE_TLS_REJECT_UNAUTHORIZED=0`

#### Claude Desktop not detecting the server
- Restart Claude Desktop after config changes
- Check config file syntax with a JSON validator
- Verify file paths are absolute and correct

#### Token limit exceeded errors
- Reduce the number of returned documents using `limit`
- Add more specific filter conditions
- Use `projection` to return only necessary fields
- Set `break_token_rule: true` if you need complete results

---

## Community

This project is community-maintained. Contributions and feedback are welcome!
