import { z } from 'zod'

export const CreateTokenCheckoutSchema = z.object({
  packageId: z.string().min(1, 'Package ID is required'),
})

export const CreateSubscriptionCheckoutSchema = z.object({
  planId: z.string().min(1, 'Plan ID is required'),
  period: z.enum(['monthly', 'yearly'], { required_error: 'Period is required' }),
})
