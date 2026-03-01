export default {
  name: 'AWS Network',
  version: '1.0.1',
  downloadUrl: 'https://github.com/TocharianOU/aws-network-mcp/releases/download/v1.0.1/aws-network-mcp-v1.0.1.tar.gz',

  description: 'AWS VPC inspection, security group analysis, ENI details, flow log queries and IP lookup via MCP',
  descriptionI18n: {
    en: 'AWS Network MCP Server for VPC inspection, security group rule analysis, ENI details, VPC Flow Log queries, and IP address lookup – designed for network security investigations',
    zh: 'AWS 网络 MCP 服务器，支持 VPC 检查、安全组规则分析、ENI 详情、VPC Flow Log 查询及 IP 地址定位，专为网络安全调查设计'
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

## Usage Examples
- Identify which EC2 instance owns a suspicious IP from CloudTrail events
- Analyze security group rules blocking or allowing malicious traffic
- Query VPC Flow Logs for REJECT entries from a specific source IP
- Verify internet gateway and NACL exposure of a compromised subnet`,

  documentI18n: {
    en: `# AWS Network MCP Server

VPC inspection, security group analysis, flow log forensics, and IP address lookup powered by AWS EC2 and CloudWatch Logs.

## Tools
- **list_vpcs** – List all VPCs with CIDR, state, and tags
- **get_vpc_network_details** – Full VPC topology: subnets, route tables, IGW, NAT, NACLs, VPC endpoints
- **get_vpc_flow_logs** – Query VPC Flow Logs (ACCEPT/REJECT filter, IP/port filters, time range)
- **find_ip_address** – Locate an ENI by private or public IP address
- **get_eni_details** – Complete security group rules, NACLs, and routing for a network interface`,
    zh: `# AWS 网络 MCP 服务器

基于 AWS EC2 和 CloudWatch Logs 的 VPC 检查、安全组分析、流日志取证和 IP 地址定位服务。

## 工具列表
- **list_vpcs** – 列出所有 VPC（含 CIDR、状态和标签）
- **get_vpc_network_details** – 完整 VPC 拓扑：子网、路由表、IGW、NAT、NACL、VPC 端点
- **get_vpc_flow_logs** – 查询 VPC Flow Log（支持 ACCEPT/REJECT 过滤、IP/端口过滤、时间范围）
- **find_ip_address** – 按私有或公有 IP 定位 ENI（支持单区域或全区域搜索）
- **get_eni_details** – 完整的安全组规则、NACL 和路由表信息

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
