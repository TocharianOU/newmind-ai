export default {
  name: 'CloudTrail',
  version: '1.0.1',
  downloadUrl: 'https://github.com/TocharianOU/cloudtrail-mcp/releases/download/v1.0.1/cloudtrail-mcp-v1.0.1.tar.gz',

  description: 'CloudTrail event lookup by username/AccessKeyId/EventName and Lake SQL analytics for AWS API audit trail investigations',
  descriptionI18n: {
    zh: '按用户名/AccessKeyId/事件名过滤的 CloudTrail 事件查询，以及 CloudTrail Lake SQL 分析，专为 AWS API 审计跟踪调查设计'
  },

  tags: ['AWS'],

  transport: 'stdio',
  command: 'node',
  args: ['{{install_path}}/dist/index.js'],
  env: {
    AWS_ACCESS_KEY_ID: '',
    AWS_SECRET_ACCESS_KEY: '',
    AWS_DEFAULT_REGION: 'us-east-1',
    AWS_SESSION_TOKEN: '',
  },

  planRequired: 'BASE',
  logo: '/integrations/cloudtrail/logo-48.svg',
  banner: '/integrations/cloudtrail/logo-240.svg',

  document: `# AWS CloudTrail MCP Server

AWS API audit trail lookup and advanced threat hunting via CloudTrail management events and CloudTrail Lake SQL analytics.

## Tools

### Management Event Lookup
- **lookup_events** – Look up CloudTrail management events from the **last 90 days**. Filter by: \`attributeKey\` (Username, EventName, AccessKeyId, ResourceName, ResourceType, EventSource, ReadOnly, EventId) + \`attributeValue\`. Params: \`startTime\`/\`endTime\` (ISO or relative e.g. \`"2 hours ago"\`), \`maxResults\` (1–50), pagination via \`nextToken\`. Ideal for per-user or per-action forensics

### CloudTrail Lake SQL Analytics
- **lake_query** – Run SQL queries against a CloudTrail Lake event data store for deeper analytics. Supports aggregations, JOINs, and full-history queries beyond 90 days. Provide the event data store ARN and a SQL string; returns a \`queryId\` for async retrieval
- **get_query_status** – Poll the status of an async Lake query (QUEUED / RUNNING / FINISHED / FAILED). Call this after \`lake_query\` before fetching results
- **get_query_results** – Retrieve the results of a completed Lake query by \`queryId\`. Supports pagination for large result sets

## Required IAM Permissions

\`cloudtrail:LookupEvents\`, \`cloudtrail:StartQuery\`, \`cloudtrail:GetQueryResults\`, \`cloudtrail:DescribeQuery\`, \`cloudtrail:ListEventDataStores\`

## Investigation Workflow

1. \`lookup_events attributeKey=Username attributeValue=<suspect> startTime="2 days ago" maxResults=50\` → trace all API calls by a suspected user
2. \`lookup_events attributeKey=EventName attributeValue=ConsoleLogin startTime="1 hour ago"\` → find recent console logins
3. \`lookup_events attributeKey=EventName attributeValue=CreateUser\` → hunt for unauthorized IAM user creation (privilege escalation)
4. \`lookup_events attributeKey=AccessKeyId attributeValue=<leaked_key>\` → track all usage of a compromised access key
5. For deeper analytics: \`lake_query\` → \`get_query_status\` → \`get_query_results\` pipeline with SQL like:
   \`SELECT eventTime, userIdentity.arn, eventName, sourceIPAddress FROM <eds_arn> WHERE eventName IN ('CreateUser','AttachUserPolicy','AssumeRole') ORDER BY eventTime DESC LIMIT 50\``,

  documentI18n: {
    zh: `# AWS CloudTrail MCP 服务器

通过 CloudTrail 管理事件和 CloudTrail Lake SQL 分析，进行 AWS API 审计跟踪查询和高级威胁狩猎。

## 工具

### 管理事件查询
- **lookup_events** – 查询 **90 天内**的 CloudTrail 管理事件。过滤维度：\`attributeKey\`（Username/EventName/AccessKeyId/ResourceName/ResourceType/EventSource/ReadOnly/EventId）+ \`attributeValue\`。支持 ISO 或相对时间（如 \`"2 hours ago"\`）、\`maxResults\`（1–50）和分页（\`nextToken\`）

### CloudTrail Lake SQL 分析
- **lake_query** – 对 CloudTrail Lake 事件数据存储运行 SQL 查询，支持聚合、JOIN 和超出 90 天的历史查询。返回 \`queryId\` 用于异步获取结果
- **get_query_status** – 轮询异步 Lake 查询状态（QUEUED / RUNNING / FINISHED / FAILED）。在 \`lake_query\` 之后、获取结果之前调用
- **get_query_results** – 通过 \`queryId\` 获取已完成 Lake 查询的结果，支持大结果集分页

## 所需 IAM 权限

\`cloudtrail:LookupEvents\`, \`cloudtrail:StartQuery\`, \`cloudtrail:GetQueryResults\`, \`cloudtrail:DescribeQuery\`, \`cloudtrail:ListEventDataStores\`

## 调查工作流

1. \`lookup_events attributeKey=Username attributeValue=<嫌疑人> startTime="2 days ago" maxResults=50\` → 追踪嫌疑用户的所有 API 调用
2. \`lookup_events attributeKey=EventName attributeValue=ConsoleLogin startTime="1 hour ago"\` → 发现近期控制台登录
3. \`lookup_events attributeKey=EventName attributeValue=CreateUser\` → 狩猎未授权 IAM 用户创建（提权）
4. \`lookup_events attributeKey=AccessKeyId attributeValue=<泄露密钥>\` → 追踪泄露访问密钥的所有使用记录
5. 深度分析：\`lake_query\` → \`get_query_status\` → \`get_query_results\` 流程，使用 SQL 进行聚合分析`
  },

  configSchema: {
    type: 'object',
    required: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_DEFAULT_REGION'],
    properties: {
      AWS_ACCESS_KEY_ID: {
        type: 'string',
        title: 'AWS Access Key ID',
        description: 'Your AWS Access Key ID. Requires cloudtrail:LookupEvents and related permissions.',
        sensitive: true
      },
      AWS_SECRET_ACCESS_KEY: {
        type: 'string',
        title: 'AWS Secret Access Key',
        description: 'Your AWS Secret Access Key.',
        sensitive: true
      },
      AWS_DEFAULT_REGION: {
        type: 'string',
        title: 'AWS Region',
        description: 'Default AWS region for CloudTrail queries (e.g. us-east-1, ap-southeast-1)',
        default: 'us-east-1'
      },
      AWS_SESSION_TOKEN: {
        type: 'string',
        title: 'AWS Session Token (Optional)',
        description: 'Temporary session token for AssumeRole or AWS SSO credentials. Leave empty for long-term IAM credentials.',
        sensitive: true
      },
      AWS_TIMEOUT: {
        type: 'number',
        title: 'Request Timeout (ms)',
        description: 'AWS API request timeout in milliseconds',
        default: 30000,
        minimum: 5000,
        maximum: 120000
      },
      MAX_TOKEN_CALL: {
        type: 'number',
        title: 'Max Token Limit',
        description: 'Maximum number of tokens allowed per tool call result. Prevents context window overflow. Set to 0 to disable.',
        default: 20000,
        minimum: 0,
        maximum: 200000
      }
    }
  },

  toolTier: 'X',
  unitPriceUsd: 0,
  popular: false,
  new: true,
  isActive: true
}
