import express from 'express'
import fetch from 'node-fetch'
import https from 'https'
import crypto from 'crypto'
import { authenticateToken } from '../middleware/auth.js'
import { prisma } from '../config/database.js'
import { createResponse } from '../config/constants.js'
import { writeAudit, AUDIT_ACTIONS, RESOURCE_TYPES } from '../utils/auditLog.js'
import logger from '../utils/logger.js'
import {
  disableTenantIntegration,
  enableTenantIntegration,
  listTenantHosts,
  listTenantIntegrations,
  redactIntegrationConfig,
  sealIntegrationConfig,
  resolveTenantId,
  unsealIntegrationConfig,
  upsertTenantHost,
} from '../services/tenantMcpService.js'
import { syncUserMcpConfig } from '../services/mcpHostSync.js'

const router = express.Router()

function extractJwt(req) {
  const auth = req.headers['authorization']
  if (auth && /^Bearer\s/i.test(auth)) return auth.split(/\s+/)[1] || ''
  return req.headers['x-hub-token'] || ''
}

const VALID_HOST_STATUSES = new Set(['REGISTERED', 'STARTING', 'RUNNING', 'ERROR', 'STOPPED'])
const VALID_DEPLOYMENTS = new Set(['docker', 'kubernetes', 'connector', 'manual'])

// POST /api/v1/tenant-mcp/mcp — Streamable HTTP JSON-RPC proxy to default tenant MCP Host.
router.post('/mcp', authenticateToken, async (req, res) => {
  const tenantId = resolveTenantId(req)
  const sessionId = req.headers['mcp-session-id']

  try {
    const host = await getRunnableDefaultHost(tenantId)
    if (!host) {
      return res.status(409).json(createResponse(null, 'No running tenant MCP Host registered'))
    }

    const headers = {
      'Content-Type': 'application/json',
      'X-User-ID': req.user.id,
      'X-Tenant-ID': tenantId,
    }
    if (req.headers['accept']) headers.Accept = req.headers['accept']
    if (sessionId) headers['mcp-session-id'] = sessionId
    if (req.headers['x-project-id']) headers['X-Project-ID'] = req.headers['x-project-id']

    const upstream = await fetch(mcpUrl(host.baseUrl), {
      method: 'POST',
      headers,
      body: JSON.stringify(req.body ?? {}),
    })

    forwardMcpResponse(upstream, res)
  } catch (error) {
    logger.error('[TenantMCP] POST /mcp proxy failed:', error)
    if (!res.headersSent) {
      res.status(502).json(createResponse(null, 'Tenant MCP Host unavailable'))
    }
  }
})

// GET /api/v1/tenant-mcp/mcp — SSE stream proxy for MCP session resumption.
router.get('/mcp', authenticateToken, async (req, res) => {
  const tenantId = resolveTenantId(req)
  const sessionId = req.headers['mcp-session-id']

  if (!sessionId) {
    return res.status(400).json(createResponse(null, 'mcp-session-id header required for SSE stream'))
  }

  try {
    const host = await getRunnableDefaultHost(tenantId)
    if (!host) {
      return res.status(409).end('No running tenant MCP Host registered')
    }

    const upstream = await fetch(mcpUrl(host.baseUrl), {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
        'mcp-session-id': sessionId,
        'X-User-ID': req.user.id,
        'X-Tenant-ID': tenantId,
        ...(req.headers['x-project-id'] ? { 'X-Project-ID': req.headers['x-project-id'] } : {}),
      },
    })

    forwardMcpResponse(upstream, res)
    req.on('close', () => upstream.body?.destroy?.())
  } catch (error) {
    logger.error('[TenantMCP] GET /mcp SSE proxy failed:', error)
    if (!res.headersSent) {
      res.status(502).end()
    }
  }
})

// GET /api/v1/tenant-mcp/hosts
router.get('/hosts', authenticateToken, async (req, res) => {
  try {
    const tenantId = resolveTenantId(req)
    const hosts = await listTenantHosts(tenantId)
    res.json(createResponse({ tenantId, hosts }))
  } catch (error) {
    logger.error('[TenantMCP] Failed to list hosts:', error)
    res.status(500).json(createResponse(null, 'Failed to list tenant MCP hosts'))
  }
})

