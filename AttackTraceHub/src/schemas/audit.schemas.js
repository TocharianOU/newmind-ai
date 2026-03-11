import { z } from 'zod'

export const AuditQuerySchema = z.object({
  // Filter by one or more action types (comma-separated, e.g. "MODEL_CALL,TOOL_CALL")
  action:       z.string().optional(),
  // Filter by one or more resource types (comma-separated)
  resourceType: z.string().optional(),
  // Filter by specific resource ID
  resourceId:   z.string().optional(),
  // Filter by user ID (exact match)
  userId:       z.string().optional(),
  // Filter by user email (partial, case-insensitive — admin endpoint only)
  email:        z.string().optional(),
  // Pagination — admin UI may need larger pages; per-project endpoint keeps 100 cap
  limit:        z.coerce.number().int().min(1).max(500).optional(),
  offset:       z.coerce.number().int().min(0).optional(),
  startDate:    z.string().optional().refine(v => !v || !isNaN(Date.parse(v)), 'Invalid startDate'),
  endDate:      z.string().optional().refine(v => !v || !isNaN(Date.parse(v)), 'Invalid endDate'),
})

export const AuditExportSchema = z.object({
  format:    z.enum(['json', 'csv']).optional(),
  startDate: z.string().optional().refine(v => !v || !isNaN(Date.parse(v)), 'Invalid startDate'),
  endDate:   z.string().optional().refine(v => !v || !isNaN(Date.parse(v)), 'Invalid endDate'),
})
