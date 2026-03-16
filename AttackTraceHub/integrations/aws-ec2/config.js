export default {
  name: 'AWS EC2',
  version: '1.0.1',
  downloadUrl: 'https://github.com/TocharianOU/aws-ec2-mcp/releases/download/v1.0.1/aws-ec2-mcp-v1.0.1.tar.gz',

  description: 'AWS EC2 instance inventory, security group exposure analysis, and console output forensics for incident response',
  descriptionI18n: {
    zh: 'AWS EC2 MCP 服务器，面向 DFIR 场景，支持实例清单（含 IP/安全组/IAM/User-Data 取证）、安全组规则暴露面分析（检测 SSH/RDP/DB 对公网开放），以及控制台输出自动扫描（认证失败、反弹 Shell、挖矿程序等）'
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
  logo: '/integrations/aws-ec2/logo-48.svg',
  banner: '/integrations/aws-ec2/logo-240.svg',

  document: `# AWS EC2 MCP Server

EC2 instance inventory, security group exposure analysis, and console output forensics for incident response and security investigations.

## Tools

- **describe_instances** – Full instance detail: state, private/public IPs, VPC/subnet, security groups, IAM instance profile, AMI, tags, EBS volumes. Optional \`include_user_data: true\` decodes and auto-flags suspicious commands (curl/wget, reverse shells, base64 decode, chmod +x)
- **describe_security_groups** – Analyze inbound rules for dangerous internet exposure. Risk-scores every group (🔴HIGH/🟡MEDIUM/🔵LOW), flags dangerous ports (SSH:22, RDP:3389, MySQL:3306, Redis:6379, etc.) open to 0.0.0.0/0 or ::/0
- **get_instance_console_output** – Retrieve boot/kernel/system logs. Auto-scans for: auth failures, invalid user logins, user creation, file downloads (curl/wget), reverse shell indicators (/dev/tcp, netcat), base64 decode, cryptominers (xmrig, minerd), kernel panic, OOM kills

## Configuration

- **AWS Access Key ID** and **Secret Access Key**: Standard IAM credentials
- **AWS Region**: Target region (e.g. us-east-1)
- **Session Token**: Optional, for temporary/AssumeRole credentials

## Required IAM Permissions

\`\`\`
ec2:DescribeInstances
ec2:DescribeInstanceAttribute   (for user-data)
ec2:DescribeSecurityGroups
ec2:GetConsoleOutput
\`\`\`

## Usage Examples
- **Identify compromised instances**: \`describe_instances filters=[{name:"instance-state-name",values:["running"]}] include_user_data:true\`
- **Find internet-exposed dangerous ports**: \`describe_security_groups vpc_id:"vpc-xxx" include_non_compliant_only:true\`
- **Forensic boot log analysis**: \`get_instance_console_output instance_id:"i-0abc123"\` – auto-flags suspicious patterns
- **Target specific hosts**: \`describe_instances instance_ids:["i-0abc123","i-0def456"]\``,

  documentI18n: {
    zh: `# AWS EC2 MCP 服务器

EC2 实例清单、安全组暴露面分析与控制台输出取证，面向事件响应与安全调查。

## 工具

- **describe_instances** – 完整实例详情：状态、私有/公有 IP、VPC/子网、安全组、IAM 实例配置文件、AMI、标签、EBS 卷。可选 \`include_user_data: true\` 解码并自动标记可疑命令（curl/wget、反弹 Shell、base64 解码、chmod +x 等）
- **describe_security_groups** – 分析入站规则中的互联网暴露面，对每个安全组进行风险评分（🔴高/🟡中/🔵低），标记对 0.0.0.0/0 或 ::/0 开放的危险端口（SSH:22、RDP:3389、MySQL:3306、Redis:6379 等）
- **get_instance_console_output** – 获取启动/内核/系统日志，自动扫描：认证失败、无效用户登录、用户创建、文件下载（curl/wget）、反弹 Shell 指示（/dev/tcp、netcat）、base64 解码、挖矿程序（xmrig、minerd）、内核崩溃、OOM 终止

## 所需 IAM 权限

\`ec2:DescribeInstances\`, \`ec2:DescribeInstanceAttribute\`, \`ec2:DescribeSecurityGroups\`, \`ec2:GetConsoleOutput\``
  },

  configSchema: {
    type: 'object',
    required: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_DEFAULT_REGION'],
    properties: {
      AWS_ACCESS_KEY_ID: {
        type: 'string',
        title: 'AWS Access Key ID',
        description: 'Your AWS Access Key ID. Requires EC2 read permissions.',
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
        description: 'Default AWS region for EC2 queries (e.g. us-east-1, ap-southeast-1)',
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

  toolTier: 'X',
  unitPriceUsd: 0,
  popular: false,
  new: true,
  isActive: true
};
