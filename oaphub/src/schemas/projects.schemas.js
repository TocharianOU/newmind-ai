import { z } from 'zod'

export const CreateProjectSchema = z.object({
  id:                      z.string().regex(/^[a-zA-Z0-9._-]{1,128}$/).optional(),
  name:                    z.string().min(1, 'Project name is required').max(100, 'Name too long').trim(),
  description:             z.string().max(500, 'Description too long').optional(),
  isDefault:               z.boolean().optional(),
  inheritOrgIntegrations:  z.boolean().optional(),
})

export const UpdateProjectSchema = z.object({
  name:        z.string().min(1).max(100).trim().optional(),
  description: z.string().max(500).nullable().optional(),
})
