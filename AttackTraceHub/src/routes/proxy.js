import express from 'express';
import fetch from 'node-fetch';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { authenticateToken, requirePlan } from '../middleware/auth.js';
import { createResponse, MODEL_MAPPING, MODEL_PROVIDERS, MODEL_CONFIG, MODEL_MULTIPLIER, checkModelAccess, getTokenPricing } from '../config/constants.js';
import { prisma } from '../config/database.js';
import { deductTokens } from '../utils/tokenBalance.js';
import { deductUsd, checkUsdBalance } from '../utils/usdBalance.js';
import featureFlags from '../config/featureFlags.js';
import { getLicenseStatus } from '../license/validator.js';
import logger from '../utils/logger.js';
import { writeAudit, AUDIT_ACTIONS, RESOURCE_TYPES } from '../utils/auditLog.js';

const router = express.Router();
const __dirname = dirname(fileURLToPath(import.meta.url));

// Returns the runtime config for a specific product model (medium-agent / strong-agent).
// Each agent reads from its own env prefix (MEDIUM_AGENT_* or STRONG_AGENT_*).
function getManagedRuntimeConfig(productModel) {
  const prefix = productModel === 'strong-agent' ? 'STRONG_AGENT' : 'MEDIUM_AGENT';

  const baseUrl     = process.env[`${prefix}_API_URL`];
  const apiKey      = process.env[`${prefix}_API_KEY`];
  const messagesPath  = process.env[`${prefix}_MESSAGES_PATH`]   || '/v1/messages';
  const apiKeyHeader  = process.env[`${prefix}_API_KEY_HEADER`]  || 'Authorization';
  // Use ?? so that an explicitly empty prefix stays empty (e.g. Anthropic x-api-key needs no Bearer prefix)
  const apiKeyPrefix  = process.env[`${prefix}_API_KEY_PREFIX`]  ?? '';
  const versionHeader = process.env[`${prefix}_API_VERSION_HEADER`] ?? '';
  const versionValue  = process.env[`${prefix}_API_VERSION_VALUE`]  ?? '';

  if (!baseUrl || !apiKey) return null;

  return {
    baseUrl: baseUrl.replace(/\/$/, ''),
    apiKey,
    apiKeyHeader,
    apiKeyPrefix,
    versionHeader,
    versionValue,
    messagesPath: messagesPath.startsWith('/') ? messagesPath : `/${messagesPath}`,
  };
}

function buildManagedApiHeaders(runtimeConfig) {
  const headers = {
    'Content-Type': 'application/json',
    [runtimeConfig.apiKeyHeader]: `${runtimeConfig.apiKeyPrefix}${runtimeConfig.apiKey}`.trim(),
  };

  if (runtimeConfig.versionHeader && runtimeConfig.versionValue) {
    headers[runtimeConfig.versionHeader] = runtimeConfig.versionValue;
  }

  return headers;
}

function getManagedMessagesUrl(runtimeConfig) {
  return `${runtimeConfig.baseUrl}${runtimeConfig.messagesPath}`;
}

function getManagedModelId(productModel) {
  const runtimeModelId = MODEL_MAPPING[productModel];
  return runtimeModelId && runtimeModelId.trim() ? runtimeModelId : null;
}

// 系统提示词处理辅助函数
async function getSystemPromptOverride() {
  try {
    // 优先级1：从文件读取（支持超长 prompt）
    const promptFilePath = process.env.SYSTEM_PROMPT_FILE || join(__dirname, '../../system-prompt.txt');
    
    if (existsSync(promptFilePath)) {
      try {
        const fileContent = await readFile(promptFilePath, 'utf-8');
        if (fileContent && fileContent.trim()) {
          logger.info(`🔥 [PROMPT] Loaded system prompt from file: ${promptFilePath} (length: ${fileContent.trim().length})`);
          return fileContent.trim();
        }
      } catch (fileError) {
        logger.warn(`⚠️ [PROMPT] Failed to read prompt file: ${fileError.message}`);
      }
    }
    
    // 优先级2：从环境变量获取（向后兼容）
    const overridePrompt = process.env.DIVE_OVERRIDE_SYSTEM_PROMPT;
    if (overridePrompt && overridePrompt.trim()) {
      logger.info(`🔥 [PROMPT] Found system prompt override from env (length: ${overridePrompt.trim().length})`);
      return overridePrompt.trim();
    }
  } catch (error) {
    logger.debug('Failed to get system prompt override:', error);
  }
  return null;
}

