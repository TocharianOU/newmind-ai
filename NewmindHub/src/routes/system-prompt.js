import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { createResponse } from '../config/constants.js';
import logger from '../utils/logger.js';
import { spawn } from 'child_process';
import path from 'path';

const router = express.Router();

// GET /api/v1/system-prompt/current - 获取当前系统提示词环境变量
router.get('/current', async (req, res) => {
  try {
    const systemPrompt = process.env.DIVE_OVERRIDE_SYSTEM_PROMPT || '';
    res.json(createResponse({ 
      content: systemPrompt,
      source: 'environment_variable',
      variable_name: 'DIVE_OVERRIDE_SYSTEM_PROMPT'
    }));
  } catch (error) {
    logger.error('Error fetching current system prompt:', error);
    res.status(500).json(createResponse(null, 'Failed to get system prompt'));
  }
});

// POST /api/v1/system-prompt/set - 设置系统提示词环境变量
router.post('/set', authenticateToken, async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content || typeof content !== 'string') {
      return res.status(400).json(createResponse(null, 'Content is required and must be a string'));
    }

    // 设置环境变量
    process.env.DIVE_OVERRIDE_SYSTEM_PROMPT = content;
    
    logger.info(`✅ System prompt set by ${req.user.email} (length: ${content.length})`);
    
    res.json(createResponse({
      message: 'System prompt set successfully',
      length: content.length,
      note: 'MCP Host needs to be restarted to take effect'
    }));
  } catch (error) {
    logger.error('Error setting system prompt:', error);
    res.status(500).json(createResponse(null, 'Failed to set system prompt'));
  }
});

// DELETE /api/v1/system-prompt - 清除系统提示词环境变量
router.delete('/', authenticateToken, async (req, res) => {
  try {
    delete process.env.DIVE_OVERRIDE_SYSTEM_PROMPT;
    
    logger.info(`✅ System prompt cleared by ${req.user.email}`);
    
    res.json(createResponse({
      message: 'System prompt cleared successfully',
      note: 'MCP Host needs to be restarted to take effect'
    }));
  } catch (error) {
    logger.error('Error clearing system prompt:', error);
    res.status(500).json(createResponse(null, 'Failed to clear system prompt'));
  }
});

export default router;
