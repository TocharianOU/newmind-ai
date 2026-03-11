import express from 'express'
import { prisma } from '../config/database.js'
import { authenticateToken } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/requireAdmin.js'
import logger from '../utils/logger.js'
import { writeAudit, AUDIT_ACTIONS, RESOURCE_TYPES } from '../utils/auditLog.js'
import { validateQuery, validateBody } from '../middleware/validate.js'
import { AuditQuerySchema, AuditExportSchema } from '../schemas/audit.schemas.js'
import featureFlags from '../config/featureFlags.js'

const router = express.Router()

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Escape a value for safe CSV embedding (RFC 4180 + formula injection guard). */
function csvEscape(value) {
  const str = value == null ? '' : String(value)
  // Prefix cells that start with formula trigger chars to neutralise injection
  const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str
  // Wrap in quotes if the value contains a comma, quote, or newline
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`
  }
  return safe
}

function parseDateParam(value) {
  if (!value) return undefined
  const d = new Date(value)
  if (isNaN(d.getTime())) return undefined
  return d
}

// ── Routes ───────────────────────────────────────────────────────────────────

router.get('/projects/:projectId', authenticateToken, validateQuery(AuditQuerySchema), async (req, res) => {
  try {
    const userId = req.user.id
    const { projectId } = req.params
    const {
      action,
      resourceType,
      limit = 100,
      offset = 0,
      startDate,
      endDate,
    } = req.query

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
    })

    if (!project) {
      return res.status(404).json({ error: 'Project not found' })
    }

    const where = { projectId }

    if (action)       where.action = action
    if (resourceType) where.resourceType = resourceType

    const startParsed = parseDateParam(startDate)
    const endParsed   = parseDateParam(endDate)
    if (startParsed || endParsed) {
      where.createdAt = {}
      if (startParsed) where.createdAt.gte = startParsed
      if (endParsed)   where.createdAt.lte = endParsed
    }

    const parsedLimit  = limit  ?? 100
    const parsedOffset = offset ?? 0

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          User: {
            select: { id: true, email: true, username: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: parsedOffset,
        take: parsedLimit,
      }),
      prisma.auditLog.count({ where }),
    ])

    res.json({
      logs,
      pagination: { total, offset: parsedOffset, limit: parsedLimit },
    })
  } catch (error) {
    logger.error('Failed to fetch audit logs:', error)
    res.status(500).json({ error: 'Failed to fetch audit logs' })
  }
})

router.post('/projects/:projectId/export', authenticateToken, validateBody(AuditExportSchema), async (req, res) => {
  if (!featureFlags.AUDIT_EXPORT_ENABLED) {
    return res.status(403).json({ error: 'Audit log export is disabled on this instance' })
  }

  try {
    const userId = req.user.id
    const { projectId } = req.params
    const { format = 'json', startDate, endDate } = req.body

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
    })

    if (!project) {
      return res.status(404).json({ error: 'Project not found' })
    }

    const where = { projectId }

    const startParsed = parseDateParam(startDate)
    const endParsed   = parseDateParam(endDate)
    if (startParsed || endParsed) {
      where.createdAt = {}
      if (startParsed) where.createdAt.gte = startParsed
      if (endParsed)   where.createdAt.lte = endParsed
    }

    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        User: {
          select: { email: true, username: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Write audit event before sending response (covers both CSV and JSON paths)
    await writeAudit(req, {
      userId,
      action: AUDIT_ACTIONS.AUDIT_EXPORT,
      resourceType: RESOURCE_TYPES.PROJECT,
      resourceId: projectId,
      projectId,
      metadata: { format, startDate, endDate, logCount: logs.length },
    })

    if (format === 'csv') {
      const headers = ['Timestamp', 'User', 'Action', 'Resource Type', 'Resource ID', 'IP Address']
      const rows = logs.map(log => [
        csvEscape(log.createdAt.toISOString()),
        csvEscape(log.User?.email ?? ''),
        csvEscape(log.action),
        csvEscape(log.resourceType),
        csvEscape(log.resourceId ?? ''),
        csvEscape(log.ipAddress ?? ''),
      ])

      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')

      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', `attachment; filename="audit-log-${projectId}-${Date.now()}.csv"`)
      return res.send(csv)
    }

    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="audit-log-${projectId}-${Date.now()}.json"`)
    res.json({ logs })

    logger.info(`Audit log exported for project ${projectId} by user ${userId}`)
  } catch (error) {
    logger.error('Failed to export audit logs:', error)
    res.status(500).json({ error: 'Failed to export audit logs' })
  }
})

