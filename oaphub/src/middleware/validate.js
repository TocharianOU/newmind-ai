/**
 * Zod validation middleware factory.
 *
 * Usage:
 *   import { validateBody, validateQuery } from '../middleware/validate.js'
 *   import { LoginSchema } from '../schemas/auth.schemas.js'
 *
 *   router.post('/login', validateBody(LoginSchema), handler)
 */

import { ZodError } from 'zod'
import logger from '../utils/logger.js'

function formatZodError(error) {
  return error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')
}

/**
 * Validate req.body against a Zod schema.
 * Returns 400 with a clear message on failure.
 */
export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      const message = formatZodError(result.error)
      logger.warn(`[Validation] Body validation failed: ${message}`)
      return res.status(400).json({ success: false, error: message, data: null })
    }
    req.body = result.data
    next()
  }
}

/**
 * Validate req.query against a Zod schema.
 * Returns 400 with a clear message on failure.
 */
export function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query)
    if (!result.success) {
      const message = formatZodError(result.error)
      logger.warn(`[Validation] Query validation failed: ${message}`)
      return res.status(400).json({ success: false, error: message, data: null })
    }
    req.query = result.data
    next()
  }
}
