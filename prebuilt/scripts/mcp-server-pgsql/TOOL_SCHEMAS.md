# PostgreSQL MCP Server - Complete Tool Schema Reference

> **Quick Reference**: This document contains the complete parameter schemas for all 17 tools. No more hunting through multiple docs!

## 🚀 Quick Navigation

| Category | Tools |
|----------|-------|
| [**Meta-Tools**](#meta-tools-consolidated-operations) | [Schema](#schema-management) • [Users](#user--permissions-management) • [Query](#query-performance--analysis) • [Index](#index-management) • [Functions](#functions-management) • [Triggers](#triggers-management) • [Constraints](#constraint-management) • [RLS](#row-level-security-rls) |
| [**🆕 Enhancement Tools**](#enhancement-tools-new-capabilities) | [Execute Query](#execute-query) • [Execute Mutation](#execute-mutation) • [Execute SQL](#execute-sql) • [Comments](#comments-management) |
| [**Specialized**](#specialized-tools) | [Analysis](#database-analysis) • [Debug](#database-debugging) • [Export/Import](#data-exportimport) • [Copy](#copy-between-databases) • [Monitor](#real-time-monitoring) |

---

## Meta-Tools (Consolidated Operations)

### Schema Management
**Tool:** `pg_manage_schema`

#### Get Schema Information
```json
{
  "operation": "get_info",
  "schema": "public",           // optional, defaults to "public"
  "tableName": "users"          // optional, omit to list all tables
}
```

#### Create Table
```json
{
  "operation": "create_table",
  "tableName": "users",         // required
  "schema": "public",           // optional, defaults to "public"
  "columns": [                  // required
    {
      "name": "id",             // required
      "type": "SERIAL",         // required: PostgreSQL data type
      "nullable": false,        // optional, defaults to true
      "default": "DEFAULT_VALUE" // optional
    }
  ]
}
```

#### Alter Table
```json
{
  "operation": "alter_table",
  "tableName": "users",         // required
  "schema": "public",           // optional
  "operations": [               // required
    {
      "type": "add",            // required: "add" | "alter" | "drop"
      "columnName": "email",    // required
      "dataType": "VARCHAR(255)", // required for add/alter
      "nullable": false,        // optional for add/alter
      "default": "DEFAULT_VALUE" // optional for add/alter
    }
  ]
}
```

#### Get ENUMs
```json
{
  "operation": "get_enums",
  "schema": "public",           // optional
  "enumName": "user_role"       // optional, filter by specific enum
}
```

#### Create ENUM
```json
{
  "operation": "create_enum",
  "enumName": "status",         // required
  "values": ["active", "inactive"], // required
  "schema": "public",           // optional
  "ifNotExists": true           // optional
}
```

---

### User & Permissions Management
**Tool:** `pg_manage_users`

#### Create User
```json
{
  "operation": "create",
  "username": "newuser",        // required
  "password": "securepass",     // required
  "login": true,                // optional
  "createdb": false,            // optional
  "createrole": false,          // optional
  "superuser": false,           // optional
  "replication": false,         // optional
  "inherit": true,              // optional
  "connectionLimit": 10,        // optional
  "validUntil": "2024-12-31"    // optional: YYYY-MM-DD
}
```

#### Grant Permissions
```json
{
  "operation": "grant",
  "username": "testuser",       // required
  "permissions": ["SELECT", "INSERT"], // required: array of permissions
  "target": "users",            // required: object name
  "targetType": "table",        // required: "table" | "schema" | "database" | "sequence" | "function"
  "schema": "public",           // optional
  "withGrantOption": false      // optional
}
```

#### Other User Operations
```json
// List users
{ "operation": "list", "includeSystemRoles": false }

// Drop user  
{ "operation": "drop", "username": "olduser", "ifExists": true, "cascade": false }

// Alter user
{ "operation": "alter", "username": "user", "password": "newpass", "login": false }

// Revoke permissions
{ "operation": "revoke", "username": "user", "permissions": ["DELETE"], "target": "table", "targetType": "table" }

// Get user permissions
{ "operation": "get_permissions", "username": "user", "schema": "public" }
```

---

### Query Performance & Analysis  
**Tool:** `pg_manage_query`

#### EXPLAIN Query
```json
{
  "operation": "explain",
  "query": "SELECT * FROM users WHERE email = $1", // required
  "analyze": false,             // optional: actually execute query
  "verbose": false,             // optional: include verbose output
  "costs": true,                // optional: include cost estimates
  "buffers": false,             // optional: include buffer usage
  "format": "json"              // optional: "text" | "json" | "xml" | "yaml"
}
```

#### Get Slow Queries
```json
{
  "operation": "get_slow_queries",
  "limit": 10,                  // optional, defaults to 10
  "minDuration": 100,           // optional: minimum avg duration in ms
  "orderBy": "mean_time",       // optional: "mean_time" | "total_time" | "calls" | "cache_hit_ratio"
  "includeNormalized": true     // optional: include normalized query text
}
```

#### Other Query Operations
```json
// Get query statistics
{ "operation": "get_stats", "queryPattern": "SELECT", "minCalls": 5, "orderBy": "mean_time" }

// Reset query statistics  
{ "operation": "reset_stats", "queryId": "12345" } // queryId optional, resets all if omitted
```

---

### Index Management
**Tool:** `pg_manage_indexes`

#### Create Index
```json
{
  "operation": "create",
  "indexName": "idx_users_email", // required
  "tableName": "users",         // required
  "columns": ["email"],         // required: array of column names
  "schema": "public",           // optional
  "unique": false,              // optional
  "concurrent": false,          // optional: create concurrently
  "method": "btree",            // optional: "btree" | "hash" | "gist" | "spgist" | "gin" | "brin"
  "where": "email IS NOT NULL", // optional: partial index condition
  "ifNotExists": false          // optional
}
```

#### Other Index Operations
```json
// List indexes
{ "operation": "get", "tableName": "users", "includeStats": true }

// Drop index
{ "operation": "drop", "indexName": "old_idx", "concurrent": false, "ifExists": true, "cascade": false }

// Reindex
{ "operation": "reindex", "type": "index", "target": "idx_name" } // type: "index" | "table" | "schema" | "database"

// Analyze index usage
{ "operation": "analyze_usage", "showUnused": true, "showDuplicates": true, "minSizeBytes": 1000 }
```

---

### Functions Management
**Tool:** `pg_manage_functions`

#### Create Function
```json
{
  "operation": "create",
  "functionName": "calculate_total", // required
  "parameters": "price DECIMAL, tax DECIMAL", // required (use "" for no params)
  "returnType": "DECIMAL",          // required
  "functionBody": "BEGIN RETURN price + (price * tax); END;", // required
  "language": "plpgsql",            // optional: "sql" | "plpgsql" | "plpython3u"
  "schema": "public",               // optional
  "replace": false,                 // optional: CREATE OR REPLACE
  "volatility": "VOLATILE",         // optional: "VOLATILE" | "STABLE" | "IMMUTABLE"
  "security": "INVOKER"             // optional: "INVOKER" | "DEFINER"
}
```

#### Other Function Operations
```json
// List functions
{ "operation": "get", "functionName": "calc%", "schema": "public" } // functionName optional for filtering

// Drop function
{ "operation": "drop", "functionName": "old_func", "parameters": "INT, TEXT", "ifExists": true, "cascade": false }
```

---

### Triggers Management
**Tool:** `pg_manage_triggers`

#### Create Trigger
```json
{
  "operation": "create",
  "triggerName": "audit_trigger",  // required
  "tableName": "users",            // required
  "functionName": "audit_function", // required
  "timing": "AFTER",               // optional: "BEFORE" | "AFTER" | "INSTEAD OF"
  "events": ["INSERT", "UPDATE"],  // optional: array of "INSERT" | "UPDATE" | "DELETE" | "TRUNCATE"
  "forEach": "ROW",                // optional: "ROW" | "STATEMENT"
  "when": "NEW.active = true",     // optional: WHEN condition
  "schema": "public",              // optional
  "replace": false                 // optional
}
```

#### Other Trigger Operations
```json
// List triggers
{ "operation": "get", "tableName": "users", "schema": "public" }

// Drop trigger
{ "operation": "drop", "triggerName": "old_trigger", "tableName": "users", "ifExists": true, "cascade": false }

// Enable/disable trigger
{ "operation": "set_state", "triggerName": "my_trigger", "tableName": "users", "enable": true }
```

---

### Constraint Management
**Tool:** `pg_manage_constraints`

#### Create Foreign Key
```json
{
  "operation": "create_fk",
  "constraintName": "fk_user_id",   // required
  "tableName": "orders",            // required
  "columnNames": ["user_id"],       // required
  "referencedTable": "users",       // required
  "referencedColumns": ["id"],      // required
  "schema": "public",               // optional
  "referencedSchema": "public",     // optional
  "onDelete": "CASCADE",            // optional: "NO ACTION" | "RESTRICT" | "CASCADE" | "SET NULL" | "SET DEFAULT"
  "onUpdate": "NO ACTION",          // optional
  "deferrable": false,              // optional
  "initiallyDeferred": false        // optional
}
```

#### Create Other Constraints
```json
{
  "operation": "create",
  "constraintName": "unique_email", // required
  "tableName": "users",            // required
  "constraintType": "unique",      // required: "unique" | "check" | "primary_key"
  "columnNames": ["email"],        // required for unique/primary_key
  "checkExpression": "email LIKE '%@%'", // required for check constraints
  "schema": "public"               // optional
}
```

#### Other Constraint Operations
```json
// List constraints
{ "operation": "get", "tableName": "users", "constraintType": "FOREIGN KEY" }

// Drop constraint
{ "operation": "drop", "constraintName": "old_constraint", "tableName": "users", "ifExists": true, "cascade": false }

// Drop foreign key
{ "operation": "drop_fk", "constraintName": "fk_old", "tableName": "orders", "ifExists": true, "cascade": false }
```

---

### Row-Level Security (RLS)
**Tool:** `pg_manage_rls`

#### Enable/Disable RLS
```json
// Enable RLS
{ "operation": "enable", "tableName": "users", "schema": "public" }

// Disable RLS  
{ "operation": "disable", "tableName": "users", "schema": "public" }
```

#### Create RLS Policy
```json
{
  "operation": "create_policy",
  "tableName": "users",            // required
  "policyName": "user_isolation",  // required
  "using": "user_id = current_user_id()", // required: USING expression
  "check": "user_id = current_user_id()", // optional: WITH CHECK expression
  "command": "ALL",                // optional: "ALL" | "SELECT" | "INSERT" | "UPDATE" | "DELETE"
  "role": "authenticated",         // optional: role name
  "schema": "public",              // optional
  "replace": false                 // optional
}
```

#### Other RLS Operations
```json
// List policies
{ "operation": "get_policies", "tableName": "users", "schema": "public" }

// Edit policy
{ "operation": "edit_policy", "policyName": "policy1", "tableName": "users", "using": "new_condition", "roles": ["role1", "role2"] }

// Drop policy  
{ "operation": "drop_policy", "policyName": "old_policy", "tableName": "users", "ifExists": true }
```

---

## Enhancement Tools (New Capabilities)

### Execute Query
**Tool:** `pg_execute_query`  
*For SELECT operations with advanced features*

#### Basic SELECT
```json
{
  "operation": "select",
  "query": "SELECT * FROM users WHERE active = $1", // required: SELECT query
  "parameters": [true],         // optional: parameters for $1, $2, etc.
  "limit": 100,                 // optional: safety limit on rows
  "timeout": 30000,             // optional: query timeout in ms
  "connectionString": "postgresql://..." // optional if env var set
}
```

#### Count Rows
```json
{
  "operation": "count",
  "query": "SELECT COUNT(*) FROM users WHERE created_at > $1",
  "parameters": ["2024-01-01"],
  "timeout": 10000
}
```

#### Check Existence
```json
{
  "operation": "exists",
  "query": "SELECT 1 FROM users WHERE email = $1",
  "parameters": ["user@example.com"]
}
```

---

### Execute Mutation
**Tool:** `pg_execute_mutation`  
*For INSERT/UPDATE/DELETE/UPSERT operations*

#### Insert Data
```json
{
  "operation": "insert",
  "table": "users",             // required: table name
  "data": {                     // required: data object
    "name": "John Doe",
    "email": "john@example.com",
    "active": true
  },
  "schema": "public",           // optional: defaults to "public"
  "returning": "*",             // optional: RETURNING clause
  "connectionString": "postgresql://..." // optional if env var set
}
```

#### Update Data
```json
{
  "operation": "update",
  "table": "users",             // required
  "data": {                     // required: fields to update
    "name": "Jane Doe",
    "updated_at": "NOW()"
  },
  "where": "id = 123",          // required: WHERE clause (without WHERE)
  "schema": "public",           // optional
  "returning": "id, name, updated_at" // optional
}
```

#### Delete Data
```json
{
  "operation": "delete",
  "table": "users",             // required
  "where": "active = false AND last_login < '2023-01-01'", // required
  "schema": "public"            // optional
}
```

#### Upsert (INSERT ... ON CONFLICT)
```json
{
  "operation": "upsert",
  "table": "users",             // required
  "data": {                     // required: data to insert/update
    "email": "user@example.com",
    "name": "Updated Name",
    "last_seen": "NOW()"
  },
  "conflictColumns": ["email"], // required: columns for ON CONFLICT
  "returning": "*"              // optional
}
```

---

### Execute SQL
**Tool:** `pg_execute_sql`  
*For arbitrary SQL with advanced features*

#### Simple SQL Statement
```json
{
  "sql": "CREATE INDEX CONCURRENTLY idx_users_email ON users(email)", // required
  "expectRows": false,          // optional: whether to expect rows back
  "timeout": 60000,             // optional: timeout in ms
  "transactional": false,       // optional: wrap in transaction
  "connectionString": "postgresql://..." // optional if env var set
}
```

#### Complex Query with Parameters
```json
{
  "sql": "WITH recent_users AS (SELECT * FROM users WHERE created_at > $1) SELECT COUNT(*) FROM recent_users",
  "parameters": ["2024-01-01"], // optional: parameters for $1, $2, etc.
  "expectRows": true,
  "timeout": 30000
}
```

#### Transactional Operation
```json
{
  "sql": "UPDATE accounts SET balance = balance - 100 WHERE id = $1; UPDATE accounts SET balance = balance + 100 WHERE id = $2;",
  "parameters": [1, 2],
  "transactional": true,        // wraps in BEGIN/COMMIT
  "expectRows": false
}
```

#### Data Definition (DDL)
```json
{
  "sql": "ALTER TABLE users ADD COLUMN phone VARCHAR(20); CREATE INDEX idx_users_phone ON users(phone);",
  "expectRows": false,
  "transactional": true
}
```

---

### Comments Management
**Tool:** `pg_manage_comments`  
*Comprehensive comment management for all database objects*

#### Get Comment
```json
{
  "operation": "get",
  "objectType": "table",        // required: "table" | "column" | "index" | "constraint" | "function" | "trigger" | "view" | "sequence" | "schema" | "database"
  "objectName": "users",        // required: object name
  "schema": "public",           // required for most object types (defaults to "public")
  "columnName": "email",        // required when objectType is "column"
  "connectionString": "postgresql://..." // optional if env var set
}
```

#### Set Comment
```json
{
  "operation": "set",
  "objectType": "table",        // required
  "objectName": "users",        // required
  "comment": "Main user account information table", // required
  "schema": "public",           // optional, defaults to "public"
  "columnName": "created_at"    // required when objectType is "column"
}
```

#### Remove Comment
```json
{
  "operation": "remove",
  "objectType": "column",       // required
  "objectName": "users",        // required
  "columnName": "old_field",    // required for column type
  "schema": "public"            // optional
}
```

#### Bulk Get (Discovery Mode)
```json
{
  "operation": "bulk_get",
  "schema": "public",           // optional: schema to search
  "filterObjectType": "table",  // optional: filter by object type
  "includeSystemObjects": false // optional: include system objects (defaults to false)
}
```

#### Supported Object Types
- **`table`** - Table comments
- **`column`** - Column comments (requires `columnName`)
- **`index`** - Index comments
- **`constraint`** - Constraint comments
- **`function`** - Function comments
- **`trigger`** - Trigger comments
- **`view`** - View comments
- **`sequence`** - Sequence comments
- **`schema`** - Schema comments
- **`database`** - Database comments

#### Examples by Object Type
```json
// Table comment
{ "operation": "set", "objectType": "table", "objectName": "orders", "comment": "Customer order records" }

// Column comment
{ "operation": "set", "objectType": "column", "objectName": "orders", "columnName": "total_amount", "comment": "Order total in USD" }

// Index comment
{ "operation": "set", "objectType": "index", "objectName": "idx_orders_date", "comment": "Index for date-range queries" }

// Function comment
{ "operation": "set", "objectType": "function", "objectName": "calculate_tax", "comment": "Calculates tax based on location" }

// Discover all commented objects
{ "operation": "bulk_get", "schema": "public", "includeSystemObjects": false }
```

---

## Specialized Tools

### Database Analysis
**Tool:** `pg_analyze_database`

```json
{
  "analysisType": "performance",   // required: "configuration" | "performance" | "security"
  "connectionString": "postgresql://..." // optional if env var set
}
```

---

### Database Debugging
**Tool:** `pg_debug_database`

```json
{
  "issue": "performance",         // required: "connection" | "performance" | "locks" | "replication"
  "logLevel": "info",             // optional: "info" | "debug" | "trace"
  "connectionString": "postgresql://..." // optional if env var set
}
```

---

### Data Export/Import
**Tool:** `pg_export_table_data` | `pg_import_table_data`

#### Export
```json
{
  "tableName": "users",           // required
  "outputPath": "/path/to/file.json", // required: absolute path
  "format": "json",               // optional: "json" | "csv"
  "limit": 1000,                  // optional: row limit
  "where": "active = true",       // optional: WHERE clause
  "connectionString": "postgresql://..." // optional
}
```

#### Import
```json
{
  "tableName": "users",           // required
  "inputPath": "/path/to/file.json", // required: absolute path
  "format": "json",               // optional: "json" | "csv"
  "delimiter": ",",               // optional: for CSV
  "truncateFirst": false,         // optional: clear table first
  "connectionString": "postgresql://..." // optional
}
```

---

### Copy Between Databases
**Tool:** `pg_copy_between_databases`

```json
{
  "sourceConnectionString": "postgresql://source...", // required
  "targetConnectionString": "postgresql://target...", // required
  "tableName": "users",           // required
  "where": "created_at > '2024-01-01'", // optional: filter condition
  "truncateTarget": false         // optional: clear target table first
}
```

---

### Real-time Monitoring
**Tool:** `pg_monitor_database`

```json
{
  "connectionString": "postgresql://...", // optional if env var set
  "includeQueries": true,         // optional: include active queries
  "includeLocks": false,          // optional: include lock information
  "includeTables": true,          // optional: include table statistics
  "includeReplication": false,    // optional: include replication status
  "alertThresholds": {            // optional: alert configuration
    "connectionPercentage": 80,   // optional: 0-100
    "cacheHitRatio": 0.95,        // optional: 0-1
    "longRunningQuerySeconds": 300, // optional: seconds
    "deadTuplesPercentage": 10,   // optional: 0-100
    "vacuumAge": 7                // optional: days
  }
}
```

---

## Connection String Format

All tools support PostgreSQL connection strings in this format:

```
postgresql://[user[:password]@][host][:port][/dbname][?param1=value1&...]
```

**Examples:**
```bash
# Basic
postgresql://user:pass@localhost:5432/mydb

# With SSL
postgresql://user:pass@localhost:5432/mydb?sslmode=require

# With connection pooling
postgresql://user:pass@localhost:5432/mydb?application_name=mcp-server&connect_timeout=10
```

**Environment Variable:** `POSTGRES_CONNECTION_STRING`

---

## Common Parameter Patterns

### Optional vs Required
- ✅ **Required parameters** will cause an error if omitted
- 🔄 **Optional parameters** have sensible defaults or can be omitted

### Schema Names
- Most tools default to `"public"` schema if not specified
- Always specify schema for non-public schemas

### IF EXISTS / IF NOT EXISTS
- Use `ifExists: true` for safer DROP operations
- Use `ifNotExists: true` for safer CREATE operations

### Parameterized Queries (Enhancement Tools)
- Use `$1`, `$2`, etc. placeholders in SQL queries
- Provide corresponding values in the `parameters` array
- This prevents SQL injection attacks

### Pagination & Safety Limits
- Query tools support `limit` parameter for safety (default varies)
- Meta-tools that return lists often support pagination
- Data mutation tools validate input for safety

### Transactions (Execute SQL)
- Set `transactional: true` for operations requiring ACID properties
- Useful for multi-statement operations or critical data changes

---

## Error Handling

All tools return structured error information:

```json
{
  "error": "Descriptive error message",
  "code": "POSTGRES_ERROR_CODE",
  "details": { /* additional context */ }
}
```

**Common Error Codes:**
- `CONNECTION_ERROR` - Database connection issues
- `INVALID_PARAMETER` - Missing or invalid parameters  
- `PERMISSION_DENIED` - Insufficient database privileges
- `OBJECT_NOT_FOUND` - Referenced object doesn't exist
- `SYNTAX_ERROR` - Invalid SQL syntax
- `TIMEOUT_ERROR` - Query exceeded timeout limit (enhancement tools)
- `TRANSACTION_ERROR` - Transaction rollback or failure (execute SQL)
- `CONSTRAINT_VIOLATION` - Data violates constraints (mutations)

---

*Need more examples? Check the [examples/](./examples/) directory for complete working scenarios.* 