export default {
  name: 'AWS IAM',
  version: '1.0.1',
  downloadUrl: 'https://github.com/TocharianOU/aws-iam-mcp/releases/download/v1.0.1/aws-iam-mcp-v1.0.1.tar.gz',

  description: 'IAM user/role enumeration, 90-day access key audit, policy document retrieval, and simulate_policy privilege testing for identity forensics',
  descriptionI18n: {
    zh: 'IAM 用户/角色枚举、90 天访问密钥审计、策略文档检索，以及 simulate_policy 权限模拟，专为身份安全取证设计'
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

IAM identity and access analysis for security investigations: user/role enumeration, access key auditing, policy review, and privilege simulation.

## Tools

### User & Access Key Audit
- **get_user** – Get full user profile: all attached managed policies, inline policy names, group memberships, MFA status, and password last-used timestamp. Pass \`userName\` or omit to check the current caller identity
- **list_users** – Enumerate all IAM users with creation date, last-login time, and MFA status. Use to find dormant or recently-created accounts
- **list_access_keys** – List access keys for a user with status (Active/Inactive), creation date, and **automatic 90-day staleness flag** (🔴 stale). Key forensic tool for compromised-credential investigations
- **get_user_inline_policy** – Retrieve the full JSON of an inline policy attached directly to a user (not a managed policy). Inline policies are often used for custom or overly-permissive grants

### Policy Analysis
- **list_attached_policies** – List managed policies attached to a user or role with policy ARN and version. Use before calling \`get_policy_document\` to identify what to investigate
- **get_policy_document** – Retrieve the full JSON of any IAM policy (AWS managed or customer managed) by ARN. Shows all Allow/Deny statements, actions, and conditions

### Privilege Simulation & Roles
- **simulate_policy** – Simulate whether a principal (user or role ARN) is allowed to perform specific IAM actions (e.g. \`iam:CreateUser\`, \`sts:AssumeRole\`, \`s3:PutObject\`). Reveals actual effective permissions including group policies and SCPs
- **get_role** – Get role configuration: trust policy (who/what can assume it), max session duration, attached policies, and tags. Critical for understanding cross-account access and service roles
- **list_roles** – Enumerate all IAM roles with trust principal type (Service, AWS, Federated). Use to find over-permissive service roles or roles assumable from external accounts

## Required IAM Permissions

\`iam:GetUser\`, \`iam:ListUsers\`, \`iam:ListAccessKeys\`, \`iam:ListUserPolicies\`, \`iam:GetUserPolicy\`, \`iam:ListGroupsForUser\`, \`iam:ListAttachedUserPolicies\`, \`iam:ListAttachedRolePolicies\`, \`iam:GetPolicy\`, \`iam:GetPolicyVersion\`, \`iam:SimulatePrincipalPolicy\`, \`iam:GetRole\`, \`iam:ListRoles\`

## Investigation Workflow

1. \`list_users\` → find recently-created or dormant accounts
2. \`get_user username=<suspect>\` → review all policies, groups, MFA status
3. \`list_access_keys username=<suspect>\` → identify stale (🔴 90+ day) or recently-created keys
4. \`list_attached_policies username=<suspect>\` → identify managed policies to review
5. \`get_policy_document policy_arn=<arn>\` → inspect full policy JSON for risky wildcards
6. \`simulate_policy principal_arn=<arn> action_names=["iam:CreateUser","sts:AssumeRole","ec2:*"]\` → confirm whether attacker can escalate`,

  documentI18n: {
    zh: `# AWS IAM MCP 服务器

面向安全调查的 IAM 身份与访问分析：用户/角色枚举、访问密钥审计、策略审查和权限模拟。

## 工具

### 用户与访问密钥审计
- **get_user** – 获取完整用户档案：所有附加的托管策略、内联策略名称、组成员关系、MFA 状态和密码最后使用时间戳。传入 \`userName\` 或省略以检查当前调用者身份
- **list_users** – 枚举所有 IAM 用户，含创建时间、最后登录时间和 MFA 状态。用于发现休眠或新建账户
- **list_access_keys** – 列出用户的访问密钥：状态（Active/Inactive）、创建时间，以及**自动 90 天老化标记**（🔴 过期）。凭据泄露调查的核心工具
- **get_user_inline_policy** – 获取直接附加到用户的内联策略完整 JSON。内联策略常用于自定义或过度授权

### 策略分析
- **list_attached_policies** – 列出用户或角色的托管策略（含策略 ARN 和版本）。调用 \`get_policy_document\` 前用于确定调查对象
- **get_policy_document** – 按 ARN 检索任意 IAM 策略的完整 JSON（AWS 托管或客户托管）。显示所有 Allow/Deny 语句、操作和条件

### 权限模拟与角色
- **simulate_policy** – 模拟主体（用户或角色 ARN）是否允许执行特定 IAM 操作（如 \`iam:CreateUser\`、\`sts:AssumeRole\`）。揭示包含组策略和 SCP 的实际有效权限
- **get_role** – 获取角色配置：信任策略（谁可以 AssumeRole）、最大会话时长、附加策略和标签
- **list_roles** – 枚举所有 IAM 角色及信任主体类型（Service/AWS/Federated）。发现过度授权的服务角色或可从外部账户假设的角色

## 调查工作流

1. \`list_users\` → 发现最近创建或休眠的账户
2. \`get_user username=<嫌疑人>\` → 审查所有策略、组、MFA 状态
3. \`list_access_keys username=<嫌疑人>\` → 识别过期（🔴 90 天以上）或新建密钥
4. \`list_attached_policies username=<嫌疑人>\` → 确定需要审查的托管策略
5. \`get_policy_document policy_arn=<arn>\` → 检查完整策略 JSON 中的危险通配符
6. \`simulate_policy principal_arn=<arn> action_names=["iam:CreateUser","sts:AssumeRole","ec2:*"]\` → 确认攻击者是否可以提权`
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
