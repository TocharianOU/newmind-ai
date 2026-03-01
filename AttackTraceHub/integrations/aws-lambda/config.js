export default {
  name: 'AWS Lambda',
  version: '1.0.1',
  downloadUrl: 'https://github.com/TocharianOU/lambda-tool-mcp/releases/download/v1.0.1/lambda-tool-mcp-v1.0.1.tar.gz',

  description: 'AWS Lambda function discovery, configuration inspection, resource policy analysis and exposure check via MCP',
  descriptionI18n: {
    en: 'AWS Lambda MCP Server for function discovery, configuration inspection (env var keys, VPC, layers), resource policy analysis, event source mapping enumeration, and Function URL public exposure checks – designed for serverless security investigations',
    zh: 'AWS Lambda MCP 服务器，支持函数发现、配置检查（环境变量键名、VPC、层）、资源策略分析、事件源映射枚举及 Function URL 公开暴露检查，专为无服务器安全调查设计'
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

## Usage Examples
- Discover all Lambda functions modified in the past 24 hours after a suspected breach
- Check if a suspicious function has a public resource policy or Function URL (AuthType=NONE)
- Identify functions with DynamoDB stream triggers (potential data exfiltration path)
- Audit environment variable key names for hardcoded credential patterns`,

  documentI18n: {
    en: `# AWS Lambda Tool MCP Server

Lambda function discovery, configuration inspection, and security exposure analysis powered by AWS Lambda API.

## Tools
- **list_functions** – List functions with runtime, VPC config, state, and last-modified date
- **get_function_details** – Full config with env var key audit (values redacted), VPC, layers, IAM role
- **get_function_policy** – Resource policy with public-principal detection
- **list_event_source_mappings** – Persistence & exfiltration path enumeration
- **get_function_url_config** – Public Function URL exposure check`,
    zh: `# AWS Lambda Tool MCP 服务器

基于 AWS Lambda API 的函数发现、配置检查和安全暴露分析服务。

## 工具列表
- **list_functions** – 列出函数（含运行时、VPC 配置、状态、最后修改时间），支持前缀过滤
- **get_function_details** – 完整配置：环境变量键名审计（值已屏蔽）、VPC、IAM 角色、层
- **get_function_policy** – 资源策略，检测公开主体和跨账户授权
- **list_event_source_mappings** – 持久化和数据泄露路径枚举（SQS、DynamoDB Streams、Kinesis）
- **get_function_url_config** – 公开 Function URL 暴露检查（AuthType=NONE 告警）

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
