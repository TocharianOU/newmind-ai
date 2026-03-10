import { z } from 'zod'

const isoDate = z.string().datetime({ offset: true }).optional()
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Must be a valid date').optional())

export const AuditQuerySchema = z.object({
  action:       z.string().optional(),
  resourceType: z.string().optional(),
  userId:       z.string().optional(),
  limit:        z.coerce.number().int().min(1).max(100).optional(),
  offset:       z.coerce.number().int().min(0).optional(),
  startDate:    z.string().optional().refine(v => !v || !isNaN(Date.parse(v)), 'Invalid startDate'),
  endDate:      z.string().optional().refine(v => !v || !isNaN(Date.parse(v)), 'Invalid endDate'),
})

export const AuditExportSchema = z.object({
  format:    z.enum(['json', 'csv']).optional(),
  startDate: z.string().optional().refine(v => !v || !isNaN(Date.parse(v)), 'Invalid startDate'),
  endDate:   z.string().optional().refine(v => !v || !isNaN(Date.parse(v)), 'Invalid endDate'),
})
