import { z } from 'zod'

export const UpdateSettingsSchema = z.object({
  username: z.string().min(1).max(50).optional(),
  picture:  z.string().url('Invalid URL').nullable().optional(),
  team:     z.string().max(100).nullable().optional(),
})

export const UpdatePreferencesSchema = z.object({
  theme:              z.enum(['light', 'dark']).optional(),
  language:           z.string().max(10).optional(),
  notifications:      z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
})
