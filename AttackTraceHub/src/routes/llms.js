import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { prisma } from '../config/database.js';
import { createResponse } from '../config/constants.js';
import logger from '../utils/logger.js';

const router = express.Router();

// GET /api/v1/llms - Get all LLM model descriptions
router.get('/llms', authenticateToken, async (req, res) => {
  try {
    const models = await prisma.modelDescription.findMany();
    
    const descriptions = models.map(model => ({
      id: model.id,
      model_id: model.modelId,
      name: model.name,
      icon: model.icon || '',
      provider: model.provider,
      token_cost: model.tokenCost,
      description: model.description || '',
      extra: model.extra || {
        feature: '',
        special: []
      }
    }));

    res.json(createResponse(descriptions));
  } catch (error) {
    logger.error('Error fetching LLM descriptions:', error);
    res.status(500).json(createResponse(null, 'Failed to fetch LLM descriptions'));
  }
});

// POST /api/v1/llms/query - Query specific model descriptions
router.post('/llms/query', authenticateToken, async (req, res) => {
  try {
    const { models } = req.body;
    
    if (!Array.isArray(models)) {
      return res.status(400).json(createResponse(null, 'Invalid request format'));
    }

    const descriptions = await prisma.modelDescription.findMany({
      where: {
        modelId: { in: models }
      }
    });

    const results = descriptions.map(model => ({
      id: model.id,
      model_id: model.modelId,
      name: model.name,
      icon: model.icon || '',
      provider: model.provider,
      token_cost: model.tokenCost,
      description: model.description || '',
      extra: model.extra || {
        feature: '',
        special: []
      }
    }));

    res.json(createResponse(results));
  } catch (error) {
    logger.error('Error querying LLM descriptions:', error);
    res.status(500).json(createResponse(null, 'Failed to query LLM descriptions'));
  }
});

export default router;
