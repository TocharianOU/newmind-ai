import { z } from 'zod'

export const SyncPushSchema = z.object({
  project_id: z.string().optional(),
  chats:      z.array(z.object({
    id:         z.string().min(1),
    title:      z.string().min(1),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
    starred_at: z.string().nullable().optional(),
  })),
  messages: z.array(z.object({
    message_id: z.string().min(1),
    chat_id:    z.string().min(1),
    content:    z.string(),
    role:       z.string().min(1),
    created_at: z.string().optional(),
    files:      z.string().optional(),
    tool_calls: z.any().nullable().optional(),
  })),
})

export const SyncPullQuerySchema = z.object({
  project_id: z.string().optional(),
  since:      z.string().optional().refine(v => !v || !isNaN(Date.parse(v)), 'Invalid since date'),
})
