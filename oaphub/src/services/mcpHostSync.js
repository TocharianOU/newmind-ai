/**
 * mcpHostSync — pushes a user's enabled-integrations into the platform
 * MCP Host as a per-project mcp_config.json so the agent loop sees the tools.
 *
 * The MCP Host scopes config by the X-Project-ID header (= our user.id).
 * For each user, we POST the *full* mcp config snapshot every time something
 * changes. The MCP Host overwrites the project's mcp_config.json and reloads.
 */
import fetch from 'node-fetch'
import { prisma } from '../config/database.js'
import logger from '../utils/logger.js'
import { unsealIntegrationConfig } from './tenantMcpService.js'

const getMcpHostUrl   = () => (process.env.MCP_HOST_URL   || '').replace(/\/$/, '')
const getMcpHostToken = () =>  process.env.MCP_HOST_INTERNAL_TOKEN || ''

// HUB_BASE_URL is the URL the *MCP Host* uses to reach this Hub.
//   - 同一 compose 网络内 → http://hub:3000 (默认)
//   - 宿主机直连          → http://localhost:23000
// 用环境变量 HUB_BASE_URL 覆盖。
const getHubBaseUrl = () => (process.env.HUB_BASE_URL || 'http://hub:3000').replace(/\/$/, '')

// ─────────────────────────────────────────────────────────────────────────────
// Registry of stdio MCP packages pre-installed in the mcp-host Docker image
// (see mcp-host/Dockerfile — npm install -g / GitHub tarball).
//
// Each entry maps a lowercase substring of mcpServer.name → spawn command.
//
// To add a new stdio MCP (e.g. Splunk, Sentinel, CrowdStrike):
//   1. Add `<pkg>@<version>` to the `npm install -g` line in mcp-host/Dockerfile
//   2. Append a registry entry below
//   3. Rebuild the mcp-host image — that's it. No code changes elsewhere.
//
// `command` / `args` here override whatever the mcpServer DB row says, because
// container paths are independent of how the desktop app resolves binaries.
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Registry of ALL stdio MCP packages pre-installed in the mcp-host image.
//
// Key    : lowercase substring matched against mcpServer.name
// command: the global npm bin (matches the "bin" field in each package.json)
// args   : any fixed CLI args (usually empty — credentials go through env)
// envMapper (optional): translate UI config keys → actual env vars the package
//   reads. Return { extra: {extra envs}, drop: [keys to remove from env] }.
//   Use this for any field that isn't a direct env var pass-through (e.g.
//   tlsMode → NODE_TLS_REJECT_UNAUTHORIZED).
//
// To add a new integration:
//   1. `npm install -g <pkg>@<ver>` in mcp-host/Dockerfile
//   2. Add an entry below
//   3. Rebuild the image
// ─────────────────────────────────────────────────────────────────────────────
const STDIO_PACKAGE_REGISTRY = {
  // ── Threat Intelligence ──────────────────────────────────────────────────
  abuseipdb: {
    command: 'abuseipdb-mcp',
    args: [],
  },
  virustotal: {
    command: 'mcp-virustotal',
    args: [],
  },
  shodan: {
    command: 'mcp-shodan',
    args: [],
  },

  // ── SIEM / Log Platforms ─────────────────────────────────────────────────
  elasticsearch: {
    command: 'elasticsearch-mcp',
    args: [],
    envMapper: (userConfig) => {
      const extra = {}
      if (userConfig.tlsMode === 'skip') extra.NODE_TLS_REJECT_UNAUTHORIZED = '0'
      if (userConfig.tlsMode === 'ca-cert' && userConfig.ES_CA_CERT) extra.ES_CA_CERT = userConfig.ES_CA_CERT
      return { extra, drop: ['tlsMode'] }
    },
  },
  kibana: {
    command: 'mcp-server-kibana',
    args: [],
    envMapper: (userConfig) => {
      const extra = {}
      if (userConfig.tlsMode === 'skip') extra.NODE_TLS_REJECT_UNAUTHORIZED = '0'
      return { extra, drop: ['tlsMode'] }
    },
  },
  splunk: {
    command: 'splunk-mcp',
    args: [],
  },
  cloudwatch: {
    command: 'cloudwatch-mcp',
    args: [],
  },
  cloudtrail: {
    command: 'cloudtrail-mcp',
    args: [],
  },

  // ── Ticketing / Collaboration ────────────────────────────────────────────
  jira: {
    command: 'jira-mcp',
    args: [],
  },
  confluence: {
    command: 'confluence-mcp',
    args: [],
  },

  // ── Databases ────────────────────────────────────────────────────────────
  mysql: {
    command: 'mcp-server-mysql',
    args: [],
  },
  'sql server': {
    command: 'mcp-server-sqlserver',
    args: [],
  },

  // ── AWS ──────────────────────────────────────────────────────────────────
  'aws ec2': {
    command: 'aws-ec2-mcp',
    args: [],
  },
  'aws iam': {
    command: 'aws-iam-mcp',
    args: [],
  },
  'aws s3': {
    command: 'aws-s3-mcp',
    args: [],
  },
  'aws network': {
    command: 'aws-network-mcp',
    args: [],
  },
  'aws lambda': {
    command: 'lambda-tool-mcp',
    args: [],
  },
  'aws security': {
    command: 'aws-security-mcp',
    args: [],
  },
}

