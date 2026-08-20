export default {
  name: 'SQL Server',
  version: '1.0.0',
  downloadUrl: 'https://github.com/TocharianOU/sqlserver-mcp/releases/download/v1.0.0/sqlserver-mcp-v1.0.0.tar.gz',

  description: 'Schema inspection, execution-plan analysis, foreign key mapping, table statistics, and read-only or write query execution for Microsoft SQL Server',
  descriptionI18n: {
    en: 'Schema inspection, execution-plan analysis, foreign key mapping, table statistics, and read-only or write query execution for Microsoft SQL Server',
    et: 'Microsoft SQL Serveri integratsioon skeemi kontrolliks, täitmisplaani analüüsiks, välisvõtmete kaardistamiseks, tabelistatistikaks ja päringute käivitamiseks'
  },

  tags: ['Database'],

  transport: 'stdio',
  command: 'node',
  args: ['{{install_path}}/dist/index.js'],
  env: {
    SQLSERVER_HOST: 'localhost',
    SQLSERVER_PORT: '1433',
    SQLSERVER_USER: '',
    SQLSERVER_PASSWORD: '',
    SQLSERVER_DATABASE: '',
    SQLSERVER_ENCRYPT: 'true',
    SQLSERVER_TRUST_CERT: 'false',
    SQLSERVER_MAX_ROWS: '1000',
    SQLSERVER_ALLOW_WRITE: 'false',
  },

  planRequired: 'BASE',
  logo: '/integrations/sqlserver/logo-48.svg',
  banner: '/integrations/sqlserver/logo-240.svg',

  document: `# SQL Server MCP Server

Microsoft SQL Server integration for schema inspection, T-SQL query execution, execution-plan analysis, and instance monitoring.
Supports both read-only and write operations (write requires \`SQLSERVER_ALLOW_WRITE=true\`).

## Tools

### Schema Inspection
- **list_databases** – List all ONLINE databases on the instance from \`sys.databases\`. Optionally include system databases (master, model, msdb, tempdb)
- **list_tables** – List base tables in a database using \`INFORMATION_SCHEMA.TABLES\`. Supports cross-database queries and schema filtering
- **list_views** – List views in a database with updatability flag. Optionally include full \`VIEW_DEFINITION\` SQL text
- **describe_table** – Full column definitions: name, data type, length/precision/scale, nullability, default value, and ordinal position
- **show_indexes** – All indexes on a table from \`sys.indexes\`: index name, columns, type (CLUSTERED/NONCLUSTERED), uniqueness, primary key flag, disabled status, and key ordinal
- **get_foreign_keys** – Foreign key relationships for a specific table or all user tables: constraint name, parent/referenced table and column, delete/update rules

### Query Execution
- **execute_query** – Execute a read-only T-SQL SELECT or WITH (CTE) statement. Automatically injects \`TOP N\` if not present. Returns column names, rows, row count, and execution time
- **execute_write** – Execute INSERT / UPDATE / DELETE / MERGE / TRUNCATE statements. Only available when \`SQLSERVER_ALLOW_WRITE=true\`. Returns rows affected per statement
- **explain_query** – Show the estimated execution plan using \`SET SHOWPLAN_ALL ON\`. Returns the operator tree with estimated rows, I/O cost, and CPU cost — useful for query optimisation

### Statistics & Monitoring
- **get_table_stats** – Row count, total size, data size, and index size (in KB) per user table using \`sys.allocation_units\`. Correctly accounts for IN_ROW, ROW_OVERFLOW, and LOB allocation units. Optionally filter by table or schema
- **get_server_info** – Instance metadata: server name, product version, edition, engine edition, collation, and clustering status
- **test_connection** – Verify connectivity and validate permissions: checks \`sys.objects\`, \`INFORMATION_SCHEMA.TABLES\`, and \`sys.databases\` access

## Configuration

- **SQLSERVER_HOST**: SQL Server hostname or IP (e.g. \`sqlserver.corp.com\` or \`192.168.1.10\`)
- **SQLSERVER_PORT**: Port, default \`1433\`
- **SQLSERVER_USER** / **SQLSERVER_PASSWORD**: SQL Server authentication credentials
- **SQLSERVER_DATABASE**: Default database (optional; tools accept a \`database\` param to switch)
- **SQLSERVER_ENCRYPT**: \`true\` (default) to encrypt the connection. Set to \`false\` for older SQL Server versions that don't support encryption
- **SQLSERVER_TRUST_CERT**: \`true\` to trust self-signed certificates (useful for local/dev instances). Defaults to \`false\`
- **SQLSERVER_MAX_ROWS**: Maximum rows returned per query (default \`1000\`, max \`50000\`)
- **SQLSERVER_ALLOW_WRITE**: Set to \`true\` to enable \`execute_write\`. Defaults to \`false\` (read-only)

## Investigation Workflow

1. \`test_connection\` → verify connectivity and check permission levels
2. \`get_server_info\` → confirm version, edition, and collation
3. \`list_databases\` → discover available databases on the instance
4. \`list_tables database:"SalesDB"\` → find relevant tables
5. \`describe_table table:"Orders" schema:"dbo" database:"SalesDB"\` → inspect column definitions
6. \`show_indexes table:"Orders" schema:"dbo"\` → review index coverage
7. \`get_foreign_keys table:"Orders"\` → understand referential integrity
8. \`execute_query sql:"SELECT TOP 100 * FROM dbo.Orders WHERE Status = 'OPEN' ORDER BY CreatedAt DESC"\` → targeted data query
9. \`explain_query sql:"SELECT * FROM dbo.Orders WHERE CustomerId = 42"\` → check execution plan for missing indexes
10. \`get_table_stats schema:"dbo"\` → identify large or fragmented tables`,

  documentI18n: {
  },

  configSchema: {
    type: 'object',
    required: ['SQLSERVER_HOST', 'SQLSERVER_USER'],
    properties: {
      SQLSERVER_HOST: {
        type: 'string',
        title: 'SQL Server Host',
        description: 'Hostname or IP address of your SQL Server instance (e.g. sqlserver.corp.com or 192.168.1.10)',
      },
      SQLSERVER_PORT: {
        type: 'string',
        title: 'Port',
        description: 'SQL Server port',
        default: '1433',
      },
      SQLSERVER_USER: {
        type: 'string',
        title: 'Username',
        description: 'SQL Server authentication username',
      },
      SQLSERVER_PASSWORD: {
        type: 'string',
        title: 'Password',
        description: 'SQL Server authentication password',
        sensitive: true,
      },
      SQLSERVER_DATABASE: {
        type: 'string',
        title: 'Default Database',
        description: 'Default database to connect to (optional; can be overridden per tool call)',
      },
      SQLSERVER_ENCRYPT: {
        type: 'string',
        title: 'Encrypt Connection',
        description: 'Encrypt the connection. Use "false" for older SQL Server versions that do not support encryption.',
        enum: ['true', 'false'],
        default: 'true',
      },
      SQLSERVER_TRUST_CERT: {
        type: 'string',
        title: 'Trust Server Certificate',
        description: 'Trust self-signed certificates. Set to "true" for local/dev instances.',
        enum: ['false', 'true'],
        default: 'false',
      },
      SQLSERVER_MAX_ROWS: {
        type: 'string',
        title: 'Max Rows',
        description: 'Maximum rows returned per query (default 1000, max 50000)',
        default: '1000',
      },
      SQLSERVER_ALLOW_WRITE: {
        type: 'string',
        title: 'Allow Write Operations',
        description: 'Enable INSERT/UPDATE/DELETE/MERGE via execute_write tool. Defaults to false (read-only).',
        enum: ['false', 'true'],
        default: 'false',
      },
    },
  },

  toolTier: 'X',
  unitPriceUsd: 0,
  popular: false,
  new: true,
  isActive: true,
};