// PUT /api/v1/tenant-mcp/hosts/default
router.put('/hosts/default', authenticateToken, async (req, res) => {
  try {
    const tenantId = resolveTenantId(req)
    const ownerUserId = req.user.id
    const {
      baseUrl,
      status = 'REGISTERED',
      deployment = 'docker',
      metadata = null,
    } = req.body || {}

    if (!baseUrl || typeof baseUrl !== 'string') {
      return res.status(400).json(createResponse(null, 'baseUrl is required'))
    }

    try {
      new URL(baseUrl)
    } catch {
      return res.status(400).json(createResponse(null, 'baseUrl must be a valid URL'))
    }

    if (!VALID_HOST_STATUSES.has(status)) {
      return res.status(400).json(createResponse(null, `Invalid status: ${status}`))
    }

    if (!VALID_DEPLOYMENTS.has(deployment)) {
      return res.status(400).json(createResponse(null, `Invalid deployment: ${deployment}`))
    }

    const host = await upsertTenantHost({
      tenantId,
      ownerUserId,
      name: 'default',
      baseUrl: baseUrl.replace(/\/$/, ''),
      status,
      deployment,
      metadata,
    })

    await writeAudit(req, {
      userId: ownerUserId,
      action: host.createdAt.getTime() === host.updatedAt.getTime()
        ? AUDIT_ACTIONS.TENANT_MCP_HOST_REGISTERED
        : AUDIT_ACTIONS.TENANT_MCP_HOST_UPDATED,
      resourceType: RESOURCE_TYPES.TENANT_MCP_HOST,
      resourceId: host.id,
      metadata: { tenantId, status, deployment },
    })

    res.json(createResponse({ tenantId, host }))
  } catch (error) {
    logger.error('[TenantMCP] Failed to upsert default host:', error)
    res.status(500).json(createResponse(null, 'Failed to save tenant MCP host'))
  }
})

// GET /api/v1/tenant-mcp/integrations
router.get('/integrations', authenticateToken, async (req, res) => {
  try {
    const tenantId = resolveTenantId(req)
    const integrations = await listTenantIntegrations(tenantId)
    res.json(createResponse({ tenantId, integrations: integrations.map(toIntegrationResponse) }))
  } catch (error) {
    logger.error('[TenantMCP] Failed to list integrations:', error)
    res.status(500).json(createResponse(null, 'Failed to list tenant integrations'))
  }
})

// GET /api/v1/tenant-mcp/tool-overrides
router.get('/tool-overrides', authenticateToken, async (req, res) => {
  try {
    const prefs = await prisma.userPreferences.findUnique({
      where: { userId: req.user.id },
      select: { toolOverrides: true },
    })
    res.json(createResponse({ overrides: prefs?.toolOverrides || {} }))
  } catch (error) {
    logger.error('[TenantMCP] Failed to load tool overrides:', error)
    res.status(500).json(createResponse(null, 'Failed to load tool overrides'))
  }
})

// PUT /api/v1/tenant-mcp/tool-overrides
router.put('/tool-overrides', authenticateToken, async (req, res) => {
  try {
    const overrides = req.body?.overrides && typeof req.body.overrides === 'object'
      ? req.body.overrides
      : {}
    const prefs = await prisma.userPreferences.upsert({
      where: { userId: req.user.id },
      update: { toolOverrides: overrides, updatedAt: new Date() },
      create: {
        userId: req.user.id,
        toolOverrides: overrides,
        updatedAt: new Date(),
      },
      select: { toolOverrides: true },
    })
    res.json(createResponse({ overrides: prefs.toolOverrides || {} }))
  } catch (error) {
    logger.error('[TenantMCP] Failed to save tool overrides:', error)
    res.status(500).json(createResponse(null, 'Failed to save tool overrides'))
  }
})

// POST /api/v1/tenant-mcp/integrations/:mcpServerId/test
router.post('/integrations/:mcpServerId/test', authenticateToken, async (req, res) => {
  try {
    const { mcpServerId } = req.params
    const body = req.body || {}
    const config = Object.prototype.hasOwnProperty.call(body, 'config') ? body.config : undefined

    const server = await prisma.mcpServer.findFirst({
      where: { id: mcpServerId, isActive: true },
      select: { id: true, name: true },
    })

    if (!server) {
      return res.status(404).json(createResponse(null, 'MCP integration not found'))
    }

    const result = await testIntegrationConfig(server, config)
    if (!result.ok) {
      return res.status(400).json(createResponse(result, result.error || 'Connection test failed'))
    }

    res.json(createResponse(result))
  } catch (error) {
    logger.error('[TenantMCP] Failed to test integration:', error)
    res.status(500).json(createResponse(null, 'Failed to test integration'))
  }
})

