export default {
  name: 'Confluence',
  version: '1.0.0',
  downloadUrl: 'https://github.com/TocharianOU/confluence-mcp/releases/download/v1.0.0/confluence-mcp-v1.0.0.tar.gz',

  description: 'Confluence knowledge base integration – CQL full-text search, page read/create/update, space listing, and inline comments for IR runbooks and post-mortems',
  descriptionI18n: {
    zh: 'Confluence 知识库集成——CQL 全文搜索、页面读取/创建/更新、空间列表、内联评论，适用于 IR 手册和复盘文档，支持 Cloud 和 Server/DC'
  },

  tags: ['Ticketing'],

  transport: 'stdio',
  command: 'node',
  args: ['{{install_path}}/dist/index.js'],
  env: {
    CONFLUENCE_HOST: '',
    CONFLUENCE_EMAIL: '',
    CONFLUENCE_TOKEN: '',
    CONFLUENCE_API_VERSION: 'v2',
    CONFLUENCE_VERIFY_SSL: 'true',
    CONFLUENCE_TIMEOUT: '30000',
    MAX_TOKEN_CALL: '20000',
  },

  planRequired: 'BASE',
  logo: '/integrations/confluence/logo-48.svg',
  banner: '/integrations/confluence/logo-240.svg',

  document: `# Confluence MCP Server

Confluence knowledge base integration for security operations. Search runbooks, IR playbooks, and post-mortems using CQL; read full page content; create and update investigation reports; add inline comments.

## Tools

- **confluence_health_check** – Test connection and verify account info (display name, email, account ID) and count of accessible spaces. Run first to confirm credentials
- **search_content** – CQL full-text search across all pages and blog posts. Returns titles, space keys, URLs, and excerpts. Supports space scoping via \`space_key\`. Key params: \`query\` (required), \`space_key\`, \`limit\` (default 20), \`excerpt_only\` (default true)
- **get_page** – Get full content of a page by ID. Returns title, space, version, URL, and page body as plain text (HTML stripped). Use \`max_length\` (default 3000) to control output size. Best used after \`search_content\` to read a specific runbook or post-mortem
- **create_page** – Create a new page in a specified space. Content must be in Confluence Storage Format (XHTML-based). Returns page ID and URL. Use \`parent_id\` to nest under an existing page
- **update_page** – Update an existing page with new content. Automatically increments version. The \`content\` field replaces the entire page body. Optional \`version_comment\` describes the change
- **list_spaces** – List all accessible Confluence spaces with keys, names, and types (global/personal). Use to find space keys before creating pages or scoping searches
- **list_pages_in_space** – List pages within a space. Returns page IDs, titles, version numbers, and URLs. Optional \`title\` filter. Use to browse space structure and find parent page IDs
- **add_page_comment** – Add an inline comment to a page. Use to annotate post-mortems or runbooks with investigation notes without modifying the main content

## Authentication

- **Confluence Cloud**: \`CONFLUENCE_HOST\` (e.g. \`https://yourorg.atlassian.net\`) + \`CONFLUENCE_EMAIL\` (account email) + \`CONFLUENCE_TOKEN\` (API token from [id.atlassian.com](https://id.atlassian.com/manage-profile/security/api-tokens))
- **Confluence Server / Data Center**: \`CONFLUENCE_HOST\` + \`CONFLUENCE_TOKEN\` (Personal Access Token) — leave \`CONFLUENCE_EMAIL\` empty; set \`CONFLUENCE_API_VERSION=v1\`
- **SSL**: Set \`CONFLUENCE_VERIFY_SSL=false\` for self-signed certificates

## Investigation Workflow

1. \`confluence_health_check\` → confirm connection and account identity
2. \`list_spaces\` → find the security knowledge base space key (e.g. \`SEC\`, \`SECOPS\`)
3. \`search_content query:"incident response ransomware" space_key:"SEC"\` → find relevant runbooks
4. \`get_page 123456789\` → read the full IR playbook content
5. \`create_page space_key:"SEC" title:"Incident Report – 2026-02-22" content:"<p>...</p>"\` → publish investigation findings
6. \`update_page 987654321\` → append new findings to a running post-mortem
7. \`add_page_comment 987654321\` → annotate a page with inline investigation notes`,

  documentI18n: {
    zh: `# Confluence MCP 服务器

面向安全运营的 Confluence 知识库集成。支持 CQL 搜索应急手册、IR 剧本和复盘文档；读取完整页面内容；创建和更新调查报告；添加内联评论。

## 工具

- **confluence_health_check** – 测试连接并验证账户信息（显示名、邮箱、账户 ID）及可访问空间数量
- **search_content** – CQL 全文搜索所有页面和博客文章。返回标题、空间 key、URL 和摘要。支持通过 \`space_key\` 限定空间范围
- **get_page** – 通过 ID 获取页面完整内容，返回标题、空间、版本、URL 以及去除 HTML 标签的纯文本正文
- **create_page** – 在指定空间创建新页面。内容须为 Confluence Storage Format（基于 XHTML）。返回页面 ID 和 URL
- **update_page** – 更新已有页面，自动递增版本号。\`content\` 字段完整替换页面正文
- **list_spaces** – 列出所有可访问空间的 key、名称和类型（global/personal）
- **list_pages_in_space** – 列出指定空间的页面，返回 ID、标题、版本号和 URL。支持标题子串过滤
- **add_page_comment** – 为页面添加内联评论，记录调查笔记而不修改主内容

## 认证方式

- **Confluence Cloud**：\`CONFLUENCE_HOST\`（如 \`https://yourorg.atlassian.net\`）+ \`CONFLUENCE_EMAIL\`（账户邮箱）+ \`CONFLUENCE_TOKEN\`（API Token）
- **Confluence Server/DC**：\`CONFLUENCE_HOST\` + \`CONFLUENCE_TOKEN\`（个人访问令牌）— 留空 \`CONFLUENCE_EMAIL\`；设置 \`CONFLUENCE_API_VERSION=v1\`
- **SSL**：自签名证书请设置 \`CONFLUENCE_VERIFY_SSL=false\`

## 调查工作流

1. \`confluence_health_check\` → 确认连接和账户身份
2. \`list_spaces\` → 找到安全知识库空间 key（如 \`SEC\`、\`SECOPS\`）
3. \`search_content query:"勒索软件应急响应" space_key:"SEC"\` → 查找相关手册
4. \`get_page 123456789\` → 阅读完整 IR 剧本内容
5. \`create_page space_key:"SEC" title:"事件报告 – 2026-02-22"\` → 发布调查结论
6. \`update_page 987654321\` → 向持续更新的复盘文档追加新发现
7. \`add_page_comment 987654321\` → 为页面添加内联调查笔记`
  },

  configSchema: {
    type: 'object',
    required: ['CONFLUENCE_HOST', 'CONFLUENCE_TOKEN'],
    properties: {
      CONFLUENCE_HOST: {
        type: 'string',
        title: 'Confluence Host URL',
        description: 'Cloud: https://yourorg.atlassian.net | Server/DC: https://confluence.yourcompany.com',
      },
      CONFLUENCE_EMAIL: {
        type: 'string',
        title: 'Account Email (Cloud only)',
        description: 'Atlassian account email. Required for Confluence Cloud. Leave empty for Server/DC.',
      },
      CONFLUENCE_TOKEN: {
        type: 'string',
        title: 'API Token / Personal Access Token',
        description: 'Cloud: API token from id.atlassian.com/manage-profile/security/api-tokens. Server/DC: Personal Access Token.',
        sensitive: true,
      },
      CONFLUENCE_API_VERSION: {
        type: 'string',
        title: 'API Version',
        description: '"v2" for Confluence Cloud modern API (default). "v1" for Confluence Server / Data Center or older Cloud.',
        default: 'v2',
        enum: ['v2', 'v1'],
      },
      CONFLUENCE_VERIFY_SSL: {
        type: 'string',
        title: 'SSL/TLS Verification',
        description: '"true" to verify SSL certificates (default). "false" for self-signed certificates.',
        default: 'true',
        enum: ['true', 'false'],
      },
      CONFLUENCE_TIMEOUT: {
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
        required: ['CONFLUENCE_HOST', 'CONFLUENCE_EMAIL', 'CONFLUENCE_TOKEN'],
        title: 'Confluence Cloud (Email + API Token)',
      },
      {
        required: ['CONFLUENCE_HOST', 'CONFLUENCE_TOKEN'],
        title: 'Confluence Server / Data Center (Personal Access Token)',
      },
    ],
  },

  toolTier: 'X',
  unitPriceUsd: 0,
  popular: false,
  new: true,
  isActive: true,
};
