export default {
  name: 'AWS Security',
  version: '1.0.1',
  downloadUrl: 'https://github.com/TocharianOU/aws-security-mcp/releases/download/v1.0.1/aws-security-mcp-v1.0.1.tar.gz',

  description: 'GuardDuty/SecurityHub/Inspector/AccessAnalyzer status checks, severity-filtered findings, and S3/EBS encryption audits for AWS security posture',
  descriptionI18n: {
    zh: 'GuardDuty/SecurityHub/Inspector/AccessAnalyzer 启用状态检查、按严重程度过滤的威胁告警获取，以及 S3/EBS 加密合规审计，全面评估 AWS 安全态势'
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

## Investigation Workflow

1. \`check_security_services\` → identify which security services are active in the region (find coverage gaps)
2. \`get_security_findings service=guardduty severity_filter=CRITICAL\` → triage the most urgent threats first
3. \`get_security_findings service=securityhub\` → cross-check with centralized Security Hub aggregated findings
4. \`get_security_findings service=accessanalyzer\` → find resources with external or cross-account exposure
5. \`check_storage_encryption include_unencrypted_only=true\` → audit for unencrypted S3 buckets and EBS volumes`,

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

**check_security_services**: \`guardduty:ListDetectors\`, \`guardduty:GetDetector\`, \`securityhub:DescribeHub\`, \`inspector2:BatchGetAccountStatus\`, \`access-analyzer:ListAnalyzers\`

**get_security_findings**: \`guardduty:ListFindings\`, \`guardduty:GetFindings\`, \`securityhub:GetFindings\`, \`inspector2:ListFindings\`, \`access-analyzer:ListFindings\`

**check_storage_encryption**: \`s3:ListAllMyBuckets\`, \`s3:GetEncryptionConfiguration\`, \`s3:GetBucketLocation\`, \`s3:GetBucketPolicyStatus\`, \`ec2:DescribeVolumes\`

## 调查工作流

1. \`check_security_services\` → 确认哪些安全服务在当前区域已启用，发现覆盖盲区
2. \`get_security_findings service=guardduty severity_filter=CRITICAL\` → 优先处理最紧急的威胁
3. \`get_security_findings service=securityhub\` → 与 Security Hub 聚合告警交叉核查
4. \`get_security_findings service=accessanalyzer\` → 发现对外部或跨账号暴露的资源
5. \`check_storage_encryption include_unencrypted_only=true\` → 审计未加密的 S3 存储桶和 EBS 卷`
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

  toolTier: 'X',
  unitPriceUsd: 0,
  popular: false,
  new: true,
  isActive: true
};
