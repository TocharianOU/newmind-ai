export default {
  name: 'AWS Network',
  version: '1.0.1',
  downloadUrl: 'https://github.com/TocharianOU/aws-network-mcp/releases/download/v1.0.1/aws-network-mcp-v1.0.1.tar.gz',

  description: 'VPC topology inspection, security group exposure analysis, VPC Flow Log queries, and IP-to-ENI lookup for AWS network forensics',
  descriptionI18n: {
    zh: 'VPC 拓扑检查、安全组暴露面分析、VPC Flow Log 查询，以及 IP 到 ENI 的关联定位，专为 AWS 网络取证设计'
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
  logo: '/integrations/aws-network/logo-48.svg',
  banner: '/integrations/aws-network/logo-240.svg',

  document: `# AWS Network MCP Server

VPC inspection, security group analysis, flow log forensics, and IP address lookup powered by AWS EC2 and CloudWatch Logs.

## Tools
- **list_vpcs** – List all VPCs with CIDR, state, and tags
- **get_vpc_network_details** – Full VPC topology: subnets, route tables, IGW, NAT, NACLs, VPC endpoints
- **get_vpc_flow_logs** – Query VPC Flow Logs (ACCEPT/REJECT filter, IP/port filters, time range)
- **find_ip_address** – Locate an ENI by private or public IP address (single region or all regions)
- **get_eni_details** – Complete security group rules, NACLs, and routing for a network interface

## Configuration
Provide your AWS credentials to connect:
- **AWS Access Key ID** and **Secret Access Key**: Standard IAM credentials
- **AWS Region**: Target region (e.g. us-east-1)
- **Session Token**: Optional, for temporary/AssumeRole credentials

## Required IAM Permissions
- \`ec2:DescribeVpcs\`
- \`ec2:DescribeSubnets\`
- \`ec2:DescribeRouteTables\`
- \`ec2:DescribeSecurityGroups\`
- \`ec2:DescribeNetworkInterfaces\`
- \`ec2:DescribeNetworkAcls\`
- \`ec2:DescribeInternetGateways\`
- \`ec2:DescribeNatGateways\`
- \`ec2:DescribeVpcEndpoints\`
- \`ec2:DescribeFlowLogs\`
- \`ec2:DescribeRegions\`
- \`logs:StartQuery\`
- \`logs:GetQueryResults\`

## Investigation Workflow

1. \`find_ip_address ip=<suspicious_ip>\` → instantly identify which ENI/EC2 owns a suspicious IP seen in CloudTrail or alerts
2. \`get_eni_details eni_id=<eni>\` → review all security group rules and NACLs applied to that interface
3. \`get_vpc_flow_logs vpc_id=<vpc> filter=REJECT source_ip=<attacker_ip>\` → confirm blocked traffic or find permit gaps
4. \`get_vpc_network_details vpc_id=<vpc>\` → map full topology: IGW presence, NAT routes, NACL rules, VPC endpoints
5. \`list_vpcs\` → audit all VPCs for unexpected public subnets or missing flow log configurations`,

  documentI18n: {
    zh: `# AWS 网络 MCP 服务器

基于 AWS EC2 和 CloudWatch Logs 的 VPC 检查、安全组分析、流日志取证和 IP 地址定位。

## 工具

- **list_vpcs** – 列出所有 VPC，含 CIDR、状态、默认 VPC 标记和标签。用于发现意外的公网子网或缺少流日志配置的 VPC
- **get_vpc_network_details** – 完整 VPC 拓扑：子网（公有/私有）、路由表（含 IGW/NAT 路由）、互联网网关、NAT 网关、网络 ACL 及规则、VPC 端点。全面了解网络暴露面
- **get_vpc_flow_logs** – 查询 VPC Flow Log：支持 ACCEPT/REJECT 过滤、源/目标 IP 过滤、端口过滤和时间范围。用于确认攻击流量和侦察行为
- **find_ip_address** – 按私有或公有 IP 定位 ENI，支持单区域或全区域搜索。从 CloudTrail 告警的可疑 IP 快速定位到具体 EC2 实例
- **get_eni_details** – 网络接口的完整安全视图：所有关联安全组（含入/出站规则）、生效 NACL 规则和路由表。用于确认流量是否真正被允许

## 所需 IAM 权限

\`ec2:DescribeVpcs\`, \`ec2:DescribeSubnets\`, \`ec2:DescribeRouteTables\`, \`ec2:DescribeSecurityGroups\`, \`ec2:DescribeNetworkInterfaces\`, \`ec2:DescribeNetworkAcls\`, \`ec2:DescribeInternetGateways\`, \`ec2:DescribeNatGateways\`, \`ec2:DescribeVpcEndpoints\`, \`ec2:DescribeFlowLogs\`, \`ec2:DescribeRegions\`, \`logs:StartQuery\`, \`logs:GetQueryResults\`

## 调查工作流

1. \`find_ip_address ip=<可疑 IP>\` → 从 CloudTrail 或告警中的可疑 IP 立即定位所属 ENI/EC2
2. \`get_eni_details eni_id=<eni>\` → 审查应用于该网络接口的所有安全组规则和 NACL
3. \`get_vpc_flow_logs vpc_id=<vpc> filter=REJECT source_ip=<攻击者 IP>\` → 确认拦截流量或发现放通漏洞
4. \`get_vpc_network_details vpc_id=<vpc>\` → 完整拓扑映射：IGW 是否存在、NAT 路由、NACL 规则、VPC 端点
5. \`list_vpcs\` → 审计所有 VPC，发现意外的公网子网或缺少流日志配置`
  },

  configSchema: {
    type: 'object',
    required: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_DEFAULT_REGION'],
    properties: {
      AWS_ACCESS_KEY_ID: {
        type: 'string',
        title: 'AWS Access Key ID',
        description: 'Your AWS Access Key ID. Requires EC2 read and CloudWatch Logs permissions.',
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
        description: 'Default AWS region for network queries (e.g. us-east-1, ap-southeast-1)',
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
