import { createResponse } from '../config/constants.js'
import logger from '../utils/logger.js'

/**
 * Middleware that restricts access to users with role === 'ADMIN'.
 * Must be placed after `authenticateToken`.
 */
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'ADMIN') {
    logger.warn(`[RBAC] Admin access denied for user ${req.user?.email} (${req.user?.id})`)
    return res.status(403).json(createResponse(null, 'Access denied. Admin privileges required.'))
  }
  next()
}