// PUT /api/v1/tenant-mcp/integrations/:mcpServerId
router.put('/integrations/:mcpServerId', authenticateToken, async (req, res) => {
  try {
    const tenantId = resolveTenantId(req)
    const ownerUserId = req.user.id
    const { mcpServerId } = req.params
    const { config = null } = req.body || {}

    const server = await prisma.mcpServer.findFirst({
      where: { id: mcpServerId, isActive: true },
      select: { id: true, name: true },
    })

    if (!server) {
      return res.status(404).json(createResponse(null, 'MCP integration not found'))
    }

    const integration = await enableTenantIntegration({
      tenantId,
      ownerUserId,
      mcpServerId,
      config,
    })

    await writeAudit(req, {
      userId: ownerUserId,
      action: integration.createdAt.getTime() === integration.updatedAt.getTime()
        ? AUDIT_ACTIONS.TENANT_INTEGRATION_ENABLED
        : AUDIT_ACTIONS.TENANT_INTEGRATION_UPDATED,
      resourceType: RESOURCE_TYPES.TENANT_INTEGRATION,
      resourceId: integration.id,
      metadata: {
        tenantId,
        mcpServerId,
        integrationName: server.name,
        config: config === undefined ? '[preserved]' : redactIntegrationConfig(config),
      },
    })

    // Push the updated server set into the platform MCP Host as a per-user
    // project config so the agent loop can actually see the tools.
    const sync = await syncUserMcpConfig({ userId: ownerUserId, userJwt: extractJwt(req) })
    if (!sync.ok) {
      logger.warn(`[TenantMCP] MCP Host sync failed after enable (user=${ownerUserId}): ${sync.error}`)
    }

    res.json(createResponse({
      tenantId,
      integration: toIntegrationResponse({ ...integration, McpServer: server }),
      hostSync: sync,
    }))
  } catch (error) {
    logger.error('[TenantMCP] Failed to enable integration:', error)
    res.status(500).json(createResponse(null, 'Failed to enable tenant integration'))
  }
})

// DELETE /api/v1/tenant-mcp/integrations/:mcpServerId
router.delete('/integrations/:mcpServerId', authenticateToken, async (req, res) => {
  try {
    const tenantId = resolveTenantId(req)
    const { mcpServerId } = req.params

    const existing = await prisma.tenantIntegration.findUnique({
      where: { tenantId_mcpServerId: { tenantId, mcpServerId } },
    })

    if (!existing) {
      return res.status(404).json(createResponse(null, 'Tenant integration not found'))
    }

    const integration = await disableTenantIntegration({ tenantId, mcpServerId })

    await writeAudit(req, {
      userId: req.user.id,
      action: AUDIT_ACTIONS.TENANT_INTEGRATION_DISABLED,
      resourceType: RESOURCE_TYPES.TENANT_INTEGRATION,
      resourceId: integration.id,
      metadata: { tenantId, mcpServerId },
    })

    const sync = await syncUserMcpConfig({ userId: req.user.id, userJwt: extractJwt(req) })
    if (!sync.ok) {
      logger.warn(`[TenantMCP] MCP Host sync failed after disable (user=${req.user.id}): ${sync.error}`)
    }

    res.json(createResponse({ tenantId, integration: toIntegrationResponse(integration), hostSync: sync }))
  } catch (error) {
    logger.error('[TenantMCP] Failed to disable integration:', error)
    res.status(500).json(createResponse(null, 'Failed to disable tenant integration'))
  }
})