function findRegistryEntry(serverName) {
  const lower = String(serverName || '').toLowerCase()
  // Try exact substring match first (handles multi-word keys like 'aws ec2')
  const key = Object.keys(STDIO_PACKAGE_REGISTRY).find(k => lower.includes(k))
  return key ? STDIO_PACKAGE_REGISTRY[key] : null
}

/**
 * Build the MCP config entry for an integration row.
 * Supports:
 *   - external streamable    → reuses server.url + headers
 *   - pre-installed stdio    → node command with user config as env vars
 */
function buildServerEntry({ server, row, userJwt, userConfig = null }) {
  if (server.transport === 'streamable' || server.transport === 'sse') {
    let parsedHeaders = {}
    try { parsedHeaders = server.headers ? JSON.parse(server.headers) : {} } catch { /* ignore */ }

    // 平台内置服务（如 NewRAG）的地址与令牌由用户在配置表单里填，
    // 不像第三方连接器那样固定在目录里，因此优先取用户配置。
    const cfg = userConfig || {}
    const url = cfg.NEWRAG_MCP_URL || cfg.MCP_URL || cfg.url || server.url
    if (!url) return null

    const headers = { ...parsedHeaders }
    const token = cfg.NEWRAG_TOKEN || cfg.MCP_TOKEN || cfg.token
    if (token) headers.Authorization = `Bearer ${token}`

    return {
      enabled: true,
      transport: server.transport,
      url,
      headers,
    }
  }

  if (server.transport === 'stdio') {
    const registry = findRegistryEntry(server.name)
    if (!registry) return null

    let defaultEnv = {}
    try { defaultEnv = JSON.parse(server.env || '{}') } catch { /* ignore */ }
    const resolvedUserConfig = userConfig || {}

    const filteredUserConfig = Object.fromEntries(
      Object.entries(resolvedUserConfig).filter(([, v]) => v !== '' && v !== null && v !== undefined),
    )

    let extraEnv = {}
    let dropKeys = []
    if (typeof registry.envMapper === 'function') {
      try {
        const mapped = registry.envMapper(filteredUserConfig) || {}
        extraEnv = mapped.extra || {}
        dropKeys = mapped.drop || []
      } catch (err) {
        logger.warn(`[McpHostSync] envMapper for ${server.name} failed: ${err.message}`)
      }
    }

    const env = { ...defaultEnv, ...filteredUserConfig, ...extraEnv }
    for (const k of dropKeys) delete env[k]

    return {
      enabled: true,
      transport: 'stdio',
      command: registry.command,
      args: registry.args,
      env,
    }
  }

  return null
}

/**
 * Push the user's enabled-integration set to the MCP Host as a project config.
 *
 * @param {object}  args
 * @param {string}  args.userId     — used as X-Project-ID
 * @returns {Promise<{ok: boolean, error?: string, count?: number}>}
 */
export async function syncUserMcpConfig({ userId, userJwt, removeNames = [] }) {
  if (!userId) return { ok: false, error: 'userId required' }

  const baseUrl = getMcpHostUrl()
  const token   = getMcpHostToken()
  if (!baseUrl) return { ok: false, error: 'MCP_HOST_URL not configured' }
  if (!token)   return { ok: false, error: 'MCP_HOST_INTERNAL_TOKEN not configured' }

  // 查询该用户启用的连接(当前 tenantId == userId)
  const integrations = await prisma.tenantIntegration.findMany({
    where: { tenantId: userId, enabled: true },
    include: { McpServer: true },
  })

  const mcpServers = {}
  let included = 0
  let skipped  = 0
  const includedServerIds = new Set()

  for (const row of integrations) {
    const server = row.McpServer
    if (!server || !server.isActive) { skipped++; continue }
    let userConfig = null
    if (row.config) {
      userConfig = unsealIntegrationConfig(row.config)
      if (userConfig === null) {
        skipped++
        logger.warn(`[McpHostSync] skipping ${server.name}; stored config could not be decrypted`)
        try {
          await prisma.tenantIntegration.update({
            where: { id: row.id },
            data: {
              status: 'ERROR',
              lastError: 'Stored credentials could not be decrypted. Re-save this integration.',
            },
          })
        } catch (err) {
          logger.warn(`[McpHostSync] failed to mark ${server.name} decrypt error: ${err.message}`)
        }
        continue
      }
    }

    const entry = buildServerEntry({ server, row, userJwt, userConfig })
    if (!entry) { skipped++; continue }
    mcpServers[server.name] = entry
    includedServerIds.add(server.id)
    included++
  }

  // 自定义 MCP（用户自建，统一在「组织连接 → 自定义 MCP」维护）
  const customs = await prisma.tenantCustomMcp.findMany({
    where: { tenantId: userId, enabled: true },
  })
  for (const c of customs) {
    const entry = { enabled: true, transport: c.transport }
    if (c.transport === 'stdio') {
      if (!c.command) { skipped++; continue }
      entry.command = c.command
      entry.args = Array.isArray(c.args) ? c.args : []
      // env / headers 落库时做了信封加密，下发前解密
      entry.env = (c.env ? unsealIntegrationConfig(c.env) : {}) || {}
    } else {
      if (!c.url) { skipped++; continue }
      entry.url = c.url
      entry.headers = (c.headers ? unsealIntegrationConfig(c.headers) : {}) || {}
    }
    mcpServers[c.name] = entry
    included++
  }

  // MCP Host 的配置是按 project 分文件存的（X-Project-ID → projects/<id>/mcp_config.json）。
  // 聊天前端用的是用户真实的 project id（默认为 "default"），因此这里必须逐个 project 下发，
  // 不能用 userId 当作 project id —— 那会写进一个聊天端永远读不到的目录。
  const projects = await prisma.project.findMany({
    where: { userId }, select: { id: true },
  })
  const projectIds = projects.length ? projects.map(p => p.id) : ['default']

  const results = []
  for (const projectId of projectIds) {
    const r = await pushConfigToProject({ userId, projectId, baseUrl, token, mcpServers, removeNames })
    results.push({ projectId, ...r })
  }

  const failed = results.filter(r => !r.ok)
  if (failed.length) {
    return { ok: false, error: failed.map(f => `${f.projectId}: ${f.error}`).join('; ') }
  }
  logger.info(`[McpHostSync] user=${userId} 已下发到 ${projectIds.length} 个 project：${projectIds.join(', ')}`)
  return { ok: true, count: included, projects: projectIds }
}