function insertSystemPromptIntoNativeMessages(requestBody, systemPrompt) {
  // Native messages API需要将系统提示词作为顶级参数，而不是消息中的system角色
  // 如果已经有系统参数，将其与覆盖提示词合并
  let finalSystemPrompt = systemPrompt;
  
  if (requestBody.system) {
    finalSystemPrompt = systemPrompt + '\n\n' + requestBody.system;
    logger.info(`🔥 [PROMPT] Merged override with existing system prompt`);
  } else {
    logger.info(`🔥 [PROMPT] Applied system prompt override to native messages request`);
  }
  
  // 设置系统参数
  requestBody.system = finalSystemPrompt;
  
  // 移除消息中的system角色（如果有的话）
  if (requestBody.messages) {
    requestBody.messages = requestBody.messages.filter(msg => msg.role !== 'system');
  }
  
  return requestBody;
}

function insertSystemPromptIntoOpenAIMessages(messages, systemPrompt) {
  // 移除现有的系统消息
  const filteredMessages = messages.filter(msg => msg.role !== 'system');
  
  // 获取原有的系统提示词内容
  const existingSystemMessages = messages.filter(msg => msg.role === 'system');
  let finalSystemPrompt = systemPrompt;
  
  if (existingSystemMessages.length > 0) {
    const existingContent = existingSystemMessages.map(msg => msg.content).join('\n\n');
    finalSystemPrompt = systemPrompt + '\n\n' + existingContent;
    logger.info(`🔥 [PROMPT] Merged override with existing system messages`);
  } else {
    logger.info(`🔥 [PROMPT] Applied system prompt override to OpenAI messages`);
  }
  
  // 在消息开头插入合并后的系统提示词
  const newMessages = [{ role: 'system', content: finalSystemPrompt }, ...filteredMessages];
  return newMessages;
}

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

// Async function to record usage.
// UsageRecord always stores real (raw) token counts for cost analytics.
// tokenBalance deduction applies MODEL_MULTIPLIER so higher tiers can burn
// more product tokens without exposing runtime model/vendor details.
// When monthly gifted tokens are exhausted, falls through to USD balance.
async function recordUsage(userId, model, inputTokens, outputTokens, req) {
  try {
    const rawTokens = inputTokens + outputTokens;
    const { checkTokenUsage } = await import('../config/constants.js');
    const pricing = getTokenPricing(model);
    const cost = (inputTokens * pricing.input + outputTokens * pricing.output) / 1000;

    const recordId = randomUUID();
    await prisma.usageRecord.create({
      data: { id: recordId, userId, modelName: model, inputTokens, outputTokens, cost }
    });

    writeAudit(req, {
      userId,
      action: AUDIT_ACTIONS.MODEL_CALL,
      resourceType: RESOURCE_TYPES.MODEL,
      resourceId: model,
      metadata: { inputTokens, outputTokens, rawTokens, cost },
    });

    if (featureFlags.BILLING_ENABLED) {
      const multiplier = MODEL_MULTIPLIER[model] ?? 1;
      const productTokens = Math.ceil(rawTokens * multiplier);
      const userPlan = req.user?.planName || 'BASE';
      const usage = await checkTokenUsage(userId, userPlan, model);

      if (usage.billingMode === 'token' && usage.remaining > 0) {
        try {
          await deductTokens(userId, productTokens);
        } catch {
          const costUsd = cost > 0 ? cost : (rawTokens * 0.000015);
          await deductUsd(userId, costUsd, 'model_charge', 'usage_record', recordId, { model, rawTokens });
        }
      } else {
        const costUsd = cost > 0 ? cost : (rawTokens * 0.000015);
        await deductUsd(userId, costUsd, 'model_charge', 'usage_record', recordId, { model, rawTokens });
      }
    }
  } catch (error) {
    logger.error('Error recording usage:', error);
  }
}

