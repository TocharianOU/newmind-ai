export default {
  name: 'AWS Security',
  version: '1.0.1',
  downloadUrl: 'https://github.com/TocharianOU/aws-security-mcp/releases/download/v1.0.1/aws-security-mcp-v1.0.1.tar.gz',

  description: 'AWS security service status checks, threat findings from GuardDuty/SecurityHub/Inspector, and S3/EBS encryption audits',
  descriptionI18n: {
    en: 'AWS Security MCP Server for SOC/DFIR – check whether GuardDuty, Security Hub, Inspector, and IAM Access Analyzer are enabled; retrieve active threat findings with severity filtering; audit S3 bucket and EBS volume encryption compliance',
    zh: 'AWS Security MCP 服务器，面向 SOC/DFIR 场景，支持检查 GuardDuty/SecurityHub/Inspector/AccessAnalyzer 启用状态、按严重程度过滤获取活跃威胁告警，以及审计 S3 存储桶与 EBS 卷的加密合规情况'
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
  logo: '/integrations/aws-security/logo-48.svg',
  banner: '/integrations/aws-security/logo-240.svg',

  document: `# AWS Security MCP Server

SOC/DFIR-focused security posture checks and threat finding retrieval powered by AWS security services.

## Tools

- **check_security_services** – Verify if GuardDuty, Security Hub, Inspector, and IAM Access Analyzer are enabled in a region; surfaces critical gaps in security coverage
- **get_security_findings** – Retrieve active findings from any supported security service (guardduty | securityhub | inspector | accessanalyzer) with optional severity filtering (CRITICAL/HIGH/MEDIUM/LOW)
- **check_storage_encryption** – Audit S3 buckets and EBS volumes for encryption configuration; highlights unencrypted resources and public S3 buckets

## Configuration

Provide your AWS credentials:
- **AWS Access Key ID** and **Secret Access Key**: Standard IAM credentials
- **AWS Region**: Target region (e.g. us-east-1)
- **Session Token**: Optional, for temporary/AssumeRole credentials

## Required IAM Permissions

### check_security_services
- \`guardduty:ListDetectors\`, \`guardduty:GetDetector\`
- \`securityhub:DescribeHub\`
- \`inspector2:BatchGetAccountStatus\`
- \`access-analyzer:ListAnalyzers\`

### get_security_findings
- \`guardduty:ListFindings\`, \`guardduty:GetFindings\`
- \`securityhub:GetFindings\`
- \`inspector2:ListFindings\`
- \`access-analyzer:ListFindings\`

### check_storage_encryption
- \`s3:ListAllMyBuckets\`, \`s3:GetEncryptionConfiguration\`, \`s3:GetBucketLocation\`, \`s3:GetBucketPolicyStatus\`
- \`ec2:DescribeVolumes\`

## Usage Examples
- **Security posture check**: Run \`check_security_services\` first to see which detection services are active
- **Incident triage**: Use \`get_security_findings service=guardduty severity_filter=HIGH\` to pull high-priority alerts
- **Compliance audit**: Use \`check_storage_encryption include_unencrypted_only=true\` to quickly find unencrypted buckets/volumes
- **Cross-account access review**: Use \`get_security_findings service=accessanalyzer\` to find resources exposed outside the account`,

  documentI18n: {
    zh: `# AWS Security MCP 服务器

面向 SOC/DFIR 的安全态势检查与威胁告警检索，基于 AWS 原生安全服务。

## 工具

- **check_security_services** – 检查 GuardDuty、Security Hub、Inspector、IAM Access Analyzer 在指定区域是否已启用，发现安全防护盲区
- **get_security_findings** – 从任意受支持的安全服务获取活跃告警（guardduty | securityhub | inspector | accessanalyzer），支持按严重程度过滤
- **check_storage_encryption** – 审计 S3 存储桶与 EBS 卷的加密配置，标记未加密资源和公开可访问的 S3 存储桶

## 配置

提供您的 AWS 凭据：
- **AWS Access Key ID** 和 **Secret Access Key**：标准 IAM 凭据
- **AWS Region**：目标区域（如 us-east-1）
- **Session Token**：可选，用于临时/AssumeRole 凭据

## 所需 IAM 权限

详见英文文档。

## 使用示例
- **安全态势检查**：先运行 \`check_security_services\`，了解哪些检测服务已激活
- **事件响应分类**：使用 \`get_security_findings service=guardduty severity_filter=HIGH\` 获取高危告警
- **合规审计**：使用 \`check_storage_encryption include_unencrypted_only=true\` 快速找出未加密的存储桶/卷
- **跨账号访问审查**：使用 \`get_security_findings service=accessanalyzer\` 发现账号外部可访问的资源`
  },

  configSchema: {
    type: 'object',
    required: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_DEFAULT_REGION'],
    properties: {
      AWS_ACCESS_KEY_ID: {
        type: 'string',
        title: 'AWS Access Key ID',
        description: 'Your AWS Access Key ID. Requires security service read permissions.',
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
        description: 'Default AWS region for security queries (e.g. us-east-1, ap-southeast-1)',
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
        description: 'Maximum number of tokens allowed per tool call result. Prevents context window overflow.',
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
