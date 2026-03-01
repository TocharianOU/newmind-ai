export default {
  name: 'AWS IAM',
  version: '1.0.1',
  downloadUrl: 'https://github.com/TocharianOU/aws-iam-mcp/releases/download/v1.0.1/aws-iam-mcp-v1.0.1.tar.gz',

  description: 'AWS IAM user/role inspection, policy analysis, access key audit and privilege simulation via MCP',
  descriptionI18n: {
    en: 'AWS IAM MCP Server for user/role inspection, policy analysis, access key audit, privilege simulation, and security investigations',
    zh: 'AWS IAM MCP 服务器，用于用户/角色检查、策略分析、访问密钥审计、权限模拟和安全调查'
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
  logo: '/integrations/aws-iam/logo-48.svg',
  banner: '/integrations/aws-iam/logo-240.svg',

  document: `# AWS IAM MCP Server

Identity and access management analysis for security investigations.

## Features
- Get IAM user details: attached policies, inline policies, group memberships, password last used
- List all IAM users with creation date and last login
- Audit access keys with automatic 90-day staleness flagging
- Retrieve full policy JSON documents (AWS managed and customer managed)
- Simulate whether a user/role can perform specific actions
- Inspect IAM roles and their trust policies (who can assume them)
- Token limiting to prevent context window overflow
- Supports temporary credentials (AssumeRole / AWS SSO)

## Configuration
Provide your AWS credentials to connect:
- **AWS Access Key ID** and **Secret Access Key**: Standard IAM credentials
- **AWS Region**: IAM is a global service; us-east-1 is recommended
- **Session Token**: Optional, for temporary/AssumeRole credentials

## Required IAM Permissions
- \`iam:GetUser\`, \`iam:ListUsers\`
- \`iam:ListAccessKeys\`
- \`iam:ListAttachedUserPolicies\`, \`iam:ListAttachedRolePolicies\`
- \`iam:ListUserPolicies\`, \`iam:GetUserPolicy\`
- \`iam:ListGroupsForUser\`
- \`iam:GetPolicy\`, \`iam:GetPolicyVersion\`
- \`iam:SimulatePrincipalPolicy\`
- \`iam:GetRole\`, \`iam:ListRoles\`

## Usage Examples
- Investigate a compromised IAM user: policies, keys, group memberships
- Simulate whether an attacker can call iam:CreateUser or sts:AssumeRole
- Audit Lambda execution roles for over-permissive policies
- Find access keys older than 90 days across all users`,

  documentI18n: {
    en: `# AWS IAM MCP Server

Identity and access management analysis for security investigations.

## Features
- Get IAM user details: attached policies, inline policies, group memberships, password last used
- List all IAM users with creation date and last login
- Audit access keys with automatic 90-day staleness flagging
- Retrieve full policy JSON documents (AWS managed and customer managed)
- Simulate whether a user/role can perform specific actions
- Inspect IAM roles and their trust policies (who can assume them)
- Token limiting to prevent context window overflow
- Supports temporary credentials (AssumeRole / AWS SSO)`,
    zh: `# AWS IAM MCP 服务器

面向安全调查的身份与访问管理分析服务。

## 功能特性
- 获取 IAM 用户详情：附加策略、内联策略、组成员关系、密码最后使用时间
- 列出所有 IAM 用户，含创建时间和最后登录时间
- 审计访问密钥，自动标记超过 90 天的老密钥
- 获取完整策略 JSON 文档（AWS 托管和客户托管策略）
- 模拟用户/角色是否有权执行特定操作
- 检查 IAM 角色及其信任策略（谁可以 AssumeRole）
- Token 限制，防止上下文窗口溢出
- 支持临时凭证（AssumeRole / AWS SSO）

## 配置说明
提供 AWS 凭证以连接：
- **AWS Access Key ID** 和 **Secret Access Key**：标准 IAM 凭证
- **AWS 区域**：IAM 是全局服务，推荐使用 us-east-1
- **Session Token**：可选，用于临时/AssumeRole 凭证`
  },

  configSchema: {
    type: 'object',
    required: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_DEFAULT_REGION'],
    properties: {
      AWS_ACCESS_KEY_ID: {
        type: 'string',
        title: 'AWS Access Key ID',
        description: 'Your AWS Access Key ID. Requires IAM read permissions (iam:GetUser, iam:ListUsers, etc.).',
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
        description: 'AWS region for endpoint routing. IAM is a global service; us-east-1 is the canonical default.',
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
