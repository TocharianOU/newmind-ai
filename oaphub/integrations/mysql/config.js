export default {
  name: 'MySQL',
  version: '1.0.0',
  downloadUrl: 'https://github.com/TocharianOU/mysql-mcp/releases/download/v1.0.0/mysql-mcp-v1.0.0.tar.gz',

  description: 'Schema inspection, read-only and write query execution, execution-plan analysis, process list and global status monitoring for MySQL databases',
  descriptionI18n: {
    en: 'Schema inspection, read-only and write query execution, execution-plan analysis, process list and global status monitoring for MySQL databases',
    et: 'MySQL-i integratsioon skeemi kontrolliks, päringute käivitamiseks, täitmisplaani analüüsiks, protsessiloendiks ja oleku jälgimiseks'
  },

  tags: ['Database'],

  transport: 'stdio',
  command: 'node',
  args: ['{{install_path}}/dist/index.js'],
  env: {
    MYSQL_HOST: 'localhost',
    MYSQL_PORT: '3306',
    MYSQL_USER: '',
    MYSQL_PASSWORD: '',
    MYSQL_DATABASE: '',
    MYSQL_SSL: 'false',
    MYSQL_MAX_ROWS: '1000',
    MYSQL_ALLOW_WRITE: 'false',
  },

  planRequired: 'BASE',
  logo: '/integrations/mysql/logo-48.svg',
  banner: '/integrations/mysql/logo-240.svg',

  document: `# MySQL MCP Server

MySQL database integration for schema inspection, query execution, and performance analysis.
Supports both read-only and write operations (write requires \`MYSQL_ALLOW_WRITE=true\`).

## Tools

### Schema Inspection
- **list_databases** – List all databases on the MySQL instance the user has access to, with character set and collation
- **list_tables** – List tables in a database with row count, engine, and collation. Optionally filter by database name
- **describe_table** – Full column definitions: name, data type, length/precision, nullability, default, key type, and extra attributes
- **show_indexes** – All indexes on a table: index name, columns, uniqueness, index type (BTREE/HASH/FULLTEXT), and visibility

### Query Execution
- **execute_query** – Execute a read-only SELECT or WITH statement. Automatically injects \`LIMIT\` if not present. Returns column names, rows, row count, and execution time
- **execute_write** – Execute INSERT / UPDATE / DELETE / REPLACE statements. Only available when \`MYSQL_ALLOW_WRITE=true\`. Returns rows affected and last insert ID
- **explain_query** – Run \`EXPLAIN FORMAT=JSON\` on a SELECT statement to show the optimizer's execution plan: access type, key used, rows examined, and cost estimate

### Statistics & Monitoring
- **get_table_stats** – Row count, data size, index size, and free space per table using \`information_schema.TABLES\`. Optionally filter by database or table
- **get_process_list** – Live process list from \`INFORMATION_SCHEMA.PROCESSLIST\`: connection ID, user, host, DB, command, state, execution time, and current query
- **get_global_status** – Key MySQL global status variables: uptime, connections, cache hit ratios, InnoDB buffer pool stats, query counts, and slow query rate

## Configuration

- **MYSQL_HOST**: MySQL server hostname or IP (e.g. \`db.corp.com\` or \`127.0.0.1\`)
- **MYSQL_PORT**: Port, default \`3306\`
- **MYSQL_USER** / **MYSQL_PASSWORD**: Credentials
- **MYSQL_DATABASE**: Default database to connect to (optional; tools accept a \`database\` param to switch)
- **MYSQL_SSL**: Set to \`true\` to enable TLS/SSL, or provide a JSON object with \`ca\`, \`cert\`, \`key\` paths
- **MYSQL_MAX_ROWS**: Maximum rows returned per query (default \`1000\`, max \`50000\`)
- **MYSQL_ALLOW_WRITE**: Set to \`true\` to enable \`execute_write\`. Defaults to \`false\` (read-only)

## Investigation Workflow

1. \`list_databases\` → discover available databases
2. \`list_tables database:"app_db"\` → find relevant tables with row counts
3. \`describe_table table:"orders" database:"app_db"\` → inspect column definitions
4. \`show_indexes table:"orders" database:"app_db"\` → review index coverage
5. \`execute_query sql:"SELECT status, COUNT(*) cnt FROM orders WHERE created_at > DATE_SUB(NOW(), INTERVAL 1 DAY) GROUP BY status ORDER BY cnt DESC"\` → run targeted analysis
6. \`explain_query sql:"SELECT * FROM orders WHERE customer_id = 123"\` → check execution plan for missing indexes
7. \`get_table_stats database:"app_db"\` → identify large or bloated tables`,

  documentI18n: {
  },

  configSchema: {
    type: 'object',
    required: ['MYSQL_HOST', 'MYSQL_USER'],
    properties: {
      MYSQL_HOST: {
        type: 'string',
        title: 'MySQL Host',
        description: 'Hostname or IP address of your MySQL server (e.g. db.corp.com or 127.0.0.1)',
      },
      MYSQL_PORT: {
        type: 'string',
        title: 'Port',
        description: 'MySQL server port',
        default: '3306',
      },
      MYSQL_USER: {
        type: 'string',
        title: 'Username',
        description: 'MySQL username',
      },
      MYSQL_PASSWORD: {
        type: 'string',
        title: 'Password',
        description: 'MySQL password',
        sensitive: true,
      },
      MYSQL_DATABASE: {
        type: 'string',
        title: 'Default Database',
        description: 'Default database to connect to (optional; can be overridden per tool call)',
      },
      MYSQL_SSL: {
        type: 'string',
        title: 'SSL/TLS',
        description: 'Enable SSL/TLS. Use "true" to enable with system CA, or "false" to disable.',
        enum: ['false', 'true'],
        default: 'false',
      },
      MYSQL_MAX_ROWS: {
        type: 'string',
        title: 'Max Rows',
        description: 'Maximum rows returned per query (default 1000, max 50000)',
        default: '1000',
      },
      MYSQL_ALLOW_WRITE: {
        type: 'string',
        title: 'Allow Write Operations',
        description: 'Enable INSERT/UPDATE/DELETE via execute_write tool. Defaults to false (read-only).',
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
