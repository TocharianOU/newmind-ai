import rateLimit from 'express-rate-limit';
import { createResponse } from '../config/constants.js';

const rateLimitMessage = createResponse(null, 'Too many requests, please try again later');

/** Global fallback: 100 req / 15 min per IP */
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: rateLimitMessage,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Auth endpoints (login, register, refresh):
 * Stricter limit to slow brute-force and credential-stuffing attacks.
 * 15 requests / 15 min per IP.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: rateLimitMessage,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Payment endpoints:
 * Low limit to prevent checkout-session spam.
 * 20 requests / 15 min per IP.
 */
export const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: rateLimitMessage,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Sync endpoints (push / pull):
 * Moderate limit — a client that syncs every 5 minutes won't exceed this.
 * 30 requests / 15 min per IP.
 */
export const syncLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: rateLimitMessage,
  standardHeaders: true,
  legacyHeaders: false,
});