/**
 * Lookup a custom model by modelId from the DB.
 * Returns the CustomModel record or null.
 */
async function findCustomModel(modelId) {
  try {
    return await prisma.customModel.findUnique({
      where: { modelId, active: true },
    });
  } catch {
    return null; // Table might not exist yet (pre-migration)
  }
}

/**
 * Mode-aware access check.
 * - SaaS: delegates to checkModelAccess (plan + monthly token limits), also allows custom models for admins
 * - Enterprise: allows all valid models (static + custom); if maxTokens > 0, checks global pool
 */
async function checkAccessForMode(model, userPlan, userId, userRole) {
  const isStaticModel = MODEL_CONFIG && MODEL_CONFIG[model];
  const customModel = isStaticModel ? null : await findCustomModel(model);

  if (!featureFlags.LICENSE_ENABLED) {
    // SaaS path — custom models available to PRO plan users and admins
    if (!isStaticModel) {
      if (!customModel) return { allowed: false, error: `Unsupported model: ${model}` };
      const planAllows = userPlan === 'PRO' || userRole === 'ADMIN';
      if (!planAllows) return { allowed: false, error: 'Custom models require PRO plan or above' };
      return { allowed: true, customModel };
    }
    return checkModelAccess(model, userPlan, userId);
  }

  // Enterprise path — validate model exists (static or custom)
  if (!isStaticModel && !customModel) {
    return { allowed: false, error: `Unsupported model: ${model}` };
  }

  // Check global token quota (skip if maxTokens = -1)
  const { status, license } = await getLicenseStatus();
  if (status !== 'ACTIVE') {
    return { allowed: false, error: `License ${status} — contact your administrator` };
  }

  const maxTokens = Number(license.maxTokens);
  if (maxTokens > 0) {
    const totalUsed = await prisma.usageRecord.aggregate({
      _sum: { inputTokens: true, outputTokens: true },
    });
    const used = (totalUsed._sum.inputTokens || 0) + (totalUsed._sum.outputTokens || 0);
    if (used >= maxTokens) {
      return {
        allowed: false,
        error: `License token quota exhausted (${used}/${maxTokens}). Contact your administrator.`,
      };
    }
  }

  return { allowed: true, customModel };
}

