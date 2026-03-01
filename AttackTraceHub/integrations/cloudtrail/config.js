export default {
  name: 'CloudTrail',
  version: '1.0.1',
  downloadUrl: 'https://github.com/TocharianOU/cloudtrail-mcp/releases/download/v1.0.1/cloudtrail-mcp-v1.0.1.tar.gz',

  description: 'AWS CloudTrail audit log lookup and security investigation via MCP',
  descriptionI18n: {
    en: 'AWS CloudTrail MCP Server for audit log lookup, CloudTrail Lake SQL analytics, event data store management, and security investigations',
    zh: 'AWS CloudTrail MCP 服务器，用于审计日志查询、CloudTrail Lake SQL 分析、事件数据存储管理和安全调查'
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

Audit log lookup and security investigation powered by AWS CloudTrail.

## Features
- Lookup CloudTrail events by time range, resource, user, or event type
- CloudTrail Lake SQL analytics for advanced threat hunting
- Query status tracking and result retrieval
- List and manage event data stores
- Supports temporary credentials (AssumeRole / AWS SSO)

## Configuration
Provide your AWS credentials to connect:
- **AWS Access Key ID** and **Secret Access Key**: Standard IAM credentials
- **AWS Region**: Target region for CloudTrail queries (e.g. us-east-1)
- **Session Token**: Optional, for temporary/AssumeRole credentials

## Required IAM Permissions
- \`cloudtrail:LookupEvents\`
- \`cloudtrail:StartQuery\`
- \`cloudtrail:GetQueryResults\`
- \`cloudtrail:ListEventDataStores\`

## Usage Examples
- Investigate suspicious API calls from a specific IAM user
- Hunt for privilege escalation events across accounts
- Correlate CloudTrail events with security alerts`,

  documentI18n: {
    en: `# AWS CloudTrail MCP Server

Audit log lookup and security investigation powered by AWS CloudTrail.

## Features
- Lookup CloudTrail events by time range, resource, user, or event type
- CloudTrail Lake SQL analytics for advanced threat hunting
- Query status tracking and result retrieval
- List and manage event data stores
- Supports temporary credentials (AssumeRole / AWS SSO)`,
    zh: `# AWS CloudTrail MCP 服务器

基于 AWS CloudTrail 的审计日志查询和安全调查服务。

## 功能特性
- 按时间范围、资源、用户或事件类型查询 CloudTrail 事件
- CloudTrail Lake SQL 分析，用于高级威胁狩猎
- 查询状态跟踪和结果获取
- 列出并管理事件数据存储
- 支持临时凭证（AssumeRole / AWS SSO）

## 配置说明
提供 AWS 凭证以连接：
- **AWS Access Key ID** 和 **Secret Access Key**：标准 IAM 凭证
- **AWS 区域**：CloudTrail 查询的目标区域（如 us-east-1）
- **Session Token**：可选，用于临时/AssumeRole 凭证`
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

  tokenCost: 0.03,
  tokenRequired: 0.03,
  tokenPriceUnit: 'request',
  popular: false,
  new: true,
  isActive: true
}
