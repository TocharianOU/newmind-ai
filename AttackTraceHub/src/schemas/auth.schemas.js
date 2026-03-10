import { z } from 'zod'

export const RegisterSchema = z.object({
  email:      z.string().email('Invalid email address'),
  username:   z.string().min(1, 'Username is required').max(50, 'Username too long'),
  password:   z.string()
                .min(8, 'Password must be at least 8 characters')
                .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
                .regex(/[0-9]/,    'Password must contain at least one number'),
  inviteCode: z.string().optional(),
  encrypted:  z.any().optional(),
})

export const LoginSchema = z.object({
  email:     z.string().email('Invalid email address'),
  password:  z.string().min(1, 'Password is required'),
  encrypted: z.any().optional(),
})

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
})

export const ForgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
})

export const ResetPasswordSchema = z.object({
  token:    z.string().min(1, 'Reset token is required'),
  password: z.string()
               .min(8, 'Password must be at least 8 characters')
               .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
               .regex(/[0-9]/,    'Password must contain at least one number'),
})