// 把配置推送到某个 project；合并保护在每个 project 内独立进行
async function pushConfigToProject({ userId, projectId, baseUrl, token, mcpServers: orgServers, removeNames }) {
  const mcpServers = { ...orgServers }
  // 关键：POST /mcpserver 是整体覆盖。直接推送组织配置会抹掉用户在
  // 「锤子」页自行添加的个人 MCP。因此先读回当前配置，保留所有不属于
  // 连接器市场的条目（= 用户个人添加的），再与组织条目合并后写回。
  try {
    // Hub 已接管的名字：市场连接器 + 全部自定义 MCP（含已停用的）+ 本次显式删除的。
    // 这些一律由本次下发的内容决定去留，不能再当作「个人配置」保留，
    // 否则停用/删除后旧条目会永远赖在 mcp-host 里。
    const [marketRows, customRows] = await Promise.all([
      prisma.mcpServer.findMany({ select: { name: true } }),
      prisma.tenantCustomMcp.findMany({ where: { tenantId: userId }, select: { name: true } }),
    ])
    const hubManagedNames = new Set([
      ...marketRows.map(r => r.name),
      ...customRows.map(r => r.name),
      ...removeNames,
    ])
    const current = await fetch(`${baseUrl}/api/config/mcpserver`, {
      method: 'GET',
      headers: { 'X-Auth-Token': token, 'X-Project-ID': String(projectId) },
    })
    if (current.ok) {
      const body = await current.json().catch(() => null)
      const existing = body?.config?.mcpServers || {}
      let preserved = 0
      for (const [name, entry] of Object.entries(existing)) {
        // 组织管理的条目本轮会被重新下发；市场之外的一律视为个人配置，保留
        if (hubManagedNames.has(name)) continue
        if (mcpServers[name]) continue
        mcpServers[name] = entry
        preserved++
      }
      if (preserved) logger.info(`[McpHostSync] user=${userId} project=${projectId} 保留 ${preserved} 个个人 MCP 配置`)
    } else {
      logger.warn(`[McpHostSync] 读取现有配置失败 HTTP ${current.status}，本轮跳过合并以免误删`)
      return { ok: false, error: '无法读取现有 MCP 配置，已中止同步以避免覆盖个人配置' }
    }
  } catch (err) {
    logger.warn(`[McpHostSync] 读取现有配置异常: ${err.message}`)
    return { ok: false, error: '无法读取现有 MCP 配置，已中止同步以避免覆盖个人配置' }
  }

  try {
    const upstream = await fetch(`${baseUrl}/api/config/mcpserver`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': token,
        'X-Project-ID': String(projectId),
      },
      body: JSON.stringify({ mcpServers }),
    })

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '')
      logger.error(`[McpHostSync] upstream HTTP ${upstream.status}: ${text.slice(0, 300)}`)
      return { ok: false, error: `MCP Host responded HTTP ${upstream.status}` }
    }

    logger.info(`[McpHostSync] user=${userId} project=${projectId} 写入 ${Object.keys(mcpServers).length} 个 MCP`)
    return { ok: true, count: Object.keys(mcpServers).length }
  } catch (err) {
    logger.error('[McpHostSync] sync failed:', err.message)
    return { ok: false, error: err.message }
  }
}
