/**
 * License API routes — enterprise mode only.
 * Mounted at /api/v1/license by server.js when LICENSE_ENABLED=true.
 */

import express from 'express';
import { prisma } from '../config/database.js';
import { createResponse } from '../config/constants.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { parseLicense, getLicenseStatus } from '../license/validator.js';
import { writeAudit, AUDIT_ACTIONS, RESOURCE_TYPES } from '../utils/auditLog.js';
import logger from '../utils/logger.js';

const router = express.Router();

// ---------------------------------------------------------------------------
// GET /api/v1/license/status — any authenticated user can check license status
// ---------------------------------------------------------------------------
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const { status, license, reason } = await getLicenseStatus();

    res.json(createResponse({
      status,
      reason,
      license: license ? {
        customerId:   license.customerId,
        customerName: license.customerName,
        maxSeats:     license.maxSeats,
        maxTokens:    Number(license.maxTokens),
        features:     license.features,
        issuedAt:     license.issuedAt,
        expiresAt:    license.expiresAt,
        activatedBy:  license.activatedBy,
        createdAt:    license.createdAt,
      } : null,
    }));
  } catch (err) {
    logger.error('[License] Status check error:', err);
    res.status(500).json(createResponse(null, 'Failed to retrieve license status'));
  }
});

// ---------------------------------------------------------------------------
// POST /api/v1/license/activate — admin only: upload and activate a license
// ---------------------------------------------------------------------------
router.post('/activate', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const raw = req.body;
    if (!raw || typeof raw !== 'object') {
      return res.status(400).json(createResponse(null, 'Request body must be a license JSON object'));
    }

    const { valid, reason, data } = parseLicense(raw);
    if (!valid) {
      return res.status(422).json(createResponse(null, `Invalid license: ${reason}`));
    }

    // Deactivate any existing licenses
    await prisma.license.updateMany({ where: { active: true }, data: { active: false } });

    // Store the new license
    const license = await prisma.license.upsert({
      where:  { customerId: data.customerId },
      update: {
        customerName: data.customerName,
        maxSeats:     data.maxSeats,
        maxTokens:    BigInt(data.maxTokens),
        features:     data.features,
        issuedAt:     new Date(data.issuedAt),
        expiresAt:    new Date(data.expiresAt),
        signature:    data.signature,
        active:       true,
        activatedBy:  req.user.id,
      },
      create: {
        customerId:   data.customerId,
        customerName: data.customerName,
        maxSeats:     data.maxSeats,
        maxTokens:    BigInt(data.maxTokens),
        features:     data.features,
        issuedAt:     new Date(data.issuedAt),
        expiresAt:    new Date(data.expiresAt),
        signature:    data.signature,
        active:       true,
        activatedBy:  req.user.id,
      },
    });

    await writeAudit(req, {
      userId:       req.user.id,
      action:       AUDIT_ACTIONS.LICENSE_ACTIVATED,
      resourceType: RESOURCE_TYPES.LICENSE,
      resourceId:   license.id,
      metadata:     { customerId: license.customerId, expiresAt: license.expiresAt },
    });

    logger.info(`[License] Activated license for customer: ${data.customerName} by user: ${req.user.id}`);

    res.json(createResponse({
      message:      'License activated successfully',
      customerId:   license.customerId,
      customerName: license.customerName,
      expiresAt:    license.expiresAt,
      maxSeats:     license.maxSeats,
      features:     license.features,
    }));
  } catch (err) {
    logger.error('[License] Activation error:', err);
    res.status(500).json(createResponse(null, 'Failed to activate license'));
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/v1/license — admin only: deactivate current license
// ---------------------------------------------------------------------------
router.delete('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const updated = await prisma.license.updateMany({
      where: { active: true },
      data:  { active: false },
    });

    if (updated.count === 0) {
      return res.status(404).json(createResponse(null, 'No active license to deactivate'));
    }

    await writeAudit(req, {
      userId:       req.user.id,
      action:       AUDIT_ACTIONS.LICENSE_DEACTIVATED,
      resourceType: RESOURCE_TYPES.LICENSE,
      resourceId:   'license',
      metadata:     { action: 'deactivate' },
    });

    logger.info(`[License] License deactivated by user: ${req.user.id}`);
    res.json(createResponse({ message: 'License deactivated' }));
  } catch (err) {
    logger.error('[License] Deactivation error:', err);
    res.status(500).json(createResponse(null, 'Failed to deactivate license'));
  }
});

export default router;