// DELETE /api/v1/tenant-mcp/integrations/:mcpServerId/remove
router.delete('/integrations/:mcpServerId/remove', authenticateToken, async (req, res) => {
  try {
    const tenantId = resolveTenantId(req)
    const { mcpServerId } = req.params

    const existing = await prisma.tenantIntegration.findUnique({
      where: { tenantId_mcpServerId: { tenantId, mcpServerId } },
    })

    if (!existing) {
      return res.status(404).json(createResponse(null, 'Tenant integration not found'))
    }

    await prisma.tenantIntegration.delete({
      where: { tenantId_mcpServerId: { tenantId, mcpServerId } },
    })

    await writeAudit(req, {
      userId: req.user.id,
      action: AUDIT_ACTIONS.TENANT_INTEGRATION_DISABLED,
      resourceType: RESOURCE_TYPES.TENANT_INTEGRATION,
      resourceId: existing.id,
      metadata: { tenantId, mcpServerId, removed: true },
    })

    const sync = await syncUserMcpConfig({ userId: req.user.id, userJwt: extractJwt(req) })
    if (!sync.ok) {
      logger.warn(`[TenantMCP] MCP Host sync failed after remove (user=${req.user.id}): ${sync.error}`)
    }

    res.json(createResponse({ tenantId, removed: true, hostSync: sync }))
  } catch (error) {
    logger.error('[TenantMCP] Failed to remove integration:', error)
    res.status(500).json(createResponse(null, 'Failed to remove tenant integration'))
  }
})

// POST /api/v1/tenant-mcp/aws-detect
// Verifies AWS credentials via STS GetCallerIdentity (no extra SDK needed).
router.post('/aws-detect', authenticateToken, async (req, res) => {
  try {
    const { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_DEFAULT_REGION, AWS_SESSION_TOKEN } = req.body || {}
    if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
      return res.status(400).json(createResponse(null, 'AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are required'))
    }
    const result = await awsStsGetCallerIdentity({
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
      region: AWS_DEFAULT_REGION || 'us-east-1',
      sessionToken: AWS_SESSION_TOKEN || '',
    })
    if (!result.ok) {
      return res.status(400).json(createResponse(result, result.error || 'Invalid AWS credentials'))
    }
    res.json(createResponse(result))
  } catch (error) {
    logger.error('[TenantMCP] AWS detect failed:', error)
    res.status(500).json(createResponse(null, 'AWS credential verification failed'))
  }
})

// ── AWS Signature V4 / STS helper (no external deps) ──────────────────────────
function hmacSha256(key, data) {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest()
}

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex')
}

async function awsStsGetCallerIdentity({ accessKeyId, secretAccessKey, region, sessionToken }) {
  const service = 'sts'
  const host = `sts.amazonaws.com`
  const endpoint = `https://${host}/`
  const method = 'POST'
  const body = 'Action=GetCallerIdentity&Version=2011-06-15'
  const contentType = 'application/x-www-form-urlencoded'

  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z'
  const dateStamp = amzDate.slice(0, 8)

  const canonicalUri = '/'
  const canonicalQs = ''
  const payloadHash = sha256Hex(body)

  const headersToSign = {
    'content-type': contentType,
    host,
    'x-amz-date': amzDate,
    ...(sessionToken ? { 'x-amz-security-token': sessionToken } : {}),
  }
  const sortedHeaderKeys = Object.keys(headersToSign).sort()
  const canonicalHeaders = sortedHeaderKeys.map(k => `${k}:${headersToSign[k]}\n`).join('')
  const signedHeaders = sortedHeaderKeys.join(';')

  const canonicalReq = [method, canonicalUri, canonicalQs, canonicalHeaders, signedHeaders, payloadHash].join('\n')
  const credScope = `${dateStamp}/${region}/${service}/aws4_request`
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credScope, sha256Hex(canonicalReq)].join('\n')

  const kDate    = hmacSha256(Buffer.from(`AWS4${secretAccessKey}`, 'utf8'), dateStamp)
  const kRegion  = hmacSha256(kDate, region)
  const kService = hmacSha256(kRegion, service)
  const kSign    = hmacSha256(kService, 'aws4_request')
  const signature = crypto.createHmac('sha256', kSign).update(stringToSign).digest('hex')

  const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const response = await fetch(endpoint, {
      method,
      headers: {
        'Content-Type': contentType,
        'X-Amz-Date': amzDate,
        Authorization: authHeader,
        ...(sessionToken ? { 'X-Amz-Security-Token': sessionToken } : {}),
      },
      body,
      signal: controller.signal,
    })

    const text = await response.text().catch(() => '')
    if (!response.ok) {
      const errMatch = text.match(/<Message>(.*?)<\/Message>/)
      const codeMatch = text.match(/<Code>(.*?)<\/Code>/)
      return {
        ok: false,
        error: errMatch?.[1] || codeMatch?.[1] || `HTTP ${response.status}`,
        awsCode: codeMatch?.[1],
      }
    }

    const accountMatch = text.match(/<Account>(.*?)<\/Account>/)
    const arnMatch     = text.match(/<Arn>(.*?)<\/Arn>/)
    const userIdMatch  = text.match(/<UserId>(.*?)<\/UserId>/)
    return {
      ok: true,
      account: accountMatch?.[1] || '',
      arn: arnMatch?.[1] || '',
      userId: userIdMatch?.[1] || '',
      message: `Verified: Account ${accountMatch?.[1] || 'unknown'}`,
    }
  } catch (err) {
    return {
      ok: false,
      error: err.name === 'AbortError' ? 'AWS STS request timed out.' : err.message,
    }
  } finally {
    clearTimeout(timeout)
  }
}