// ── Admin: global audit log access ───────────────────────────────────────────
// These endpoints are restricted to ADMIN role and return logs across all users
// and projects, including auth-level events (projectId = null).

/**
 * GET /api/v1/audit/admin/logs
 * Query all audit logs regardless of project scope.
 * Supports the same filters as the per-project endpoint, plus:
 *   ?userId=  — filter by a specific user
 */
router.get('/admin/logs', authenticateToken, requireAdmin, validateQuery(AuditQuerySchema), async (req, res) => {
  try {
    const {
      action,
      resourceType,
      resourceId,
      userId,
      email,
      limit  = 100,
      offset = 0,
      startDate,
      endDate,
    } = req.query

    const where = {}

    // Multi-value action filter: "MODEL_CALL,TOOL_CALL" → { in: [...] }
    if (action) {
      const values = action.split(',').map(s => s.trim()).filter(Boolean)
      where.action = values.length === 1 ? values[0] : { in: values }
    }

    // Multi-value resourceType filter
    if (resourceType) {
      const values = resourceType.split(',').map(s => s.trim()).filter(Boolean)
      where.resourceType = values.length === 1 ? values[0] : { in: values }
    }

    if (resourceId) where.resourceId = resourceId

    // userId takes precedence over email; email does a case-insensitive partial match
    if (userId) {
      where.userId = userId
    } else if (email) {
      where.User = { email: { contains: email, mode: 'insensitive' } }
    }

    const startParsed = parseDateParam(startDate)
    const endParsed   = parseDateParam(endDate)
    if (startParsed || endParsed) {
      where.createdAt = {}
      if (startParsed) where.createdAt.gte = startParsed
      if (endParsed)   where.createdAt.lte = endParsed
    }

    const parsedLimit  = limit  ?? 100
    const parsedOffset = offset ?? 0

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          User: { select: { id: true, email: true, username: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: parsedOffset,
        take: parsedLimit,
      }),
      prisma.auditLog.count({ where }),
    ])

    res.json({ logs, pagination: { total, offset: parsedOffset, limit: parsedLimit } })
  } catch (error) {
    logger.error('Failed to fetch admin audit logs:', error)
    res.status(500).json({ error: 'Failed to fetch audit logs' })
  }
})

/**
 * POST /api/v1/audit/admin/export
 * Export all audit logs (global scope) as JSON or CSV.
 * Controlled by AUDIT_EXPORT_ENABLED feature flag.
 */
router.post('/admin/export', authenticateToken, requireAdmin, validateBody(AuditExportSchema), async (req, res) => {
  if (!featureFlags.AUDIT_EXPORT_ENABLED) {
    return res.status(403).json({ error: 'Audit log export is disabled on this instance' })
  }

  try {
    const userId = req.user.id
    const { format = 'json', startDate, endDate } = req.body

    const where = {}
    const startParsed = parseDateParam(startDate)
    const endParsed   = parseDateParam(endDate)
    if (startParsed || endParsed) {
      where.createdAt = {}
      if (startParsed) where.createdAt.gte = startParsed
      if (endParsed)   where.createdAt.lte = endParsed
    }

    const logs = await prisma.auditLog.findMany({
      where,
      include: { User: { select: { email: true, username: true } } },
      orderBy: { createdAt: 'desc' },
    })

    await writeAudit(req, {
      userId,
      action: AUDIT_ACTIONS.AUDIT_EXPORT,
      resourceType: RESOURCE_TYPES.ADMIN,
      metadata: { scope: 'global', format, startDate, endDate, logCount: logs.length },
    })

    if (format === 'csv') {
      const headers = ['Timestamp', 'User', 'Action', 'Resource Type', 'Resource ID', 'Project ID', 'IP Address']
      const rows = logs.map(log => [
        csvEscape(log.createdAt.toISOString()),
        csvEscape(log.User?.email ?? ''),
        csvEscape(log.action),
        csvEscape(log.resourceType),
        csvEscape(log.resourceId ?? ''),
        csvEscape(log.projectId ?? ''),
        csvEscape(log.ipAddress ?? ''),
      ])
      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', `attachment; filename="audit-global-${Date.now()}.csv"`)
      return res.send(csv)
    }

    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="audit-global-${Date.now()}.json"`)
    res.json({ logs })
  } catch (error) {
    logger.error('Failed to export admin audit logs:', error)
    res.status(500).json({ error: 'Failed to export audit logs' })
  }
})

export default router
