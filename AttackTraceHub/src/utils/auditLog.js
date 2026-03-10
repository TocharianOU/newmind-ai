/**
 * Audit logging utility.
 *
 * Usage:
 *   import { writeAudit, AUDIT_ACTIONS, RESOURCE_TYPES } from '../utils/auditLog.js'
 *
 *   await writeAudit(req, {
 *     userId,
 *     action: AUDIT_ACTIONS.LOGIN_SUCCESS,
 *     resourceType: RESOURCE_TYPES.AUTH,
 *     metadata: { email }
 *   })
 *
 * Notes:
 *  - projectId is optional (auth-level events have no project context).
 *  - Never throws — audit failures are logged but never propagate to callers.
 *  - ipAddress is read from req (trusts X-Forwarded-For only when trust proxy is set).
 */

import { prisma } from '../config/database.js'
import logger from './logger.js'

// ── Action constants ────────────────────────────────────────────────────────

export const AUDIT_ACTIONS = {
  // Auth
  REGISTER:                  'REGISTER',
  LOGIN_SUCCESS:             'LOGIN_SUCCESS',
  LOGIN_FAILURE:             'LOGIN_FAILURE',
  LOGOUT:                    'LOGOUT',
  TOKEN_REFRESH:             'TOKEN_REFRESH',
  SSO_LOGIN_SUCCESS:         'SSO_LOGIN_SUCCESS',
  SSO_LOGIN_FAILURE:         'SSO_LOGIN_FAILURE',
  PASSWORD_RESET_REQUESTED:  'PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET_COMPLETED:  'PASSWORD_RESET_COMPLETED',

  // Projects
  PROJECT_CREATED:   'PROJECT_CREATED',
  PROJECT_UPDATED:   'PROJECT_UPDATED',
  PROJECT_DELETED:   'PROJECT_DELETED',

  // Sync
  SYNC_PUSH:         'SYNC_PUSH',
  SYNC_PULL:         'SYNC_PULL',

  // System prompt
  SYSTEM_PROMPT_SET:     'SYSTEM_PROMPT_SET',
  SYSTEM_PROMPT_CLEARED: 'SYSTEM_PROMPT_CLEARED',

  // Admin actions
  ADMIN_LIST_USERS:       'ADMIN_LIST_USERS',
  ADMIN_VIEW_USER_STATS:  'ADMIN_VIEW_USER_STATS',
  ADMIN_VIEW_STATS:       'ADMIN_VIEW_STATS',

  // Audit export
  AUDIT_EXPORT: 'AUDIT_EXPORT',

  // Data governance
  ACCOUNT_DELETED:  'ACCOUNT_DELETED',
  DATA_EXPORT:      'DATA_EXPORT',

  // Payment
  PAYMENT_CHECKOUT_CREATED:      'PAYMENT_CHECKOUT_CREATED',
  SUBSCRIPTION_CHECKOUT_CREATED: 'SUBSCRIPTION_CHECKOUT_CREATED',
}

export const RESOURCE_TYPES = {
  AUTH:          'AUTH',
  PROJECT:       'PROJECT',
  SYNC:          'SYNC',
  SYSTEM_PROMPT: 'SYSTEM_PROMPT',
  ADMIN:         'ADMIN',
  PAYMENT:       'PAYMENT',
  USER:          'USER',
}

// ── Core helper ─────────────────────────────────────────────────────────────

/**
 * @param {import('express').Request} req  - Express request (for IP + UA)
 * @param {{
 *   userId:       string,
 *   action:       string,
 *   resourceType: string,
 *   resourceId?:  string,
 *   projectId?:   string,
 *   metadata?:    object
 * }} payload
 */
export async function writeAudit(req, payload) {
  try {
    const { userId, action, resourceType, resourceId, projectId, metadata } = payload

    await prisma.auditLog.create({
      data: {
        userId,
        action,
        resourceType,
        resourceId:   resourceId  ?? null,
        projectId:    projectId   ?? null,
        metadata:     metadata    ?? null,
        ipAddress:    getClientIp(req),
        userAgent:    (req?.headers?.['user-agent'] ?? '').slice(0, 500) || null,
      },
    })
  } catch (err) {
    logger.error('[Audit] Failed to write audit log:', err)
  }
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function getClientIp(req) {
  if (!req) return null
  const forwarded = req.headers?.['x-forwarded-for']
  if (forwarded) {
    return String(forwarded).split(',')[0].trim().slice(0, 50)
  }
  return (req.ip ?? req.socket?.remoteAddress ?? '').slice(0, 50) || null
}
