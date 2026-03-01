export default {
  name: 'AWS Lambda',
  version: '1.0.1',
  downloadUrl: 'https://github.com/TocharianOU/lambda-tool-mcp/releases/download/v1.0.1/lambda-tool-mcp-v1.0.1.tar.gz',

  description: 'Lambda function enumeration, env var key audit, resource policy public-exposure analysis, and Function URL auth check for serverless security investigations',
  descriptionI18n: {
    zh: 'Lambda 函数枚举、环境变量键名审计、资源策略公开暴露分析，以及 Function URL 认证检查，专为无服务器安全调查设计'
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
  logo: '/integrations/aws-lambda/logo-48.svg',
  banner: '/integrations/aws-lambda/logo-240.svg',

  document: `# AWS Lambda Tool MCP Server

Lambda function discovery, configuration inspection, and security exposure analysis powered by AWS Lambda API.

## Tools
- **list_functions** – List functions with runtime, VPC config, state, and last-modified date; prefix filtering supported
- **get_function_details** – Full config: environment variable KEYS (values redacted), VPC, IAM role, layers, tags; flags sensitive key names
- **get_function_policy** – Resource-based policy showing who can invoke the function; highlights public principals and cross-account grants
- **list_event_source_mappings** – SQS, DynamoDB Streams, Kinesis triggers; flags DynamoDB streams as data exfiltration paths
- **get_function_url_config** – Public Function URL check: AuthType (NONE = publicly accessible!), CORS wildcard origins

## Configuration
Provide your AWS credentials to connect:
- **AWS Access Key ID** and **Secret Access Key**: Standard IAM credentials
- **AWS Region**: Target region (e.g. us-east-1)
- **Session Token**: Optional, for temporary/AssumeRole credentials

## Required IAM Permissions
- \`lambda:ListFunctions\`
- \`lambda:GetFunction\`
- \`lambda:GetPolicy\`
- \`lambda:ListEventSourceMappings\`
- \`lambda:GetFunctionUrlConfig\`
- \`lambda:ListTags\`
- \`lambda:GetFunctionConcurrency\`

## Investigation Workflow

1. \`list_functions\` → enumerate all Lambda functions; check \`last_modified\` for recently changed functions after a suspected breach
2. \`get_function_details function_name=<name>\` → inspect env var key names for hardcoded secrets (values are always redacted), IAM role, and VPC placement
3. \`get_function_policy function_name=<name>\` → check if any principal is \`"*"\` (public invoke) or from an unexpected account
4. \`get_function_url_config function_name=<name>\` → if \`AuthType=NONE\`, the function is **publicly callable without AWS credentials**
5. \`list_event_source_mappings function_name=<name>\` → identify DynamoDB stream triggers that could serve as data exfiltration paths`,

  documentI18n: {
    zh: `# AWS Lambda Tool MCP 服务器

基于 AWS Lambda API 的函数发现、配置检查和安全暴露分析服务。

## 工具

- **list_functions** – 列出函数（含运行时、VPC 配置、状态、最后修改时间），支持前缀过滤。用于发现可疑的近期修改函数
- **get_function_details** – 完整配置：环境变量键名审计（**值始终屏蔽**，防止凭据泄露）、VPC、IAM 执行角色、层列表。标记可疑键名（如 \`SECRET\`、\`PASSWORD\`、\`KEY\`）
- **get_function_policy** – 资源策略分析：高亮公开主体（\`"Principal": "*"\`）和跨账户授权。\`"*"\` 表示任何人都可调用该函数
- **list_event_source_mappings** – 枚举 SQS/DynamoDB Streams/Kinesis 触发器。DynamoDB 流触发器可能是数据泄露路径
- **get_function_url_config** – 公开 Function URL 检查：\`AuthType=NONE\` 表示**无需 AWS 凭证即可公开调用**（🔴 高危），同时检查 CORS 通配符配置

## 所需 IAM 权限

\`lambda:ListFunctions\`, \`lambda:GetFunction\`, \`lambda:GetPolicy\`, \`lambda:ListEventSourceMappings\`, \`lambda:GetFunctionUrlConfig\`, \`lambda:ListTags\`

## 调查工作流

1. \`list_functions\` → 枚举所有函数；检查 \`last_modified\` 发现可疑期间内的最近修改
2. \`get_function_details function_name=<函数名>\` → 检查环境变量键名是否含硬编码凭据、IAM 角色和 VPC 配置
3. \`get_function_policy function_name=<函数名>\` → 检查是否有 \`"*"\` 主体（公开调用）或来自意外账户的授权
4. \`get_function_url_config function_name=<函数名>\` → \`AuthType=NONE\` 表示函数可无凭证公开调用（高危）
5. \`list_event_source_mappings function_name=<函数名>\` → 识别可能作为数据泄露路径的 DynamoDB 流触发器`
  },

  configSchema: {
    type: 'object',
    required: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_DEFAULT_REGION'],
    properties: {
      AWS_ACCESS_KEY_ID: {
        type: 'string',
        title: 'AWS Access Key ID',
        description: 'Your AWS Access Key ID. Requires Lambda read permissions.',
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
        description: 'Default AWS region for Lambda queries (e.g. us-east-1, ap-southeast-1)',
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
