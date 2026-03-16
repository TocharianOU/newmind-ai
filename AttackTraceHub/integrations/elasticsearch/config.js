export default {
  name: 'Elasticsearch',
  version: '0.7.3',
  downloadUrl: 'https://github.com/TocharianOU/elasticsearch-mcp/releases/download/v0.7.3/elasticsearch-mcp-v0.7.3.tar.gz',
  
  description: 'Query DSL search with auto-highlights, index/shard/data-stream analysis, and full REST API access for SIEM log investigation – supports ES 5.x–9.x',
  descriptionI18n: {
    en: 'Query DSL search with auto-highlights, index/shard/data-stream analysis, and full REST API access for SIEM log investigation – supports ES 5.x–9.x',
    zh: 'Query DSL 搜索（自动高亮）、索引/Shard/Data Stream 分析、完整 REST API 直接执行，适用于 SIEM 日志调查，支持 ES 5.x–9.x'
  },
  
  tags: ['SIEM'],  // Primary category only
  
  transport: 'stdio',
  command: 'node',
  args: ['{{install_path}}/dist/index.js'],
  env: {
    ES_URL: '',
    ES_API_KEY: '',
    ES_USERNAME: '',
    ES_PASSWORD: '',
    MAX_TOKEN_CALL: '8000'
  },
  
  planRequired: 'BASE',
  logo: '/integrations/elasticsearch/logo-48.svg',
  banner: '/integrations/elasticsearch/logo-240.svg',
  
  document: `# Elasticsearch MCP Server

Full-featured Elasticsearch integration for SIEM log investigation and cluster management.
Supports ES 5.x through 9.x with automatic version detection and adapter selection.

## Tools

- **es_search** – Execute any Elasticsearch query using full Query DSL. Highlights are automatically enabled on all text fields so matches are visually marked in results. \`queryBody\` accepts a complete DSL object including \`query\`, \`size\`, \`from\`, \`sort\`, \`aggs\`, and \`_source\`
- **list_indices** – List all indices with health, doc count, and storage size. Smart compact mode auto-activates for large clusters (groups indices by pattern). Filter by pattern, control max display count (default 100, set to 0 for summary only)
- **get_mappings** – Retrieve field mappings for one or more indices with intelligent analysis. Filter by index pattern or specific field names. Shows field types, analyzers, and capability tags. Use before writing queries to understand available fields
- **get_shards** – Shard-level health analysis with optimization recommendations. Configurable thresholds: \`size_warning_threshold_gb\` (default 50 GB) and \`doc_count_warning_threshold_millions\` (default 200 M). Set \`show_recommendations: false\` to suppress advice
- **list_data_streams** – List data streams with lifecycle health, rollover status, backing index count, and size. Filter by name pattern, cap output with \`max_results\` (default 50). Essential for ECS/Fleet-managed log pipelines
- **execute_es_api** – Execute **any** Elasticsearch REST API endpoint directly. Accepts \`method\` (GET/POST/PUT/DELETE/HEAD), \`path\` (e.g. \`_cluster/health\`, \`my-index/_settings\`), \`body\`, \`params\`, and \`headers\`. Use for operations not covered by the other tools

## Configuration

- **ES_URL**: Cluster endpoint (e.g. \`https://localhost:9200\` or \`https://my-cluster.es.io:9243\`)
- **Authentication**: Use \`ES_API_KEY\` (recommended) **or** \`ES_USERNAME\` + \`ES_PASSWORD\` — not both
- **SSL/TLS Mode**: \`skip\` (ignore certificate, for self-signed certs), \`default\` (system CA), \`ca-cert\` (upload custom CA certificate file)
- **Max Token Limit**: Default is 8000 (lower than other integrations — ES responses can be large; narrow queries first)

## Investigation Workflow

1. \`list_indices pattern:"logs-*"\` → find relevant log indices and check their health/size
2. \`get_mappings indices:"logs-*"\` → understand the field schema before writing queries
3. \`es_search index:"logs-*" queryBody:{"query":{"bool":{"must":[{"range":{"@timestamp":{"gte":"now-1h"}}},{"match":{"event.outcome":"failure"}}]}},"size":20}\` → hunt for security events with highlighted matches
4. \`execute_es_api method:"GET" path:"_cat/indices?v=true&s=store.size:desc"\` → identify oversized indices consuming cluster resources`,

  documentI18n: {
    zh: `# Elasticsearch MCP 服务器

功能完整的 Elasticsearch 集成，用于 SIEM 日志调查和集群管理。支持 ES 5.x–9.x，自动检测版本并选择适配器。

## 工具

- **es_search** – 执行完整 Query DSL 搜索。自动在所有文本字段上启用高亮，让匹配内容在结果中可视化标注。\`queryBody\` 接受完整的 DSL 对象，包括 \`query\`、\`size\`、\`from\`、\`sort\`、\`aggs\` 和 \`_source\`
- **list_indices** – 列出所有索引的健康状态、文档数和存储大小。大集群自动启用 compact 模式（按规律分组）。支持按 pattern 过滤，\`max_results\` 控制详细展示数量（默认 100，设为 0 仅显示摘要）
- **get_mappings** – 获取一个或多个索引的字段映射分析。可按索引 pattern 或字段名过滤，展示字段类型、分析器和能力标签。建议在编写查询前先调用，了解可用字段
- **get_shards** – Shard 级别健康分析，含优化建议。可配置阈值：\`size_warning_threshold_gb\`（默认 50 GB）和 \`doc_count_warning_threshold_millions\`（默认 2 亿条）。\`show_recommendations: false\` 可关闭建议输出
- **list_data_streams** – 列出 Data Stream 的生命周期健康状态、rollover 状态、backing index 数量和大小。支持按名称 pattern 过滤，\`max_results\` 限制输出数量（默认 50）。ECS/Fleet 管理的日志管道必备
- **execute_es_api** – **直接执行任意** Elasticsearch REST API。接受 \`method\`（GET/POST/PUT/DELETE/HEAD）、\`path\`（如 \`_cluster/health\`、\`my-index/_settings\`）、\`body\`、\`params\` 和 \`headers\`。用于其他工具未覆盖的操作

## 配置说明

- **ES_URL**：集群端点（如 \`https://localhost:9200\` 或 \`https://my-cluster.es.io:9243\`）
- **认证方式**：使用 \`ES_API_KEY\`（推荐）**或** \`ES_USERNAME\` + \`ES_PASSWORD\`，不要同时填写
- **SSL/TLS 模式**：\`skip\`（忽略证书，适用于自签名）、\`default\`（系统 CA）、\`ca-cert\`（上传自定义 CA 证书文件）
- **Max Token Limit**：默认 8000（低于其他集成——ES 响应体可能很大，建议先收窄查询范围）

## 调查工作流

1. \`list_indices pattern:"logs-*"\` → 找到相关日志索引，检查健康状态和大小
2. \`get_mappings indices:"logs-*"\` → 编写查询前了解字段结构
3. \`es_search\` → 使用 Query DSL 进行威胁狩猎，高亮标注匹配内容
4. \`execute_es_api method:"GET" path:"_cat/indices?v=true&s=store.size:desc"\` → 识别占用大量集群资源的索引`
  },
  
  configSchema: {
    type: 'object',
    required: ['ES_URL', 'tlsMode'],
    properties: {
      ES_URL: {
        type: 'string',
        title: 'Elasticsearch URL',
        description: 'Elasticsearch server endpoint (e.g., https://localhost:9200)',
        format: 'uri'
      },
      ES_API_KEY: {
        type: 'string',
        title: 'API Key',
        description: 'Elasticsearch API key for authentication',
        sensitive: true
      },
      ES_USERNAME: {
        type: 'string',
        title: 'Username',
        description: 'Username for basic authentication'
      },
      ES_PASSWORD: {
        type: 'string',
        title: 'Password',
        description: 'Password for basic authentication',
        sensitive: true
      },
      MAX_TOKEN_CALL: {
        type: 'string',
        title: 'Max Token Call',
        description: 'Maximum token call limit',
        default: '8000'
      },
      tlsMode: {
        type: 'string',
        title: 'SSL/TLS Verification',
        description: 'Choose how to verify SSL/TLS certificates',
        enum: ['skip', 'default', 'ca-cert'],
        default: 'skip'
      },
      ES_CA_CERT: {
        type: 'string',
        title: 'CA Certificate',
        description: 'Upload custom CA certificate file',
        format: 'file'
      }
    },
    oneOf: [
      {
        required: ['ES_URL', 'ES_API_KEY'],
        title: 'API Key Authentication'
      },
      {
        required: ['ES_URL', 'ES_USERNAME', 'ES_PASSWORD'],
        title: 'Basic Authentication'
      }
    ],
    dependencies: {
      tlsMode: {
        oneOf: [
          {
            properties: {
              tlsMode: { enum: ['ca-cert'] }
            },
            required: ['ES_CA_CERT']
          },
          {
            properties: {
              tlsMode: { enum: ['skip', 'default'] }
            }
          }
        ]
      }
    }
  },
  
  toolTier: 'X',
  unitPriceUsd: 0,
  popular: true,
  new: false,
  isActive: true
}
