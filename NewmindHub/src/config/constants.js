// Model mapping: newmind -> real models
export const MODEL_MAPPING = {
    'newmind-medium': 'claude-sonnet-4-5',
    'newmind-strong': 'claude-opus-4-1',
    'newmind-small': 'qwen/qwen3-coder-30b'
};

// Model provider configuration
export const MODEL_PROVIDERS = {
    'newmind-medium': { type: 'anthropic', endpoint: '/v1/messages' },
    'newmind-strong': { type: 'anthropic', endpoint: '/v1/messages' },
    'newmind-small': { type: 'lmstudio', endpoint: '/v1/chat/completions', url: process.env.PRODUCTION_API_URL || 'http://localhost:11234' }
};

// Complete model configuration
export const MODEL_CONFIG = {
    'newmind-medium': {
        id: 'newmind-medium',
        object: 'model',
        owned_by: 'newmind',
        provider: 'anthropic',  // For MCP Host
        endpoint: '/v1/messages',  // For MCP Host
        metadata: {
            native_format: true,
            real_provider: 'anthropic',
            supports_tools: true,
            supports_streaming: true
        },
        plans: ['PRO', 'ENTERPRISE', 'BASE']
    },
    'newmind-strong': {
        id: 'newmind-strong',
        object: 'model',
        owned_by: 'newmind',
        provider: 'anthropic',
        endpoint: '/v1/messages',
        metadata: {
            native_format: true,
            real_provider: 'anthropic',
            supports_tools: true,
            supports_streaming: true
        },
        plans: ['ENTERPRISE']  // Only ENTERPRISE
    },
    'newmind-small': {
        id: 'newmind-small',
        object: 'model',
        owned_by: 'newmind',
        provider: 'openai',  // For MCP Host
        endpoint: '/v1/chat/completions',  // For MCP Host
        metadata: {
            native_format: true,
            real_provider: 'openai',
            supports_tools: true,
            supports_streaming: true
        },
        plans: ['PRO', 'ENTERPRISE', 'BASE']
    }
};

// Plan limits
export const PLAN_LIMITS = {
  BASE: {
    models: ['newmind-medium','newmind-strong','newmind-small'],
    dailyTokens: 100000,
    mcpServers: 10
  },
  PRO: {
    models: [ 'newmind-medium','newmind-strong','newmind-small'],
    dailyTokens: 1000000,
    mcpServers: 20
  },
  ENTERPRISE: {
    models: ['newmind-medium','newmind-strong','newmind-small'],
    dailyTokens: 99999999, // Unlimited
    mcpServers: 999  // Unlimited
  }
};

// Token pricing (per 1K tokens)
export const TOKEN_PRICING = {
  'newmind-medium': {
    input: 0.003,
    output: 0.015
  },
  'newmind-strong': {
    input: 0.015,
    output: 0.075
  },
  'newmind-small': {
    input: 0.001,  // Lower cost for local model
    output: 0.002
  }
};

// Check user's daily token usage
export const checkTokenUsage = async (userId, userPlan) => {
  try {
    // Import prisma dynamically to avoid circular dependencies
    const { prisma } = await import('./database.js');
    
    // Get plan limits
    const planLimits = PLAN_LIMITS[userPlan] || PLAN_LIMITS.BASE;
    const dailyLimit = planLimits.dailyTokens;
    
    // Calculate usage for current day
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const usageRecords = await prisma.usageRecord.findMany({
      where: {
        userId: userId,
        createdAt: {
          gte: startOfDay
        }
      }
    });
    
    // Calculate total tokens used today
    const totalTokensUsed = usageRecords.reduce((acc, record) => {
      return acc + record.inputTokens + record.outputTokens;
    }, 0);
    
    const remainingTokens = dailyLimit - totalTokensUsed;
    
    return {
      allowed: remainingTokens > 0,
      totalUsed: totalTokensUsed,
      dailyLimit: dailyLimit,
      remaining: remainingTokens,
      error: remainingTokens <= 0 ? `Daily token limit exceeded. Used: ${totalTokensUsed}/${dailyLimit} tokens. Limit resets at midnight.` : null
    };
  } catch (error) {
    // If there's an error checking usage, allow the request but log the error
    console.error('Error checking token usage:', error);
    return { allowed: true, error: null };
  }
};

// Unified permission checking function (now includes token limits)
export const checkModelAccess = async (model, userPlan, userId = null) => {
  // Check if model exists and plan has access
  if (!MODEL_CONFIG[model]) {
    return {
      allowed: false,
      error: `Unsupported model: ${model}. Available: ${Object.keys(MODEL_CONFIG).join(', ')}`
    };
  }
  
  const config = MODEL_CONFIG[model];
  if (!config.plans.includes(userPlan)) {
    return {
      allowed: false,
      error: `Model ${model} requires one of these plans: ${config.plans.join(', ')}. Your plan: ${userPlan}`
    };
  }
  
  // Check token usage limits (if userId provided)
  if (userId) {
    const tokenCheck = await checkTokenUsage(userId, userPlan);
    if (!tokenCheck.allowed) {
      return {
        allowed: false,
        error: tokenCheck.error,
        tokenUsage: {
          used: tokenCheck.totalUsed,
          limit: tokenCheck.dailyLimit,
          remaining: tokenCheck.remaining
        }
      };
    }
  }
  
  return { allowed: true };
};

// API Response format
export const createResponse = (data = null, error = null) => {
  if (error) {
    return {
      status: 'error',
      data: null,
      error: typeof error === 'string' ? error : error.message
    };
  }
  return {
    status: 'success',
    data,
    error: null
  };
};
