import rateLimit from 'express-rate-limit';
import { createResponse } from '../config/constants.js';

export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: createResponse(null, 'Too many requests, please try again later'),
  standardHeaders: true,
  legacyHeaders: false,
});