// POST /api/v1/messages - native managed endpoint (transparent proxy)
router.post('/messages', authenticateToken, async (req, res) => {
  try {
    logger.info(`🚀 [PROXY] Native managed endpoint called by ${req.user.email}`);
    logger.info(`📝 [PROXY] Request body: ${JSON.stringify(req.body, null, 2)}`);
    
    const { model } = req.body;
    const userPlan = req.user.planName || 'BASE';
    
    // Unified permission check (mode-aware: plan limits in SaaS, license quota in enterprise)
    const accessCheck = await checkAccessForMode(model, userPlan, req.user.id, req.user.role);
    if (!accessCheck.allowed) {
      const statusCode = accessCheck.error.includes('Unsupported') ? 400 : 
                        accessCheck.error.includes('limit exceeded') || accessCheck.error.includes('exhausted') ? 429 : 403;
      return res.status(statusCode).json(
        createResponse(null, accessCheck.error)
      );
    }

    // Custom model path — proxy to external Anthropic-compatible endpoint
    if (accessCheck.customModel) {
      const cm = accessCheck.customModel;
      logger.info(`🔌 [CustomModel] Proxying ${model} -> ${cm.baseURL} (native /messages)`);

      const systemPromptOverride = await getSystemPromptOverride();
      const requestBody = { ...req.body, model: cm.modelId };
      if (systemPromptOverride) {
        insertSystemPromptIntoNativeMessages(requestBody, systemPromptOverride);
      }
      if (!requestBody.max_tokens) requestBody.max_tokens = 32000;

      const targetURL = `${cm.baseURL}/messages`;
      const headers = {
        'Content-Type': 'application/json',
        ...(cm.apiKey && {
          'x-api-key': cm.apiKey,
          'anthropic-version': '2023-06-01',
        }),
      };

      const response = await fetch(targetURL, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errText = await response.text();
        logger.error(`❌ [CustomModel] ${model} error ${response.status}: ${errText}`);
        return res.status(response.status).json({ error: { message: errText, type: 'custom_model_error' } });
      }

      if (req.body.stream === true) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        });
        let inputTokens = 0, outputTokens = 0;
        response.body.on('data', (chunk) => {
          res.write(chunk);
          const text = chunk.toString();
          const usageMatch = text.match(/"input_tokens"\s*:\s*(\d+)/);
          const outMatch = text.match(/"output_tokens"\s*:\s*(\d+)/);
          if (usageMatch) inputTokens = parseInt(usageMatch[1]);
          if (outMatch) outputTokens = parseInt(outMatch[1]);
        });
        response.body.on('end', () => {
          res.end();
          if (inputTokens > 0 || outputTokens > 0) {
            setImmediate(() => recordUsage(req.user.id, model, inputTokens, outputTokens, req));
          }
        });
        response.body.on('error', () => res.end());
      } else {
        const data = await response.json();
        if (data.usage) {
          setImmediate(() => recordUsage(req.user.id, model, data.usage.input_tokens || 0, data.usage.output_tokens || 0, req));
        }
        res.json(data);
      }
      return;
    }

    const runtimeConfig = getManagedRuntimeConfig(model);
    const runtimeModelId = getManagedModelId(model);
    if (!runtimeConfig || !runtimeModelId) {
      return res.status(500).json(createResponse(null, 'Service temporarily unavailable'));
    }
    
   
    // 🔥 获取系统提示词覆盖
    const systemPromptOverride = await getSystemPromptOverride();
    
    // Prepare proxy request - map product model to private runtime model id
    const proxyRequest = {
      ...req.body,
      model: runtimeModelId
    };
    
    // 🔥 如果有系统提示词覆盖，设置为顶级系统参数
    if (systemPromptOverride) {
      insertSystemPromptIntoNativeMessages(proxyRequest, systemPromptOverride);
    }
    
    // Ensure required native parameters
    if (!proxyRequest.max_tokens) {
      proxyRequest.max_tokens = 32000;
    }

    const managedHeaders = buildManagedApiHeaders(runtimeConfig);

    logger.info(`📡 [Proxy] Sending request to managed runtime...`);

    const response = await fetch(getManagedMessagesUrl(runtimeConfig), {
      method: 'POST',
      headers: managedHeaders,
      body: JSON.stringify(proxyRequest)
    });

    logger.info(`📨 [Proxy] Managed runtime responded with status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`❌ [Proxy] Upstream runtime error: ${response.status} - ${errorText}`);
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
        
        if (inputTokens > 0 || outputTokens > 0) {
          setImmediate(() => recordUsage(req.user.id, model, inputTokens, outputTokens, req));
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
        setImmediate(() => recordUsage(req.user.id, model, inputTokens, outputTokens, req));
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
    
    // Unified permission check (mode-aware)
    const accessCheck = await checkAccessForMode(model, userPlan, req.user.id, req.user.role);
    if (!accessCheck.allowed) {
      const statusCode = accessCheck.error.includes('Unsupported') ? 400 : 
                        accessCheck.error.includes('limit exceeded') || accessCheck.error.includes('exhausted') ? 429 : 403;
      return res.status(statusCode).json(
        createResponse(null, accessCheck.error)
      );
    }
    
    // Custom model path — proxy to external endpoint directly
    if (accessCheck.customModel) {
      const cm = accessCheck.customModel;
      logger.info(`🔌 [CustomModel] Proxying ${model} -> ${cm.baseURL}`);

      const systemPromptOverride = await getSystemPromptOverride();
      const requestBody = { ...req.body, model: cm.modelId };
      if (systemPromptOverride && requestBody.messages) {
        requestBody.messages = insertSystemPromptIntoOpenAIMessages(requestBody.messages, systemPromptOverride);
      }

      const targetURL = `${cm.baseURL}/chat/completions`;
      const headers = {
        'Content-Type': 'application/json',
        ...(cm.apiKey && { Authorization: `Bearer ${cm.apiKey}` }),
      };

      const response = await fetch(targetURL, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errText = await response.text();
        logger.error(`❌ [CustomModel] ${model} error ${response.status}: ${errText}`);
        return res.status(response.status).json({ error: { message: errText, type: 'custom_model_error' } });
      }

      if (req.body.stream === true) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        });
        let inputTokens = 0, outputTokens = 0, buffer = '';
        response.body.on('data', (chunk) => {
          res.write(chunk);
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
              try {
                const d = JSON.parse(line.slice(6));
                if (d.usage) { inputTokens = d.usage.prompt_tokens || 0; outputTokens = d.usage.completion_tokens || 0; }
              } catch { /* ignore */ }
            }
          }
        });
        response.body.on('end', () => {
          res.end();
          if (inputTokens > 0 || outputTokens > 0) {
            setImmediate(() => recordUsage(req.user.id, model, inputTokens, outputTokens, req));
          }
        });
        response.body.on('error', () => res.end());
      } else {
        const data = await response.json();
        if (data.usage) {
          setImmediate(() => recordUsage(req.user.id, model, data.usage.prompt_tokens || 0, data.usage.completion_tokens || 0, req));
        }
        res.json(data);
      }
      return;
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
      
      // 🔥 获取系统提示词覆盖
      const systemPromptOverride = await getSystemPromptOverride();
      
      // Prepare request with real model name
      const lmstudioBody = {
        ...req.body,
        model: realModelName  // Use real model name
      };
      
      // 🔥 如果有系统提示词覆盖，插入到消息中
      if (systemPromptOverride && lmstudioBody.messages) {
        lmstudioBody.messages = insertSystemPromptIntoOpenAIMessages(
          lmstudioBody.messages, 
          systemPromptOverride
        );
      }
      
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
      
    } else if (provider.type === 'managed') {
      logger.info(`🔄 [Proxy] Handling managed model ${model}`);

      const runtimeConfig = getManagedRuntimeConfig(model);
      if (!runtimeConfig || !realModelName) {
        return res.status(500).json(createResponse(null, 'Service temporarily unavailable'));
      }
      
      // 🔥 获取系统提示词覆盖
      const systemPromptOverride = await getSystemPromptOverride();
      
      // Convert OpenAI-compatible input to native managed-runtime format.
      const nativeRequest = {
        model: realModelName,
        messages: req.body.messages,
        max_tokens: req.body.max_tokens || 32000,
        stream: req.body.stream || false
      };
      
      // 🔥 如果有系统提示词覆盖，设置为顶级系统参数
      if (systemPromptOverride) {
        insertSystemPromptIntoNativeMessages(nativeRequest, systemPromptOverride);
      }

      const managedHeaders = buildManagedApiHeaders(runtimeConfig);

      logger.info(`📡 [Proxy] Sending request to managed runtime...`);

      const response = await fetch(getManagedMessagesUrl(runtimeConfig), {
        method: 'POST',
        headers: managedHeaders,
        body: JSON.stringify(nativeRequest)
      });

      logger.info(`📨 [Proxy] Managed runtime responded with status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`❌ [Proxy] Upstream runtime error: ${response.status} - ${errorText}`);
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
          
          if (inputTokens > 0 || outputTokens > 0) {
            setImmediate(() => recordUsage(req.user.id, model, inputTokens, outputTokens, req));
          }
        });
        
        response.body.on('error', (error) => {
          logger.error(`[Proxy] Stream error:`, error);
          res.end();
        });
        
      } else {
        const data = await response.json();
        
        if (data.usage) {
          const inputTokens = data.usage.input_tokens || 0;
          const outputTokens = data.usage.output_tokens || 0;
          setImmediate(() => recordUsage(req.user.id, model, inputTokens, outputTokens, req));
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