function toIntegrationResponse(row) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    mcpServerId: row.mcpServerId,
    enabled: row.enabled,
    status: row.status,
    lastTestedAt: row.lastTestedAt,
    lastError: row.lastError,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    server: row.McpServer ?? undefined,
    configStored: Boolean(row.config),
    config: unsealIntegrationConfig(row.config),
  }
}

async function testIntegrationConfig(server, config) {
  if (!/elastic/i.test(server.name)) {
    return {
      ok: true,
      message: 'No active connection test is implemented for this integration yet.',
      skipped: true,
    }
  }

  const ES_URL = String(config?.ES_URL || '').replace(/\/$/, '')
  const ES_API_KEY = String(config?.ES_API_KEY || '')
  const ES_USERNAME = String(config?.ES_USERNAME || '')
  const ES_PASSWORD = String(config?.ES_PASSWORD || '')
  const tlsMode = String(config?.tlsMode || 'default')

  if (!ES_URL) return { ok: false, error: 'Elasticsearch URL is required.' }
  if (!ES_API_KEY && !(ES_USERNAME && ES_PASSWORD)) {
    return { ok: false, error: 'Use either API Key or Username + Password.' }
  }
  if (ES_API_KEY && (ES_USERNAME || ES_PASSWORD)) {
    return { ok: false, error: 'Choose one authentication method, not both.' }
  }

  const headers = { Accept: 'application/json' }
  if (ES_API_KEY) {
    headers.Authorization = `ApiKey ${ES_API_KEY}`
  } else {
    headers.Authorization = `Basic ${Buffer.from(`${ES_USERNAME}:${ES_PASSWORD}`).toString('base64')}`
  }

  const agent = ES_URL.startsWith('https://') && tlsMode === 'skip'
    ? new https.Agent({ rejectUnauthorized: false })
    : undefined

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const response = await fetch(`${ES_URL}/_cluster/health`, {
      method: 'GET',
      headers,
      agent,
      signal: controller.signal,
    })
    const text = await response.text().catch(() => '')
    let body = null
    try { body = text ? JSON.parse(text) : null } catch { /* ignore */ }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: body?.error?.reason || body?.error?.type || text.slice(0, 200) || `HTTP ${response.status}`,
      }
    }

    return {
      ok: true,
      status: response.status,
      clusterName: body?.cluster_name,
      clusterStatus: body?.status,
      numberOfNodes: body?.number_of_nodes,
      message: `Connected${body?.cluster_name ? ` to ${body.cluster_name}` : ''}${body?.status ? ` (${body.status})` : ''}.`,
    }
  } catch (err) {
    return {
      ok: false,
      error: err.name === 'AbortError' ? 'Connection test timed out.' : err.message,
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function getRunnableDefaultHost(tenantId) {
  const host = await prisma.tenantMcpHost.findUnique({
    where: { tenantId_name: { tenantId, name: 'default' } },
  })
  if (!host) return null
  if (!['REGISTERED', 'RUNNING'].includes(host.status)) return null
  return host
}

function mcpUrl(baseUrl) {
  const trimmed = baseUrl.replace(/\/$/, '')
  return trimmed.endsWith('/mcp') ? trimmed : `${trimmed}/mcp`
}

function forwardMcpResponse(upstream, res) {
  const sessionId = upstream.headers.get('mcp-session-id')
  if (sessionId) res.setHeader('mcp-session-id', sessionId)

  for (const header of ['content-type', 'cache-control', 'connection']) {
    const value = upstream.headers.get(header)
    if (value) res.setHeader(header, value)
  }

  res.status(upstream.status)
  upstream.body.pipe(res)
}


// ─────────────────────────────────────────────────────────────────────────────
// 自定义 MCP —— 用户自建的 MCP 连接，与市场连接器走同一条下发链路。
// 收敛到这里之后，Hub 成为 MCP 配置的唯一事实源，避免「锤子页直写 mcp-host」
// 与「组织连接下发」两个写入方互相覆盖。
// ─────────────────────────────────────────────────────────────────────────────

// 自定义 MCP 只允许 HTTP 类连接方式。
// stdio 需要可执行文件存在于 mcp-host 容器内 —— 用户自填的命令在容器里根本不存在，
// 因此新建表单不提供该选项；只有「导入存量配置」时为兼容旧数据才放行。
const CREATE_TRANSPORTS = new Set(['streamable', 'sse', 'websocket'])
const IMPORT_TRANSPORTS = new Set(['streamable', 'sse', 'websocket', 'stdio'])

// 认证方式：与连接器表单一致，用预设选项而不是让用户手拼 header
const AUTH_TYPES = new Set(['none', 'bearer', 'header', 'basic'])

function buildAuthHeaders(auth) {
  const type = String(auth?.type || 'none')
  if (!AUTH_TYPES.has(type)) return { error: `不支持的认证方式: ${type}` }
  if (type === 'none') return { headers: {}, authType: 'none' }

  if (type === 'bearer') {
    const token = String(auth?.token || '').trim()
    if (!token) return { error: '请填写访问令牌' }
    return { headers: { Authorization: `Bearer ${token}` }, authType: 'bearer' }
  }
  if (type === 'header') {
    const name = String(auth?.headerName || '').trim()
    const value = String(auth?.headerValue || '').trim()
    if (!name) return { error: '请填写请求头名称' }
    if (!value) return { error: '请填写请求头的值' }
    return { headers: { [name]: value }, authType: 'header' }
  }
  // basic
  const username = String(auth?.username || '').trim()
  const password = String(auth?.password || '')
  if (!username) return { error: '请填写用户名' }
  if (!password) return { error: '请填写密码' }
  const encoded = Buffer.from(`${username}:${password}`).toString('base64')
  return { headers: { Authorization: `Basic ${encoded}` }, authType: 'basic' }
}

function normalizeCustomPayload(body, { allowStdio = false } = {}) {
  const name = String(body?.name || '').trim()
  if (!name) return { error: '名称不能为空' }
  if (name.length > 100) return { error: '名称过长' }

  const transport = String(body?.transport || 'streamable')
  const allowed = allowStdio ? IMPORT_TRANSPORTS : CREATE_TRANSPORTS
  if (!allowed.has(transport)) {
    return {
      error: transport === 'stdio'
        ? 'stdio 方式的 MCP 需要可执行文件预装在服务端，无法通过本页面添加；请改用 streamable / SSE 地址接入'
        : `不支持的连接方式: ${transport}`,
    }
  }

  const data = {
    name,
    transport,
    enabled: body?.enabled !== false,
    url: null, headers: null, authType: null, command: null, args: null, env: null,
  }

  if (transport === 'stdio') {
    // 仅导入路径可达
    const command = String(body?.command || '').trim()
    if (!command) return { error: 'stdio 方式必须填写启动命令' }
    data.command = command
    data.args = Array.isArray(body?.args) ? body.args.map(String) : []
    data.env = sealIntegrationConfig(
      body?.env && typeof body.env === 'object' && !Array.isArray(body.env) ? body.env : {},
    )
    return { data }
  }

  const url = String(body?.url || '').trim()
  if (!url) return { error: '该连接方式必须填写 URL' }
  if (!/^https?:\/\//i.test(url)) return { error: 'URL 必须以 http:// 或 https:// 开头' }
  data.url = url

  // 认证：优先使用结构化的 auth 描述；导入旧数据时兼容直接给出的 headers
  let finalHeaders = {}
  if (body?.auth) {
    const built = buildAuthHeaders(body.auth)
    if (built.error) return { error: built.error }
    finalHeaders = built.headers
    data.authType = built.authType
  } else if (body?.headers && typeof body.headers === 'object' && !Array.isArray(body.headers)) {
    finalHeaders = body.headers
    data.authType = Object.keys(finalHeaders).length ? 'header' : 'none'
  } else {
    data.authType = 'none'
  }

  // 令牌/密码属于凭据，与连接器配置一样做信封加密后落库
  data.headers = sealIntegrationConfig(finalHeaders)
  return { data }
}

// 返回给前端前抹掉凭据明文
function redactCustom(row) {
  const { headers, env, ...rest } = row
  return {
    ...rest,
    hasCredentials: Boolean(headers || env),
    headers: undefined,
    env: undefined,
  }
}

// GET /api/v1/tenant-mcp/custom
router.get('/custom', authenticateToken, async (req, res) => {
  try {
    const tenantId = resolveTenantId(req)
    const rows = await prisma.tenantCustomMcp.findMany({
      where: { tenantId },
      orderBy: [{ updatedAt: 'desc' }],
    })
    res.json(createResponse({ tenantId, items: rows.map(redactCustom) }))
  } catch (error) {
    logger.error('[TenantMCP] Failed to list custom MCP:', error)
    res.status(500).json(createResponse(null, 'Failed to list custom MCP servers'))
  }
})

// POST /api/v1/tenant-mcp/custom
router.post('/custom', authenticateToken, async (req, res) => {
  try {
    const tenantId = resolveTenantId(req)
    const { data, error } = normalizeCustomPayload(req.body)
    if (error) return res.status(400).json(createResponse(null, error))

    const exists = await prisma.tenantCustomMcp.findUnique({
      where: { tenantId_name: { tenantId, name: data.name } },
    })
    if (exists) return res.status(409).json(createResponse(null, '同名的自定义 MCP 已存在'))

    const created = await prisma.tenantCustomMcp.create({
      data: { ...data, tenantId, ownerUserId: req.user.id, source: 'manual' },
    })

    const sync = await syncUserMcpConfig({ userId: req.user.id, userJwt: extractJwt(req) })
    res.json(createResponse({ item: redactCustom(created), sync }))
  } catch (error) {
    logger.error('[TenantMCP] Failed to create custom MCP:', error)
    res.status(500).json(createResponse(null, 'Failed to create custom MCP server'))
  }
})

// PUT /api/v1/tenant-mcp/custom/:id
router.put('/custom/:id', authenticateToken, async (req, res) => {
  try {
    const tenantId = resolveTenantId(req)
    const { id } = req.params
    const existing = await prisma.tenantCustomMcp.findFirst({ where: { id, tenantId } })
    if (!existing) return res.status(404).json(createResponse(null, '自定义 MCP 不存在'))

    // 只切换启用状态
    if (Object.keys(req.body || {}).length === 1 && typeof req.body.enabled === 'boolean') {
      const updated = await prisma.tenantCustomMcp.update({
        where: { id }, data: { enabled: req.body.enabled },
      })
      const sync = await syncUserMcpConfig({ userId: req.user.id, userJwt: extractJwt(req) })
      return res.json(createResponse({ item: redactCustom(updated), sync }))
    }

    const { data, error } = normalizeCustomPayload(req.body)
    if (error) return res.status(400).json(createResponse(null, error))

    if (data.name !== existing.name) {
      const dup = await prisma.tenantCustomMcp.findUnique({
        where: { tenantId_name: { tenantId, name: data.name } },
      })
      if (dup) return res.status(409).json(createResponse(null, '同名的自定义 MCP 已存在'))
    }

    const updated = await prisma.tenantCustomMcp.update({ where: { id }, data })
    const sync = await syncUserMcpConfig({ userId: req.user.id, userJwt: extractJwt(req) })
    res.json(createResponse({ item: redactCustom(updated), sync }))
  } catch (error) {
    logger.error('[TenantMCP] Failed to update custom MCP:', error)
    res.status(500).json(createResponse(null, 'Failed to update custom MCP server'))
  }
})

// DELETE /api/v1/tenant-mcp/custom/:id
router.delete('/custom/:id', authenticateToken, async (req, res) => {
  try {
    const tenantId = resolveTenantId(req)
    const { id } = req.params
    const existing = await prisma.tenantCustomMcp.findFirst({ where: { id, tenantId } })
    if (!existing) return res.status(404).json(createResponse(null, '自定义 MCP 不存在'))

    await prisma.tenantCustomMcp.delete({ where: { id } })
    // 显式告知本次删除的名字：该行已不在库里，合并逻辑无法自行判定它曾被 Hub 接管
    const sync = await syncUserMcpConfig({
      userId: req.user.id, userJwt: extractJwt(req), removeNames: [existing.name],
    })
    res.json(createResponse({ removed: existing.name, sync }))
  } catch (error) {
    logger.error('[TenantMCP] Failed to delete custom MCP:', error)
    res.status(500).json(createResponse(null, 'Failed to delete custom MCP server'))
  }
})

// GET /api/v1/tenant-mcp/custom/importable
// 列出 mcp-host 里已存在、但 Hub 尚未收录的 MCP（= 用户此前在「锤子」页直接添加的）
router.get('/custom/importable', authenticateToken, async (req, res) => {
  try {
    const tenantId = resolveTenantId(req)
    const candidates = await collectImportableServers(tenantId, req.user.id)
    res.json(createResponse({ items: candidates }))
  } catch (error) {
    logger.error('[TenantMCP] Failed to list importable MCP:', error)
    res.status(500).json(createResponse(null, error.message || 'Failed to read existing MCP config'))
  }
})

// POST /api/v1/tenant-mcp/custom/import   body: { names?: string[] }
// 把上述条目收录进 Hub。不删除 mcp-host 上的任何东西，纯登记。
router.post('/custom/import', authenticateToken, async (req, res) => {
  try {
    const tenantId = resolveTenantId(req)
    const wanted = Array.isArray(req.body?.names) ? new Set(req.body.names) : null
    const candidates = await collectImportableServers(tenantId, req.user.id)

    const imported = []
    for (const c of candidates) {
      if (wanted && !wanted.has(c.name)) continue
      const { data, error } = normalizeCustomPayload(c, { allowStdio: true })
      if (error) { logger.warn(`[TenantMCP] 跳过导入 ${c.name}: ${error}`); continue }
      await prisma.tenantCustomMcp.create({
        data: { ...data, tenantId, ownerUserId: req.user.id, source: 'imported' },
      })
      imported.push(c.name)
    }

    const sync = await syncUserMcpConfig({ userId: req.user.id, userJwt: extractJwt(req) })
    res.json(createResponse({ imported, count: imported.length, sync }))
  } catch (error) {
    logger.error('[TenantMCP] Failed to import custom MCP:', error)
    res.status(500).json(createResponse(null, error.message || 'Failed to import MCP servers'))
  }
})

async function collectImportableServers(tenantId, userId) {
  const baseUrl = (process.env.MCP_HOST_URL || '').replace(/\/$/, '')
  const token = process.env.MCP_HOST_INTERNAL_TOKEN || ''
  if (!baseUrl || !token) throw new Error('MCP Host 未配置')

  const upstream = await fetch(`${baseUrl}/api/config/mcpserver`, {
    method: 'GET',
    headers: { 'X-Auth-Token': token, 'X-Project-ID': String(userId) },
  })
  if (!upstream.ok) throw new Error(`读取 MCP Host 配置失败 HTTP ${upstream.status}`)

  const body = await upstream.json().catch(() => null)
  const existing = body?.config?.mcpServers || {}

  const [marketNames, customNames] = await Promise.all([
    prisma.mcpServer.findMany({ select: { name: true } }).then(r => new Set(r.map(x => x.name))),
    prisma.tenantCustomMcp.findMany({ where: { tenantId }, select: { name: true } })
      .then(r => new Set(r.map(x => x.name))),
  ])

  const out = []
  for (const [name, entry] of Object.entries(existing)) {
    if (marketNames.has(name) || customNames.has(name)) continue
    out.push({
      name,
      transport: entry.transport || (entry.command ? 'stdio' : 'streamable'),
      url: entry.url || null,
      headers: entry.headers || {},
      command: entry.command || null,
      args: entry.args || [],
      env: entry.env || {},
      enabled: entry.enabled !== false,
    })
  }
  return out
}

export default router
