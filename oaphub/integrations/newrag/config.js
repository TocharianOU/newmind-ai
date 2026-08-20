export default {
  name: 'NewRAG',
  version: '3.5.0',
  // 平台内置服务：随平台一起部署，无需下载安装包
  downloadUrl: null,

  description: '企业知识库检索：语义搜索、精确关键词检索、文档原文分页读取，支持图纸/PDF/Office 文档',
  descriptionI18n: {
    zh: '企业知识库检索：语义搜索、精确关键词检索、文档原文分页读取，支持图纸/PDF/Office 文档',
    en: 'Enterprise knowledge base retrieval: semantic search, exact keyword lookup, and paginated document reading for drawings, PDFs and Office files',
  },

  tags: ['知识库'],

  // NewRAG MCP 是随平台部署的常驻 HTTP 服务，不是 stdio 子进程
  transport: 'streamable',
  url: '',
  env: {},

  planRequired: 'BASE',
  logo: '/integrations/newrag/logo-48.svg',
  banner: '/integrations/newrag/logo-240.svg',

  document: `# NewRAG 知识库

平台内置的知识库检索服务。文档上传、OCR、向量化与索引都在 NewRAG 自身完成，
本连接器只负责把检索能力接入对话。

## 工具

- **search_content** —— 语义搜索。用自然语言描述要找的内容，返回最相关的文档片段。适合"有没有讲 XX 的资料""XX 是怎么规定的"这类问题
- **keyword_search** —— 精确关键词检索。**默认精确匹配**，适合图号、编号、人名、型号等不能模糊的场景；需要容错时传 \`fuzzy: true\`
- **search_description** —— 按页面整体描述检索。适合"哪一页画的是 XX""找那张有 XX 的图"这类以版面/图形为线索的问题
- **get_document_chunks** —— 按文档 ID 读取原文，支持 \`page_start\`/\`page_end\` 分页，单次最多 20 页

## 配置

- **MCP 地址**：
  - 与平台一体化部署（NewChat 和 NewRAG 装在同一台机器）：\`http://host.docker.internal:3001/mcp\`
  - NewRAG 独立部署在其他主机：\`http://<NewRAG主机>:3001/mcp\`
- **访问令牌**：在 NewRAG 界面的「MCP」页面创建后粘贴到这里。平台一体化安装时会自动签发并预填。

## 使用建议

先用 \`search_content\` 或 \`search_description\` 定位到文档和页码，再用 \`get_document_chunks\` 读原文细节，
避免一次性把整份文档拉进上下文。`,

  documentI18n: {},

  configSchema: {
    type: 'object',
    required: ['NEWRAG_MCP_URL', 'NEWRAG_TOKEN'],
    properties: {
      NEWRAG_MCP_URL: {
        type: 'string',
        title: 'MCP 地址',
        description: '一体化部署填 http://host.docker.internal:3001/mcp；NewRAG 在其他主机则填该主机地址',
        format: 'uri',
        default: 'http://host.docker.internal:3001/mcp',
      },
      NEWRAG_TOKEN: {
        type: 'string',
        title: '访问令牌',
        description: '在 NewRAG 界面「MCP」页创建的 token',
        sensitive: true,
      },
    },
  },

  toolTier: 'X',
  unitPriceUsd: 0,
  popular: true,
  new: true,
  isActive: true,
}
