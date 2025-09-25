import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { createResponse, PLAN_LIMITS } from '../config/constants.js';
import logger from '../utils/logger.js';

const router = express.Router();

// GET /api/v1/models - Model discovery endpoint (Critical for Dive!)
router.get('/models', authenticateToken, async (req, res) => {
  try {
    const userPlan = req.user.planName || 'BASE';
    
    logger.info(`🔍 [Models] User ${req.user.email} (${userPlan}) requesting models`);
    
    // Base models available to all users
    const models = [
      {
        id: 'gpt-3.5-turbo',
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: 'openai',
        permission: [],
        root: 'gpt-3.5-turbo',
        parent: null
      }
    ];
    
    // Add Newmind models for PRO and ENTERPRISE users
    if (userPlan === 'PRO' || userPlan === 'ENTERPRISE' || userPlan === 'BASIC') {
      models.push({
        id: 'newmind-medium',
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: 'newmind',
        provider: 'anthropic',  // Critical: tells Dive which provider to use
        endpoint: '/v1/messages', // Critical: tells Dive which endpoint to call
        permission: [],
        root: 'newmind-medium',
        parent: null,
        metadata: {
          native_format: true,  // Critical: tells Dive to use native format
          real_provider: 'anthropic',
          base_model: 'claude-sonnet-4-20250514',
          supports_tools: true,
          supports_streaming: true
        }
      });
    }
    
    // Add strong model for ENTERPRISE users only
    if (userPlan === 'ENTERPRISE') {
      models.push({
        id: 'newmind-strong',
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: 'newmind',
        provider: 'anthropic',  // Critical: tells Dive which provider to use
        endpoint: '/v1/messages', // Critical: tells Dive which endpoint to call
        permission: [],
        root: 'newmind-strong',
        parent: null,
        metadata: {
          native_format: true,  // Critical: tells Dive to use native format
          real_provider: 'anthropic',
          base_model: 'claude-opus-4',
          supports_tools: true,
          supports_streaming: true
        }
      });
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
