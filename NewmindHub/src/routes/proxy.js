import express from 'express';
import fetch from 'node-fetch';
import { authenticateToken, requirePlan } from '../middleware/auth.js';
import { createResponse, MODEL_MAPPING } from '../config/constants.js';
import { prisma } from '../config/database.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Async function to record usage
async function recordUsage(userId, model, inputTokens, outputTokens) {
  try {
    const cost = (inputTokens * 0.003 + outputTokens * 0.015) / 1000; // Claude pricing
    
    await prisma.usageRecord.create({
      data: {
        userId,
        model,
        inputTokens,
        outputTokens,
        cost
      }
    });
    
    logger.info(`📊 Usage recorded: ${model}, input: ${inputTokens}, output: ${outputTokens}`);
  } catch (error) {
    logger.error('❌ Error recording usage:', error);
  }
}

// POST /api/v1/messages - Anthropic native endpoint (transparent proxy)
router.post('/messages', authenticateToken, requirePlan(['PRO', 'ENTERPRISE']), async (req, res) => {
  try {
    logger.info(`🚀 [PROXY] Anthropic native endpoint called by ${req.user.email}`);
    logger.info(`📝 [PROXY] Request body: ${JSON.stringify(req.body, null, 2)}`);
    
    const { model } = req.body;
    
    // Check if model is supported
    if (!MODEL_MAPPING[model]) {
      return res.status(400).json(
        createResponse(null, `Unsupported model: ${model}. Available: ${Object.keys(MODEL_MAPPING).join(', ')}`)
      );
    }
    
    // Check if user has access to strong model
    if (model === 'newmind-strong' && req.user.planName !== 'ENTERPRISE') {
      return res.status(403).json(
        createResponse(null, 'newmind-strong requires ENTERPRISE plan')
      );
    }
    
    // Check API Key
    if (!process.env.ANTHROPIC_API_KEY) {
      logger.error('❌ ANTHROPIC_API_KEY not configured');
      return res.status(500).json(createResponse(null, 'Service temporarily unavailable'));
    }
    
    logger.info(`🎯 [PROXY] Transparent proxy for ${model} → ${MODEL_MAPPING[model]}`);
    logger.info(`🌐 [PROXY] Forwarding to Anthropic API...`);
    
    // Prepare proxy request - map to real Claude model
    const proxyRequest = {
      ...req.body,
      model: MODEL_MAPPING[model] // Map to real Claude model
    };
    
    // Ensure required Anthropic parameters
    if (!proxyRequest.max_tokens) {
      proxyRequest.max_tokens = 4096;
    }
    
    // Build Anthropic API headers
    const anthropicHeaders = {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
      
    };
    
    logger.info(`📡 [Proxy] Sending request to Anthropic API...`);
    
    // Send to Anthropic API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: anthropicHeaders,
      body: JSON.stringify(proxyRequest)
    });
    
    logger.info(`📨 [Proxy] Anthropic API responded with status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`❌ [Proxy] Anthropic API error: ${response.status} - ${errorText}`);
      return res.status(response.status).json({ 
        error: 'Upstream API error',
        details: errorText 
      });
    }
    
    // Check if streaming response
    const isStreaming = req.body.stream === true;
    
    if (isStreaming) {
      logger.info(`🌊 [Proxy] Handling streaming response`);
      
      // Set SSE response headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*'
      });
      
      // Variables for token tracking
      let inputTokens = 0;
      let outputTokens = 0;
      let buffer = '';
      
      // Stream the response
      response.body.on('data', (chunk) => {
        // Forward the chunk immediately
        res.write(chunk);
        
        // Parse tokens asynchronously
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const data = JSON.parse(line.slice(6));
              
              // Extract token counts from different event types
              if (data.type === 'message_start' && data.message?.usage) {
                inputTokens = data.message.usage.input_tokens || 0;
              }
              if (data.type === 'message_delta' && data.usage) {
                outputTokens = data.usage.output_tokens || 0;
              }
              if (data.type === 'message_stop' && data.usage) {
                outputTokens = data.usage.output_tokens || 0;
              }
            } catch (parseError) {
              // Ignore parse errors, continue streaming
            }
          }
        }
      });
      
      response.body.on('end', () => {
        res.end();
        
        // Record usage asynchronously
        if (inputTokens > 0 || outputTokens > 0) {
          setImmediate(() => recordUsage(req.user.id, model, inputTokens, outputTokens));
        }
      });
      
      response.body.on('error', (error) => {
        logger.error(`❌ [Proxy] Stream error:`, error);
        res.end();
      });
      
    } else {
      logger.info(`📄 [Proxy] Handling non-streaming response`);
      
      // Non-streaming response
      const data = await response.json();
      
      // Record token usage asynchronously
      if (data.usage) {
        const inputTokens = data.usage.input_tokens || 0;
        const outputTokens = data.usage.output_tokens || 0;
        setImmediate(() => recordUsage(req.user.id, model, inputTokens, outputTokens));
      }
      
      // Forward response
      res.json(data);
    }
    
  } catch (error) {
    logger.error('❌ [Proxy] Error:', error);
    res.status(500).json(createResponse(null, 'Internal server error'));
  }
});

// POST /api/v1/chat/completions - OpenAI compatible fallback endpoint (deprecated)
router.post('/chat/completions', authenticateToken, (req, res) => {
  logger.warn(`⚠️ [Proxy] Deprecated OpenAI compatibility endpoint called`);
  
  res.status(410).json({
    error: {
      message: 'This endpoint is deprecated. Please use /api/v1/messages for Anthropic models.',
      type: 'deprecated_endpoint',
      code: 'endpoint_deprecated'
    }
  });
});

export default router;
