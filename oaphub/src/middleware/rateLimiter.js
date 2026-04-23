import rateLimit from 'express-rate-limit';
import { createResponse } from '../config/constants.js';

const rateLimitMessage = createResponse(null, 'Too many requests, please try again later');

/** Global fallback: 1000 req / 15 min per IP */
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: rateLimitMessage,
  standardHeaders: true,
  legacyHeaders: false,
});

/** Auth endpoints: relaxed for dev/local deployments — 500 req / 15 min per IP */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: rateLimitMessage,
  standardHeaders: true,
  legacyHeaders: false,
});

/** Payment read endpoints: 500 req / 15 min per IP */
export const paymentReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: rateLimitMessage,
  standardHeaders: true,
  legacyHeaders: false,
});

/** Payment write endpoints: 200 req / 15 min per IP */
export const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: rateLimitMessage,
  standardHeaders: true,
  legacyHeaders: false,
});

/** Sync endpoints: 200 req / 15 min per IP */
export const syncLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: rateLimitMessage,
  standardHeaders: true,
  legacyHeaders: false,
});
