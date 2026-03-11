/**
 * Admin-only CRUD for custom external model providers.
 * Mounted at /api/v1/admin/custom-models
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { prisma } from '../config/database.js';
import { createResponse } from '../config/constants.js';
import logger from '../utils/logger.js';

const router = express.Router();

// GET /api/v1/admin/custom-models
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const models = await prisma.customModel.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(createResponse(models));
  } catch (err) {
    logger.error('[CustomModels] list error:', err);
    res.status(500).json(createResponse(null, 'Failed to fetch custom models'));
  }
});

// POST /api/v1/admin/custom-models
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, modelId, provider = 'openai_compatible', baseURL, apiKey = '', notes, active = true } = req.body;

    if (!name || !modelId || !baseURL) {
      return res.status(400).json(createResponse(null, 'name, modelId and baseURL are required'));
    }

    const existing = await prisma.customModel.findUnique({ where: { modelId } });
    if (existing) {
      return res.status(409).json(createResponse(null, `Model ID "${modelId}" already exists`));
    }

    const model = await prisma.customModel.create({
      data: {
        name,
        modelId,
        provider,
        baseURL: baseURL.replace(/\/$/, ''), // strip trailing slash
        apiKey,
        notes,
        active,
        createdBy: req.user.id,
      },
    });

    logger.info(`[CustomModels] Created model ${modelId} by ${req.user.email}`);
    res.status(201).json(createResponse(model));
  } catch (err) {
    logger.error('[CustomModels] create error:', err);
    res.status(500).json(createResponse(null, 'Failed to create custom model'));
  }
});

// PUT /api/v1/admin/custom-models/:id
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, modelId, provider, baseURL, apiKey, notes, active } = req.body;
    const { id } = req.params;

    const existing = await prisma.customModel.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json(createResponse(null, 'Custom model not found'));
    }

    // If modelId changed, check for conflict
    if (modelId && modelId !== existing.modelId) {
      const conflict = await prisma.customModel.findUnique({ where: { modelId } });
      if (conflict) {
        return res.status(409).json(createResponse(null, `Model ID "${modelId}" already exists`));
      }
    }

    const updated = await prisma.customModel.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(modelId !== undefined && { modelId }),
        ...(provider !== undefined && { provider }),
        ...(baseURL !== undefined && { baseURL: baseURL.replace(/\/$/, '') }),
        ...(apiKey !== undefined && { apiKey }),
        ...(notes !== undefined && { notes }),
        ...(active !== undefined && { active }),
      },
    });

    logger.info(`[CustomModels] Updated model ${updated.modelId} by ${req.user.email}`);
    res.json(createResponse(updated));
  } catch (err) {
    logger.error('[CustomModels] update error:', err);
    res.status(500).json(createResponse(null, 'Failed to update custom model'));
  }
});

// DELETE /api/v1/admin/custom-models/:id
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.customModel.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json(createResponse(null, 'Custom model not found'));
    }

    await prisma.customModel.delete({ where: { id } });
    logger.info(`[CustomModels] Deleted model ${existing.modelId} by ${req.user.email}`);
    res.json(createResponse({ deleted: true }));
  } catch (err) {
    logger.error('[CustomModels] delete error:', err);
    res.status(500).json(createResponse(null, 'Failed to delete custom model'));
  }
});

export default router;
