// Model mapping: newmind -> anthropic
export const MODEL_MAPPING = {
    'newmind-medium': 'claude-sonnet-4-20250514',
    'newmind-strong': 'claude-opus-4'
};

// Plan limits
export const PLAN_LIMITS = {
  BASE: {
    models: ['newmind-medium','newmind-strong'],
    dailyTokens: 100000,
    mcpServers: 10
  },
  PRO: {
    models: [ 'newmind-medium','newmind-strong'],
    dailyTokens: 1000000,
    mcpServers: 20
  },
  ENTERPRISE: {
    models: ['newmind-medium','newmind-strong'],
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
  }
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
