/**
 * License middleware — enforces license validity on protected enterprise routes.
 */

import { getLicenseStatus } from './validator.js';
import { createResponse } from '../config/constants.js';
import featureFlags from '../config/featureFlags.js';

/**
 * Require a valid active license to proceed.
 * Skips check if LICENSE_ENABLED is false (SaaS mode or dev).
 */
export async function requireLicense(req, res, next) {
  if (!featureFlags.LICENSE_ENABLED) return next();

  const { status, reason } = await getLicenseStatus();
  if (status !== 'ACTIVE') {
    return res.status(402).json(
      createResponse(null, `License required: ${reason}`)
    );
  }

  next();
}

/**
 * Attach license info to req.license for downstream handlers.
 * Non-blocking — continues even if no license is found.
 */
export async function attachLicense(req, _res, next) {
  if (!featureFlags.LICENSE_ENABLED) return next();

  try {
    const result = await getLicenseStatus();
    req.license = result;
  } catch {
    req.license = { status: 'INVALID', license: null };
  }

  next();
}
