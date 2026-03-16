export default {
  name: 'Jira',
  version: '1.0.0',
  downloadUrl: 'https://github.com/TocharianOU/jira-mcp/releases/download/v1.0.0/jira-mcp-v1.0.0.tar.gz',

  description: 'Jira issue search (JQL), create security incidents, update fields, add investigation comments, manage workflow transitions, and list projects',
  descriptionI18n: {
    zh: 'Jira 工单管理——JQL 搜索、创建安全事件、更新字段、添加调查评论、流转工作流状态、列出项目，支持 Jira Cloud 和 Server/DC'
  },

  tags: ['Ticketing'],

  transport: 'stdio',
  command: 'node',
  args: ['{{install_path}}/dist/index.js'],
  env: {
    JIRA_HOST: '',
    JIRA_EMAIL: '',
    JIRA_TOKEN: '',
    JIRA_API_VERSION: '3',
    JIRA_VERIFY_SSL: 'true',
    JIRA_TIMEOUT: '30000',
    MAX_TOKEN_CALL: '20000',
  },

  planRequired: 'BASE',
  logo: '/integrations/jira/logo-48.svg',
  banner: '/integrations/jira/logo-240.svg',

  document: `# Jira MCP Server

Jira integration for security incident management. Search issues with JQL, create security incidents or tasks, record investigation findings as comments, and move issues through workflow states.

## Tools

- **jira_health_check** – Test connection and verify authenticated account info (display name, email, account ID) plus Jira server version and deployment type. Run first to confirm credentials
- **search_issues** – JQL-based search. Returns key, summary, status, type, priority, assignee, reporter, created/updated, and labels. Supports full JQL including \`ORDER BY\`, field filters, and functions like \`currentUser()\`. Key params: \`jql\` (required), \`max_results\` (default 50), \`fields\` (custom field list), \`start_at\` (pagination)
- **get_issue** – Full details of a single issue by key (e.g. SEC-123). Includes description (ADF parsed to plain text), all comments with authors and timestamps, status, priority, and metadata
- **create_issue** – Create a new issue. Required: \`project_key\`, \`summary\`. Optional: \`issue_type\` (Task/Bug/Story/Incident), \`description\`, \`priority\` (Critical/High/Medium/Low), \`labels\`, \`components\`, \`assignee\` (accountId). Returns issue key and URL
- **update_issue** – Update summary, description, priority, or labels of an existing issue. Does not change status (use \`transition_issue\` for that)
- **add_comment** – Add a comment to record investigation steps, evidence, IOC lists, or remediation actions. Creates a permanent audit trail on the ticket
- **list_transitions** – List all available workflow transitions for an issue. Returns transition ID and target status name. Use before \`transition_issue\` to find the correct ID
- **transition_issue** – Move an issue to a new status using transition ID. Optionally attach a comment explaining the status change (e.g. "Closed: no compromise confirmed")
- **list_projects** – List all accessible Jira projects with keys, names, and types. Use to find the project key before creating issues or scoping JQL queries

## Authentication

- **Jira Cloud**: \`JIRA_HOST\` (e.g. \`https://yourorg.atlassian.net\`) + \`JIRA_EMAIL\` (account email) + \`JIRA_TOKEN\` (API token from [id.atlassian.com](https://id.atlassian.com/manage-profile/security/api-tokens))
- **Jira Server / Data Center**: \`JIRA_HOST\` + \`JIRA_TOKEN\` (Personal Access Token) — leave \`JIRA_EMAIL\` empty; set \`JIRA_API_VERSION=2\`
- **SSL**: Set \`JIRA_VERIFY_SSL=false\` for self-signed certificates

## Investigation Workflow

1. \`jira_health_check\` → confirm connection and account identity
2. \`list_projects\` → find the correct project key (e.g. \`SEC\`, \`INFRA\`)
3. \`search_issues jql:"project=SEC AND status=Open AND labels=security-incident ORDER BY priority DESC"\` → find active incidents
4. \`get_issue SEC-123\` → read full description and investigation history
5. \`add_comment SEC-123\` → record findings, IOC list, affected systems, timeline
6. \`list_transitions SEC-123\` → see available status changes
7. \`transition_issue SEC-123 transitionId:41 comment:"Investigation complete"\` → close or escalate`,

  documentI18n: {
    zh: `# Jira MCP 服务器

面向安全事件管理的 Jira 集成。支持 JQL 搜索工单、创建安全事件或任务、以评论方式记录调查结论，并推进工单状态流转。

## 工具

- **jira_health_check** – 测试连接并验证已认证账户信息（显示名、邮箱、账户 ID）及 Jira 服务器版本和部署类型。首次使用时运行以确认凭据
- **search_issues** – JQL 搜索。返回 key、摘要、状态、类型、优先级、负责人、报告人、创建/更新时间和标签。支持完整 JQL 包括 \`ORDER BY\`、字段过滤和 \`currentUser()\` 等函数
- **get_issue** – 通过 key（如 SEC-123）获取单条工单的完整详情，含描述（ADF 解析为纯文本）、所有评论（含作者和时间戳）、状态、优先级及元数据
- **create_issue** – 创建新工单。必填：\`project_key\`、\`summary\`。可选：工单类型、描述、优先级、标签、组件、负责人。返回工单 key 和 URL
- **update_issue** – 更新摘要、描述、优先级或标签。不变更状态（状态变更请用 \`transition_issue\`）
- **add_comment** – 添加评论记录调查步骤、证据、IOC 列表或处置动作，形成持久的审计轨迹
- **list_transitions** – 列出工单可用的工作流转换，返回转换 ID 和目标状态名称。在 \`transition_issue\` 之前使用以获取正确 ID
- **transition_issue** – 使用转换 ID 将工单移至新状态，可附带说明变更原因的评论
- **list_projects** – 列出所有可访问的 Jira 项目及其 key、名称和类型

## 认证方式

- **Jira Cloud**：\`JIRA_HOST\`（如 \`https://yourorg.atlassian.net\`）+ \`JIRA_EMAIL\`（账户邮箱）+ \`JIRA_TOKEN\`（API Token）
- **Jira Server/DC**：\`JIRA_HOST\` + \`JIRA_TOKEN\`（个人访问令牌）— 留空 \`JIRA_EMAIL\`；设置 \`JIRA_API_VERSION=2\`
- **SSL**：自签名证书请设置 \`JIRA_VERIFY_SSL=false\`

## 调查工作流

1. \`jira_health_check\` → 确认连接和账户身份
2. \`list_projects\` → 找到正确的项目 key（如 \`SEC\`、\`INFRA\`）
3. \`search_issues jql:"project=SEC AND status=Open AND labels=security-incident ORDER BY priority DESC"\` → 查找活跃事件
4. \`get_issue SEC-123\` → 阅读完整描述和调查历史
5. \`add_comment SEC-123\` → 记录调查结论、IOC 列表、受影响系统、时间线
6. \`list_transitions SEC-123\` → 查看可用状态变更
7. \`transition_issue SEC-123 transitionId:41 comment:"调查完成"\` → 关闭或升级工单`
  },

  configSchema: {
    type: 'object',
    required: ['JIRA_HOST', 'JIRA_TOKEN'],
    properties: {
      JIRA_HOST: {
        type: 'string',
        title: 'Jira Host URL',
        description: 'Jira Cloud: https://yourorg.atlassian.net | Jira Server/DC: https://jira.yourcompany.com',
      },
      JIRA_EMAIL: {
        type: 'string',
        title: 'Account Email (Cloud only)',
        description: 'Atlassian account email. Required for Jira Cloud. Leave empty for Server/DC.',
      },
      JIRA_TOKEN: {
        type: 'string',
        title: 'API Token / Personal Access Token',
        description: 'Cloud: API token from id.atlassian.com/manage-profile/security/api-tokens. Server/DC: Personal Access Token.',
        sensitive: true,
      },
      JIRA_API_VERSION: {
        type: 'string',
        title: 'API Version',
        description: 'Use "3" for Jira Cloud (returns ADF descriptions). Use "2" for Jira Server / Data Center.',
        default: '3',
        enum: ['3', '2'],
      },
      JIRA_VERIFY_SSL: {
        type: 'string',
        title: 'SSL/TLS Verification',
        description: '"true" to verify SSL certificates (default). "false" for self-signed certificates.',
        default: 'true',
        enum: ['true', 'false'],
      },
      JIRA_TIMEOUT: {
        type: 'string',
        title: 'Request Timeout (ms)',
        description: 'HTTP request timeout in milliseconds',
        default: '30000',
      },
      MAX_TOKEN_CALL: {
        type: 'string',
        title: 'Max Token Limit',
        description: 'Maximum tokens per tool call result. Prevents context window overflow.',
        default: '20000',
      },
    },
    oneOf: [
      {
        required: ['JIRA_HOST', 'JIRA_EMAIL', 'JIRA_TOKEN'],
        title: 'Jira Cloud (Email + API Token)',
      },
      {
        required: ['JIRA_HOST', 'JIRA_TOKEN'],
        title: 'Jira Server / Data Center (Personal Access Token)',
      },
    ],
  },

  toolTier: 'X',
  unitPriceUsd: 0,
  popular: false,
  new: true,
  isActive: true,
};
