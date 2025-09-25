import express from 'express';
import fetch from 'node-fetch';
import { authenticateToken, requirePlan } from '../middleware/auth.js';
import { createResponse, MODEL_MAPPING, MODEL_PROVIDERS, checkModelAccess } from '../config/constants.js';
import { prisma } from '../config/database.js';
import logger from '../utils/logger.js';

const router = express.Router();

// LM Studio auto-loading functionality
async function ensureLMStudioModelLoaded(baseUrl, modelName, maxRetries = 3) {
  try {
    logger.info(`🔍 [LM Studio] Checking if model ${modelName} is loaded...`);
    
    // Check current models
    const modelsResponse = await fetch(`${baseUrl}/v1/models`);
    if (modelsResponse.ok) {
      const models = await modelsResponse.json();
      const isLoaded = models.data?.some(model => 
        model.id === modelName || model.id.includes(modelName.split('/')[1])
      );
      
      if (isLoaded) {
        logger.info(`✅ [LM Studio] Model ${modelName} is already loaded`);
        return true;
      }
    }
    
    // Try to load the model
    logger.info(`🔄 [LM Studio] Attempting to load model ${modelName}...`);
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const loadResponse = await fetch(`${baseUrl}/v1/load`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: modelName })
        });
        
        if (loadResponse.ok) {
          logger.info(`✅ [LM Studio] Model ${modelName} loaded successfully on attempt ${attempt}`);
          // Wait for model to be ready
          await new Promise(resolve => setTimeout(resolve, 3000));
          return true;
        }
        
        logger.warn(`⚠️ [LM Studio] Load attempt ${attempt} failed: ${loadResponse.status}`);
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        }
      } catch (error) {
        logger.error(`❌ [LM Studio] Load attempt ${attempt} error:`, error);
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        }
      }
    }
    
    logger.error(`❌ [LM Studio] Failed to load model ${modelName} after ${maxRetries} attempts`);
    return false;
  } catch (error) {
    logger.error(`❌ [LM Studio] Error in ensureLMStudioModelLoaded:`, error);
    return false;
  }
}

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
router.post('/messages', authenticateToken, async (req, res) => {
  try {
    logger.info(`🚀 [PROXY] Anthropic native endpoint called by ${req.user.email}`);
    logger.info(`📝 [PROXY] Request body: ${JSON.stringify(req.body, null, 2)}`);
    
    const { model } = req.body;
    const userPlan = req.user.planName || 'BASE';
    
    // Unified permission check (including token limits)
    const accessCheck = await checkModelAccess(model, userPlan, req.user.id);
    if (!accessCheck.allowed) {
      const statusCode = accessCheck.error.includes('Unsupported') ? 400 : 
                        accessCheck.error.includes('limit exceeded') ? 429 : 403;
      return res.status(statusCode).json(
        createResponse(null, accessCheck.error)
      );
    }
    
    // Check API Key
    if (!process.env.ANTHROPIC_API_KEY) {
      
      return res.status(500).json(createResponse(null, 'Service temporarily unavailable'));
    }
    
   
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

// POST /api/v1/chat/completions - Unified OpenAI compatible endpoint
router.post('/chat/completions', authenticateToken, async (req, res) => {
  try {
    const { model } = req.body;
    const userPlan = req.user.planName || 'BASE';
    
    logger.info(`🤖 [Proxy] OpenAI compatible endpoint called for model: ${model}`);
    
    // Unified permission check (including token limits)
    const accessCheck = await checkModelAccess(model, userPlan, req.user.id);
    if (!accessCheck.allowed) {
      const statusCode = accessCheck.error.includes('Unsupported') ? 400 : 
                        accessCheck.error.includes('limit exceeded') ? 429 : 403;
      return res.status(statusCode).json(
        createResponse(null, accessCheck.error)
      );
    }
    
    const provider = MODEL_PROVIDERS[model];
    const realModelName = MODEL_MAPPING[model];
    
    logger.info(`🔄 [Proxy] Mapping ${model} -> ${realModelName} (${provider.type})`);
    
    // Handle LM Studio models
    if (provider.type === 'lmstudio') {
      const baseUrl = provider.url;
      
      logger.info(`🏠 [LM Studio] Proxying to: ${baseUrl}`);
      
      // Ensure model is loaded
      const isLoaded = await ensureLMStudioModelLoaded(baseUrl, realModelName);
      if (!isLoaded) {
        return res.status(503).json({
          error: 'LM Studio model loading failed',
          details: `Failed to load model ${realModelName}`
        });
      }
      
      // Prepare request with real model name
      const lmstudioBody = {
        ...req.body,
        model: realModelName  // Use real model name
      };
      
      // Forward request to LM Studio
      const response = await fetch(`${baseUrl}${provider.endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer lmstudio'
        },
        body: JSON.stringify(lmstudioBody)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`❌ [LM Studio] Error: ${response.status} - ${errorText}`);
        return res.status(response.status).json({ 
          error: 'LM Studio API error',
          details: errorText 
        });
      }
      
      // Handle streaming response
      if (req.body.stream === true) {
        logger.info(`🌊 [LM Studio] Handling streaming response`);
        
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*'
        });
        
        response.body.on('data', (chunk) => {
          res.write(chunk);
        });
        
        response.body.on('end', () => {
          res.end();
          logger.info(`✅ [LM Studio] Stream completed`);
        });
        
        response.body.on('error', (error) => {
          logger.error(`❌ [LM Studio] Stream error:`, error);
          res.end();
        });
        
      } else {
        logger.info(`📄 [LM Studio] Handling non-streaming response`);
        const data = await response.json();
        res.json(data);
      }
      
    } else if (provider.type === 'anthropic') {
      // Handle Anthropic models directly (avoid double permission check)
      logger.info(`🔄 [Proxy] Handling Anthropic model ${model} directly`);
      
      // Check API Key
      if (!process.env.ANTHROPIC_API_KEY) {
        return res.status(500).json(createResponse(null, 'Service temporarily unavailable'));
      }
      
      // Convert OpenAI format to Anthropic format and map to real model
      const anthropicRequest = {
        model: realModelName,  // Use real Claude model name
        messages: req.body.messages,
        max_tokens: req.body.max_tokens || 4096,
        stream: req.body.stream || false
      };
      
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
        body: JSON.stringify(anthropicRequest)
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
      
      // Handle streaming response
      if (req.body.stream === true) {
        logger.info(`🌊 [Proxy] Handling streaming response`);
        
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
    }
    
  } catch (error) {
    logger.error('❌ [Proxy] OpenAI endpoint error:', error);
    res.status(500).json({
      error: {
        message: 'Internal server error',
        type: 'api_error'
      }
    });
  }
});

export default router;
