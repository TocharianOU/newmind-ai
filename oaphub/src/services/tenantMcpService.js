import crypto from 'crypto'
import { prisma } from '../config/database.js'
import logger from '../utils/logger.js'

const ENCRYPTION_KEYS = [
  process.env.INTEGRATION_CONFIG_ENCRYPTION_KEY,
  process.env.JWT_SECRET,
].filter(Boolean)
// 加密密钥：优先用专用密钥；未配置时回落到 JWT_SECRET（部署里必定存在）。
// 解密侧本来就会依次尝试这两个密钥，因此加解密始终对称；
// 若二者都没有才退化为明文存储（并打警告）。
const ENCRYPTION_KEY = process.env.INTEGRATION_CONFIG_ENCRYPTION_KEY || process.env.JWT_SECRET || ''

export function resolveTenantId(req) {
  // First phase: tenant maps to the authenticated account. When an Organization
  // model lands, this function becomes the single switch point.
  return req.user?.tenantId || req.user?.organizationId || req.user?.id
}

export function redactIntegrationConfig(config) {
  if (!config || typeof config !== 'object') return null
  const redacted = {}
  for (const key of Object.keys(config)) {
    redacted[key] = isSecretKey(key) ? '[redacted]' : config[key]
  }
  return redacted
}

export function sealIntegrationConfig(config) {
  if (!config || Object.keys(config).length === 0) return null

  if (!ENCRYPTION_KEY) {
    logger.warn('[TenantMCP] 未配置 INTEGRATION_CONFIG_ENCRYPTION_KEY 与 JWT_SECRET，凭据将以明文存储')
    return { encrypted: false, value: config }
  }

  const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(config), 'utf8'),
    cipher.final(),
  ])

  return {
    encrypted: true,
    algorithm: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  }
}

export function unsealIntegrationConfig(payload) {
  if (!payload || typeof payload !== 'object') return null
  if (payload.encrypted === false) return payload.value || null
  if (payload.encrypted !== true) return payload

  if (!ENCRYPTION_KEY) {
    logger.warn('[TenantMCP] INTEGRATION_CONFIG_ENCRYPTION_KEY not set; cannot decrypt integration config')
    return null
  }

  try {
    for (const secret of ENCRYPTION_KEYS) {
      try {
        const key = crypto.createHash('sha256').update(secret).digest()
        const decipher = crypto.createDecipheriv(
          'aes-256-gcm',
          key,
          Buffer.from(payload.iv, 'base64'),
        )
        decipher.setAuthTag(Buffer.from(payload.tag, 'base64'))
        const plaintext = Buffer.concat([
          decipher.update(Buffer.from(payload.ciphertext, 'base64')),
          decipher.final(),
        ])
        return JSON.parse(plaintext.toString('utf8'))
      } catch {
        // Try the next configured key. This preserves configs saved with the
        // Docker fallback if a dedicated key is added later.
      }
    }
    throw new Error('no configured key could decrypt payload')
  } catch (err) {
    logger.warn('[TenantMCP] Failed to decrypt integration config:', err.message)
    return null
  }
}

export async function listTenantHosts(tenantId) {
  return prisma.tenantMcpHost.findMany({
    where: { tenantId },
    orderBy: [{ name: 'asc' }],
  })
}

export async function upsertTenantHost({ tenantId, ownerUserId, name = 'default', baseUrl, status = 'REGISTERED', deployment = 'docker', metadata = null }) {
  return prisma.tenantMcpHost.upsert({
    where: { tenantId_name: { tenantId, name } },
    update: {
      baseUrl,
      status,
      deployment,
      metadata,
      lastSeenAt: status === 'RUNNING' ? new Date() : undefined,
    },
    create: {
      tenantId,
      ownerUserId,
      name,
      baseUrl,
      status,
      deployment,
      metadata,
      lastSeenAt: status === 'RUNNING' ? new Date() : null,
    },
  })
}

export async function getDefaultTenantHost(tenantId) {
  return prisma.tenantMcpHost.findUnique({
    where: { tenantId_name: { tenantId, name: 'default' } },
  })
}

export async function listTenantIntegrations(tenantId) {
  return prisma.tenantIntegration.findMany({
    where: { tenantId },
    include: {
      McpServer: {
        select: {
          id: true,
          name: true,
          description: true,
          transport: true,
          planRequired: true,
          logo: true,
          toolTier: true,
          unitPriceUsd: true,
        },
      },
    },
    orderBy: [{ updatedAt: 'desc' }],
  })
}

export async function enableTenantIntegration({ tenantId, ownerUserId, mcpServerId, config = null }) {
  const shouldUpdateConfig = config !== undefined
  const sealedConfig = shouldUpdateConfig ? sealIntegrationConfig(config) : undefined

  return prisma.tenantIntegration.upsert({
    where: { tenantId_mcpServerId: { tenantId, mcpServerId } },
    update: {
      enabled: true,
      ...(shouldUpdateConfig && { config: sealedConfig }),
      status: 'ENABLED',
      lastError: null,
    },
    create: {
      tenantId,
      ownerUserId,
      mcpServerId,
      enabled: true,
      config: shouldUpdateConfig ? sealedConfig : null,
      status: 'ENABLED',
    },
  })
}

export async function disableTenantIntegration({ tenantId, mcpServerId }) {
  return prisma.tenantIntegration.update({
    where: { tenantId_mcpServerId: { tenantId, mcpServerId } },
    data: {
      enabled: false,
      status: 'DISABLED',
    },
  })
}

export async function getTenantIntegrationState(tenantId) {
  const [host, integrations] = await Promise.all([
    getDefaultTenantHost(tenantId),
    prisma.tenantIntegration.findMany({
      where: { tenantId },
      select: {
        mcpServerId: true,
        enabled: true,
        status: true,
        updatedAt: true,
        lastTestedAt: true,
        lastError: true,
        config: true,
      },
    }),
  ])

  const integrationByServerId = new Map(integrations.map(row => [row.mcpServerId, row]))
  return { host, integrationByServerId }
}

function isSecretKey(key) {
  return /key|secret|token|password|credential|private/i.test(key)
}
