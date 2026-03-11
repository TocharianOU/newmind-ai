/**
 * License validator — verifies ed25519 signatures and business rules.
 *
 * The private key is held only by the vendor (us).
 * The matching public key is set via LICENSE_PUBLIC_KEY env (PEM) or placed at
 * src/license/keys/public.pem.
 */

import crypto from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { prisma } from '../config/database.js';
import logger from '../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Attempt to load the public key once at module evaluation time
function loadPublicKey() {
  if (process.env.LICENSE_PUBLIC_KEY) {
    return process.env.LICENSE_PUBLIC_KEY.replace(/\\n/g, '\n');
  }
  const pemPath = join(__dirname, 'keys', 'public.pem');
  if (existsSync(pemPath)) {
    return readFileSync(pemPath, 'utf8');
  }
  return null;
}

const PUBLIC_KEY_PEM = loadPublicKey();

/**
 * Build the canonical payload string that was signed.
 * This must match exactly what keygen.js signs.
 */
function buildPayload(data) {
  return JSON.stringify({
    customerId:   data.customerId,
    customerName: data.customerName,
    maxSeats:     data.maxSeats,
    maxTokens:    data.maxTokens,
    features:     data.features,
    issuedAt:     data.issuedAt,
    expiresAt:    data.expiresAt,
  });
}

/**
 * Verify the ed25519 signature on a license payload.
 * @param {object} licenseData  — parsed license JSON (without signature field)
 * @param {string} signature    — base64 ed25519 signature
 * @returns {boolean}
 */
export function verifySignature(licenseData, signature) {
  try {
    if (!PUBLIC_KEY_PEM) {
      logger.warn('[License] No public key configured — skipping signature verification (dev/test mode only)');
      return true; // permissive when no key is configured; enforce in production by setting LICENSE_PUBLIC_KEY
    }

    const publicKey = crypto.createPublicKey(PUBLIC_KEY_PEM);
    const payload   = buildPayload(licenseData);
    const sigBuffer = Buffer.from(signature, 'base64');

    return crypto.verify(
      null,           // algorithm (null = use key default — ed25519)
      Buffer.from(payload),
      publicKey,
      sigBuffer,
    );
  } catch (err) {
    logger.error('[License] Signature verification error:', err.message);
    return false;
  }
}

/**
 * Parse and validate a raw license JSON object.
 * Returns { valid, reason, data }.
 */
export function parseLicense(raw) {
  const required = ['customerId', 'customerName', 'maxSeats', 'maxTokens', 'features', 'issuedAt', 'expiresAt', 'signature'];
  for (const field of required) {
    if (raw[field] === undefined) {
      return { valid: false, reason: `Missing required field: ${field}` };
    }
  }

  const expiresAt = new Date(raw.expiresAt);
  if (isNaN(expiresAt.getTime())) {
    return { valid: false, reason: 'Invalid expiresAt date' };
  }

  if (expiresAt < new Date()) {
    return { valid: false, reason: 'License has expired' };
  }

  const { signature, ...payload } = raw;
  if (!verifySignature(payload, signature)) {
    return { valid: false, reason: 'Invalid license signature' };
  }

  return { valid: true, reason: null, data: raw };
}

/**
 * Fetch the current active license from DB and compute its status.
 * @returns {{ status: string, license: object|null, reason: string|null }}
 */
export async function getLicenseStatus() {
  try {
    const license = await prisma.license.findFirst({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!license) {
      return { status: 'NOT_ACTIVATED', license: null, reason: 'No active license found' };
    }

    if (new Date(license.expiresAt) < new Date()) {
      return { status: 'EXPIRED', license, reason: 'License has expired' };
    }

    return { status: 'ACTIVE', license, reason: null };
  } catch (err) {
    logger.error('[License] getLicenseStatus error:', err);
    return { status: 'INVALID', license: null, reason: err.message };
  }
}

/**
 * Check if current seat count is within license limits.
 */
export async function checkSeatAvailable() {
  const { status, license } = await getLicenseStatus();
  if (status !== 'ACTIVE') return { allowed: false, reason: `License ${status}` };

  const userCount = await prisma.user.count();
  if (license.maxSeats > 0 && userCount >= license.maxSeats) {
    return { allowed: false, reason: `Seat limit reached (${userCount}/${license.maxSeats})` };
  }

  return { allowed: true, reason: null };
}
