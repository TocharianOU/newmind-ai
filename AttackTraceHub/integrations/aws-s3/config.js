export default {
  name: 'AWS S3',
  version: '1.0.1',
  downloadUrl: 'https://github.com/TocharianOU/aws-s3-mcp/releases/download/v1.0.1/aws-s3-mcp-v1.0.1.tar.gz',

  description: 'S3 public exposure, policy/ACL risk audit, and automatic sensitive-file detection for data-exfiltration investigations',
  descriptionI18n: {
    zh: 'S3 公开暴露审计、策略与 ACL 风险分析，以及凭据/数据库备份/Terraform 状态文件的自动检测，面向数据泄露事件响应'
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
  logo: '/integrations/aws-s3/logo-48.svg',
  banner: '/integrations/aws-s3/logo-240.svg',

  document: `# AWS S3 MCP Server

S3 bucket security audits and data exfiltration investigation powered by AWS S3 API.

## Tools

- **list_buckets** – Full bucket inventory. With \`include_details: true\`: checks public access block settings, encryption algorithm, versioning status, and access logging per bucket. Use \`public_only: true\` to focus on exposed buckets only
- **get_bucket_policy** – Retrieves and analyzes bucket policy statements. Flags: wildcard principal (\`"Principal": "*"\`), Allow+GetObject on public principal (🔴 CRITICAL), cross-account grants, conditions (mitigating). Also shows Public Access Block status
- **get_bucket_acl** – Analyzes ACL grants. Flags: AllUsers grants (anyone on internet), AuthenticatedUsers grants (all 200M+ AWS accounts), non-owner canonical user grants
- **list_objects** – Lists bucket contents and auto-detects sensitive files by name patterns:
  - 🔴 HIGH: \`.pem\`, \`.key\`, \`.env\`, SSH private keys, AWS credentials, \`.sql\`/\`.dump\` backups, Terraform \`.tfstate\`/\`.tfvars\`, kubeconfig
  - 🟡 MEDIUM: \`.csv\`/\`.xlsx\` exports, app config files, audit logs, Docker configs

## Configuration

- **AWS Access Key ID** and **Secret Access Key**: Standard IAM credentials
- **AWS Region**: Default region for API calls (S3 bucket list is global)
- **Session Token**: Optional, for temporary/AssumeRole credentials

## Required IAM Permissions

\`\`\`
s3:ListAllMyBuckets
s3:GetBucketLocation
s3:GetBucketEncryption
s3:GetBucketVersioning
s3:GetBucketLogging
s3:GetBucketPublicAccessBlock
s3:GetBucketPolicyStatus
s3:GetBucketPolicy
s3:GetBucketAcl
s3:ListBucket
\`\`\`

## Investigation Workflow
1. \`list_buckets include_details:true public_only:true\` → identify publicly exposed buckets
2. \`get_bucket_policy bucket:"exposed-bucket"\` → understand HOW it's exposed (policy vs ACL)
3. \`get_bucket_acl bucket:"exposed-bucket"\` → check if ACL grants public access
4. \`list_objects bucket:"exposed-bucket"\` → see what data is accessible and flag sensitive files`,

  documentI18n: {
    zh: `# AWS S3 MCP 服务器

S3 存储桶安全审计与数据泄露调查，基于 AWS S3 API。

## 工具

- **list_buckets** – 完整存储桶清单。\`include_details: true\`：检查每个桶的公开访问块设置、加密算法、版本控制状态和访问日志。\`public_only: true\` 仅显示已暴露的桶
- **get_bucket_policy** – 获取并分析桶策略语句。标记：通配符主体（\`"Principal": "*"\`）、公开主体上的 Allow+GetObject（🔴 严重）、跨账号授权、条件（缓解因素）
- **get_bucket_acl** – 分析 ACL 授权。标记：AllUsers 授权（互联网任何人）、AuthenticatedUsers 授权（所有 2 亿+ AWS 账号用户）
- **list_objects** – 列出桶内容并按文件名模式自动检测敏感文件：凭据/密钥/DB 备份/Terraform 状态/SSH 密钥/PII 数据等

## 调查工作流
1. \`list_buckets include_details:true public_only:true\` → 识别公开暴露的存储桶
2. \`get_bucket_policy\` → 了解暴露方式（策略 vs ACL）
3. \`get_bucket_acl\` → 检查 ACL 是否授予公开访问
4. \`list_objects\` → 查看可访问的数据并标记敏感文件`
  },

  configSchema: {
    type: 'object',
    required: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_DEFAULT_REGION'],
    properties: {
      AWS_ACCESS_KEY_ID: {
        type: 'string',
        title: 'AWS Access Key ID',
        description: 'Your AWS Access Key ID. Requires S3 read permissions.',
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
        description: 'Default AWS region (e.g. us-east-1). S3 bucket list is global.',
        default: 'us-east-1'
      },
      AWS_SESSION_TOKEN: {
        type: 'string',
        title: 'AWS Session Token (Optional)',
        description: 'Temporary session token for AssumeRole or AWS SSO credentials.',
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
        description: 'Maximum tokens per tool call result. Prevents context window overflow.',
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
};
