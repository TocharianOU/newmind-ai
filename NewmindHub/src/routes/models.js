import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { createResponse, PLAN_LIMITS, MODEL_CONFIG } from '../config/constants.js';
import logger from '../utils/logger.js';

const router = express.Router();

// GET /api/v1/models - Model discovery endpoint (Critical for Dive!)
router.get('/models', authenticateToken, async (req, res) => {
  try {
    const userPlan = req.user.planName || 'BASE';
    
    logger.info(`🔍 [Models] User ${req.user.email} (${userPlan}) requesting models`);
    
    // Build models list based on user plan and configuration
    const models = [];
    
    for (const [modelId, config] of Object.entries(MODEL_CONFIG)) {
      // Check if user's plan has access to this model
      if (config.plans.includes(userPlan)) {
        models.push({
          id: config.id,
          object: config.object,
          created: Math.floor(Date.now() / 1000),
          owned_by: config.owned_by,
          provider: config.provider,  // Critical: tells Dive which provider to use
          endpoint: config.endpoint,  // Critical: tells Dive which endpoint to call
          permission: [],
          root: config.id,
          parent: null,
          metadata: config.metadata
        });
      }
    }
    
    logger.info(`✅ [Models] Returning ${models.length} models for ${userPlan} user`);
    
    // Return in OpenAI-compatible format
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
