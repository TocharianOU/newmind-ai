import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { createResponse, PLAN_LIMITS, MODEL_CONFIG } from '../config/constants.js';
import { prisma } from '../config/database.js';
import featureFlags from '../config/featureFlags.js';
import logger from '../utils/logger.js';

const router = express.Router();

// GET /api/v1/models - Model discovery endpoint (Critical for Dive!)
router.get('/models', authenticateToken, async (req, res) => {
  try {
    const userPlan = req.user.planName || 'BASE';
    
    logger.info(`🔍 [Models] User ${req.user.email} (${userPlan}) requesting models`);
    
    const models = [];
    
    // Static models from constants
    for (const [modelId, config] of Object.entries(MODEL_CONFIG)) {
      if (config.plans.includes(userPlan)) {
        const publicMetadata = {
          managed: Boolean(config.metadata?.managed),
          native_format: Boolean(config.metadata?.native_format),
          native_client: config.metadata?.native_client || undefined,
          supports_tools: Boolean(config.metadata?.supports_tools),
          supports_streaming: Boolean(config.metadata?.supports_streaming),
        };

        models.push({
          id: config.id,
          object: config.object,
          created: Math.floor(Date.now() / 1000),
          owned_by: config.owned_by,
          provider: config.provider,
          endpoint: config.endpoint,
          permission: [],
          root: config.id,
          parent: null,
          metadata: publicMetadata
        });
      }
    }
    
    // Dynamic custom models (Enterprise: available to all active users; SaaS: admin-visible only)
    try {
      const customModels = await prisma.customModel.findMany({
        where: { active: true },
        orderBy: { createdAt: 'asc' },
      });

      for (const cm of customModels) {
        // Enterprise (license mode): all active users can see custom models
        // SaaS: only PRO plan users and admins can see custom models (BASE plan blocked)
        const planAllowsCustomModels = featureFlags.LICENSE_ENABLED
          || userPlan === 'PRO'
          || req.user.role === 'ADMIN';
        if (!planAllowsCustomModels) continue;

        models.push({
          id: cm.modelId,
          object: 'model',
          created: Math.floor(new Date(cm.createdAt).getTime() / 1000),
          owned_by: cm.provider,
          provider: cm.provider,
          endpoint: cm.provider === 'anthropic' ? '/messages' : '/chat/completions',
          permission: [],
          root: cm.modelId,
          parent: null,
          metadata: { custom: true, name: cm.name }
        });
      }
    } catch (dbErr) {
      // If CustomModel table doesn't exist yet (pre-migration), skip silently
      logger.warn('[Models] CustomModel query failed (migration pending?):', dbErr.message);
    }
    
    logger.info(`✅ [Models] Returning ${models.length} models for ${userPlan} user`);
    
    res.json({
      object: 'list',
      data: models
    });
    
  } catch (error) {
    logger.error('Error fetching models:', error);
    res.status(500).json(createResponse(null, 'Failed to fetch models'));
  }
});

export default router;
