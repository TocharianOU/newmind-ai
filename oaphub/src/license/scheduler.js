/**
 * License scheduler — periodically checks license validity and logs warnings.
 * Called from server.js when LICENSE_ENABLED is true.
 */

import { getLicenseStatus, autoActivateBundledLicense } from './validator.js';
import logger from '../utils/logger.js';

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6 hours

export async function startLicenseCheck() {
  // Auto-activate bundled license.json (Plan A) before first status check
  await autoActivateBundledLicense();
  checkAndLog(); // run immediately on startup
  setInterval(checkAndLog, CHECK_INTERVAL_MS);
}

async function checkAndLog() {
  const { status, license, reason } = await getLicenseStatus();

  if (status === 'NOT_ACTIVATED') {
    logger.warn('[License] ⚠️  No active license — only admin access is available.');
    return;
  }

  if (status === 'EXPIRED') {
    logger.error(`[License] ❌ License expired — contact support. Reason: ${reason}`);
    return;
  }

  if (status === 'ACTIVE' && license) {
    const daysLeft = Math.ceil(
      (new Date(license.expiresAt) - new Date()) / (1000 * 60 * 60 * 24)
    );

    if (daysLeft <= 30) {
      logger.warn(`[License] ⚠️  License expires in ${daysLeft} day(s) — please renew.`);
    } else {
      logger.info(`[License] ✅ Active — customer: ${license.customerName}, expires in ${daysLeft} days.`);
    }
  }
}
