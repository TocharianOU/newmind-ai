export default {
  name: 'CloudWatch',
  version: '1.0.1',
  downloadUrl: 'https://github.com/TocharianOU/cloudwatch-mcp/releases/download/v1.0.1/cloudwatch-mcp-v1.0.1.tar.gz',

  description: 'Logs Insights queries across 20 log groups, raw log stream retrieval, alarm state monitoring, and metric time-series for AWS CloudWatch investigations',
  descriptionI18n: {
    zh: '跨最多 20 个日志组的 Logs Insights 查询、原始日志流获取、告警状态监控，以及指标时序分析，专为 AWS CloudWatch 安全调查设计'
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

CloudWatch Logs Insights queries, raw log stream retrieval, alarm monitoring, and metric time-series analysis for security investigations.

## Tools

### Log Discovery & Retrieval
- **list_log_groups** – Enumerate all CloudWatch log groups with size and retention policy. Use to discover relevant log groups before querying (e.g. \`/aws/lambda/\`, \`/aws/eks/\`, \`/vpc/flowlogs/\`)
- **list_log_streams** – List log streams within a log group, sorted by last event time. Use to pinpoint which stream to fetch raw events from
- **get_log_events** – Retrieve raw log events from a specific log group + stream. Supports time range and pagination. Best for tailing application logs or fetching Lambda execution output

### Log Analytics (Insights)
- **query_logs** – Run a CloudWatch Logs Insights query across **up to 20 log groups simultaneously**. Supports full query syntax: \`fields\`, \`filter\`, \`stats\`, \`sort\`, \`limit\`. Time range via ISO or relative strings (e.g. \`"1 hour ago"\`). \`limit\` max 1000, recommend 20–50 for security investigations. Returns structured results

### Alarms & Metrics
- **describe_alarms** – Get current alarm states (OK / ALARM / INSUFFICIENT_DATA) with threshold, metric, and last state change. Use to check if any alarms fired during a suspected attack window
- **get_metric_statistics** – Retrieve time-series statistics (Average, Sum, Maximum, SampleCount) for **any AWS metric** — EC2 CPU, Lambda errors, RDS connections, ALB 5xx rates, etc. Params: \`namespace\` (e.g. \`AWS/Lambda\`), \`metric_name\`, \`dimensions\`, \`period\` (seconds), time range

## Required IAM Permissions

\`logs:StartQuery\`, \`logs:GetQueryResults\`, \`logs:GetLogEvents\`, \`logs:DescribeLogGroups\`, \`logs:DescribeLogStreams\`, \`cloudwatch:DescribeAlarms\`, \`cloudwatch:GetMetricStatistics\`

## Investigation Workflow

1. \`list_log_groups\` → discover all available log groups; identify VPC Flow Logs, Lambda, EKS, WAF groups
2. \`query_logs logGroupNames=["/aws/lambda/suspect-fn"] queryString="fields @timestamp, @message | filter @message like /ERROR/ | sort @timestamp desc | limit 50" startTime="2 hours ago"\` → search Lambda logs for errors or anomalous patterns
3. \`query_logs logGroupNames=["/vpc/flowlogs/prod"] queryString="fields @timestamp, srcAddr, dstAddr, action | filter action='REJECT' and srcAddr='<attacker_ip>' | sort @timestamp desc | limit 50"\` → confirm blocked traffic from attacker IP
4. \`describe_alarms\` → check if any alarms were in ALARM state during the incident window
5. \`get_metric_statistics namespace=AWS/EC2 metric_name=CPUUtilization dimensions=[{name:"InstanceId",value:"i-0abc123"}] period=300\` → correlate CPU spikes with security events`,

  documentI18n: {
    zh: `# AWS CloudWatch MCP 服务器

CloudWatch Logs Insights 查询、原始日志流获取、告警监控和指标时序分析，面向安全调查。

## 工具

### 日志发现与获取
- **list_log_groups** – 枚举所有 CloudWatch 日志组，含大小和保留策略。查询前用于发现相关日志组（如 \`/aws/lambda/\`、\`/vpc/flowlogs/\`）
- **list_log_streams** – 按最后事件时间列出日志组内的日志流。用于定位需要获取原始事件的具体流
- **get_log_events** – 从指定日志组+流获取原始日志事件，支持时间范围和分页。适合追踪应用日志或 Lambda 执行输出

### 日志分析（Insights）
- **query_logs** – 在**最多 20 个日志组**上同时运行 Logs Insights 查询，支持完整查询语法：\`fields\`、\`filter\`、\`stats\`、\`sort\`、\`limit\`（最大 1000，安全调查推荐 20–50）。时间范围支持 ISO 或相对字符串（如 \`"1 hour ago"\`）

### 告警与指标
- **describe_alarms** – 获取当前告警状态（OK / ALARM / INSUFFICIENT_DATA），含阈值、指标和最后状态变更时间。检查可疑攻击窗口期间是否有告警触发
- **get_metric_statistics** – 获取**任意 AWS 指标**的时序统计数据（Average/Sum/Maximum/SampleCount）——EC2 CPU、Lambda 错误、RDS 连接数、ALB 5xx 速率等

## 所需 IAM 权限

\`logs:StartQuery\`, \`logs:GetQueryResults\`, \`logs:GetLogEvents\`, \`logs:DescribeLogGroups\`, \`logs:DescribeLogStreams\`, \`cloudwatch:DescribeAlarms\`, \`cloudwatch:GetMetricStatistics\`

## 调查工作流

1. \`list_log_groups\` → 发现所有可用日志组；识别 VPC Flow Logs、Lambda、EKS、WAF 日志组
2. \`query_logs logGroupNames=["/aws/lambda/suspect-fn"] queryString="fields @timestamp, @message | filter @message like /ERROR/ | sort @timestamp desc | limit 50" startTime="2 hours ago"\` → 搜索 Lambda 日志中的错误或异常模式
3. \`query_logs logGroupNames=["/vpc/flowlogs/prod"] queryString="fields @timestamp, srcAddr, dstAddr, action | filter action='REJECT' and srcAddr='<攻击者 IP>' | sort @timestamp desc | limit 50"\` → 确认来自攻击者 IP 的被拦截流量
4. \`describe_alarms\` → 检查事件窗口期间是否有告警处于 ALARM 状态
5. \`get_metric_statistics namespace=AWS/EC2 metric_name=CPUUtilization dimensions=[{name:"InstanceId",value:"i-0abc123"}] period=300\` → 将 CPU 峰值与安全事件相关联`
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
