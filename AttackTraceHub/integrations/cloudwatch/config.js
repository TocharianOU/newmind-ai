export default {
  name: 'CloudWatch',
  version: '1.0.1',
  downloadUrl: 'https://github.com/TocharianOU/cloudwatch-mcp/releases/download/v1.0.1/cloudwatch-mcp-v1.0.1.tar.gz',

  description: 'AWS CloudWatch logs query, alarm status and metric statistics via MCP',
  descriptionI18n: {
    en: 'AWS CloudWatch MCP Server for Logs Insights queries, log stream events, alarm status, and metric statistics for security investigations',
    zh: 'AWS CloudWatch MCP 服务器，用于 Logs Insights 查询、日志流事件、告警状态和指标统计，支持安全调查'
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
  logo: '/integrations/cloudwatch/logo-48.svg',
  banner: '/integrations/cloudwatch/logo-240.svg',

  document: `# AWS CloudWatch MCP Server

Application log queries, alarm monitoring and metric analysis powered by AWS CloudWatch.

## Features
- Run CloudWatch Logs Insights queries across multiple log groups
- Retrieve raw log stream events with pagination
- List log groups and streams for discovery
- Check alarm states (OK / ALARM / INSUFFICIENT_DATA)
- Retrieve time-series metric statistics for any AWS service
- Token limiting to prevent context window overflow
- Supports temporary credentials (AssumeRole / AWS SSO)

## Configuration
Provide your AWS credentials to connect:
- **AWS Access Key ID** and **Secret Access Key**: Standard IAM credentials
- **AWS Region**: Target region (e.g. us-east-1)
- **Session Token**: Optional, for temporary/AssumeRole credentials

## Required IAM Permissions
- \`logs:StartQuery\`
- \`logs:GetQueryResults\`
- \`logs:GetLogEvents\`
- \`logs:DescribeLogGroups\`
- \`logs:DescribeLogStreams\`
- \`cloudwatch:DescribeAlarms\`
- \`cloudwatch:GetMetricStatistics\`

## Usage Examples
- Query VPC Flow Logs for rejected connections during an incident
- Analyze Lambda error rates with Logs Insights
- Check if CloudWatch alarms fired during a suspected attack window
- Correlate EC2 CPU spikes with security events`,

  documentI18n: {
    en: `# AWS CloudWatch MCP Server

Application log queries, alarm monitoring and metric analysis powered by AWS CloudWatch.

## Features
- Run CloudWatch Logs Insights queries across multiple log groups
- Retrieve raw log stream events with pagination
- List log groups and streams for discovery
- Check alarm states (OK / ALARM / INSUFFICIENT_DATA)
- Retrieve time-series metric statistics for any AWS service
- Token limiting to prevent context window overflow
- Supports temporary credentials (AssumeRole / AWS SSO)`,
    zh: `# AWS CloudWatch MCP 服务器

基于 AWS CloudWatch 的应用日志查询、告警监控和指标分析服务。

## 功能特性
- 跨多个日志组运行 CloudWatch Logs Insights 查询
- 分页获取原始日志流事件
- 列出日志组和日志流（发现辅助）
- 查看告警状态（OK / ALARM / INSUFFICIENT_DATA）
- 获取任意 AWS 服务的时序指标统计数据
- Token 限制，防止上下文窗口溢出
- 支持临时凭证（AssumeRole / AWS SSO）

## 配置说明
提供 AWS 凭证以连接：
- **AWS Access Key ID** 和 **Secret Access Key**：标准 IAM 凭证
- **AWS 区域**：目标区域（如 us-east-1）
- **Session Token**：可选，用于临时/AssumeRole 凭证`
  },

  configSchema: {
    type: 'object',
    required: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_DEFAULT_REGION'],
    properties: {
      AWS_ACCESS_KEY_ID: {
        type: 'string',
        title: 'AWS Access Key ID',
        description: 'Your AWS Access Key ID. Requires CloudWatch Logs and CloudWatch metrics permissions.',
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
        description: 'Default AWS region for CloudWatch queries (e.g. us-east-1, ap-southeast-1)',
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
