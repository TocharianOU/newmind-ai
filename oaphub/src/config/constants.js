// Per-agent runtime config. Each agent has its own upstream provider so
// medium and strong can point to different services or model tiers.
export const MODEL_MAPPING = {
    'medium-agent': process.env.MEDIUM_AGENT_MODEL_ID || '',
    'strong-agent': process.env.STRONG_AGENT_MODEL_ID || '',
};

// Product-facing provider configuration only. Runtime transport is resolved in proxy.js.
export const MODEL_PROVIDERS = {
    'medium-agent': { type: 'managed', endpoint: '/messages' },
    'strong-agent': { type: 'managed', endpoint: '/messages' },
};

// Complete model configuration — provider is always 'oap' (public brand).
export const MODEL_CONFIG = {
    'medium-agent': {
        id: 'medium-agent',
        object: 'model',
        owned_by: 'oap',
        provider: 'oap',
        endpoint: '/messages',
        metadata: {
            native_format: true,
            managed: true,
            native_client: process.env.MEDIUM_AGENT_CLIENT_TYPE || 'anthropic',
            supports_tools: true,
            supports_streaming: true
        },
        plans: ['PRO', 'BASE']
    },
    'strong-agent': {
        id: 'strong-agent',
        object: 'model',
        owned_by: 'oap',
        provider: 'oap',
        endpoint: '/messages',
        metadata: {
            native_format: true,
            managed: true,
            native_client: process.env.STRONG_AGENT_CLIENT_TYPE || 'anthropic',
            supports_tools: true,
            supports_streaming: true
        },
        plans: ['PRO']
    },
};

// Monthly default quota per tier per plan
// X tier (Jira, Confluence, AWS, custom integrations) uses BYOK so no platform quota
export const TOOL_TIER_QUOTA = {
  BASE: { A: 500,  B: 800,  C: 1500 },
  PRO:  { A: 2000, B: 3000, C: 5000 }
};

// Plan limits — all token quotas are MONTHLY, not daily.
// Supports env overrides for quick pricing changes without a code deploy.
export const PLAN_LIMITS = {
  BASE: {
    models: ['medium-agent'],
    monthlyTokens: parseInt(process.env.BASE_MONTHLY_TOKENS || '2000000', 10),  // 2M / month
    customModels: false,
    tierQuota: TOOL_TIER_QUOTA.BASE
  },
  PRO: {
    models: ['medium-agent', 'strong-agent'],
    monthlyTokens: parseInt(process.env.PRO_MONTHLY_TOKENS  || '5000000', 10),  // 5M / month
    customModels: true,
    tierQuota: TOOL_TIER_QUOTA.PRO
  }
};

// Internal cost accounting (per 1K raw tokens) is private runtime config.
// Keep these in env / admin config rather than source code to avoid exposing
// upstream model economics in distributed builds.
// Fallback per-1K-token cost for custom/unknown models (prevents $0 billing)
const FALLBACK_COST_PER_1K = parseFloat(process.env.MODEL_COST_FALLBACK_PER_1K || '0.015');

export const TOKEN_PRICING = {
  'medium-agent': {
    input: parseFloat(process.env.MODEL_COST_MEDIUM_INPUT_PER_1K || '0'),
    output: parseFloat(process.env.MODEL_COST_MEDIUM_OUTPUT_PER_1K || '0')
  },
  'strong-agent': {
    input: parseFloat(process.env.MODEL_COST_STRONG_INPUT_PER_1K || '0'),
    output: parseFloat(process.env.MODEL_COST_STRONG_OUTPUT_PER_1K || '0')
  },
};

/**
 * Resolve pricing for any model, with fallback for unknown / custom models.
 */
export function getTokenPricing(model) {
  const p = TOKEN_PRICING[model];
  if (p && (p.input > 0 || p.output > 0)) return p;
  return { input: FALLBACK_COST_PER_1K, output: FALLBACK_COST_PER_1K };
}

// Product-level token multiplier applied when deducting from user's token balance.
// UsageRecord always stores real tokens for cost analytics.
// tokenBalance is deducted by: real_tokens * multiplier
// Supports env override for quick pricing adjustments without a code deploy.
export const MODEL_MULTIPLIER = {
  'medium-agent': parseFloat(process.env.MODEL_MULTIPLIER_MEDIUM || '1'),
  'strong-agent': parseFloat(process.env.MODEL_MULTIPLIER_STRONG || '3'),
};

// Check user's monthly token usage (product tokens = real tokens * MODEL_MULTIPLIER).
// UsageRecord stores raw tokens; we apply the multiplier here for quota checking
// so that strong usage is counted at 3x against the shared monthly balance.
//
// When monthly gifted tokens are exhausted, the function checks the user's USD
// balance. If there is remaining balance the call is still allowed with
// billingMode: 'usd' so the caller knows to charge USD instead of tokens.
export const checkTokenUsage = async (userId, userPlan, modelName = null) => {
  try {
    const { prisma } = await import('./database.js');

    const planLimits = PLAN_LIMITS[userPlan] || PLAN_LIMITS.BASE;
    const monthlyLimit = planLimits.monthlyTokens;

    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const allRecords = await prisma.usageRecord.findMany({
      where: { userId, createdAt: { gte: startOfMonth } },
      select: { modelName: true, inputTokens: true, outputTokens: true }
    });

    const totalProductTokensUsed = allRecords.reduce((acc, r) => {
      const multiplier = MODEL_MULTIPLIER[r.modelName] ?? 1;
      return acc + (r.inputTokens + r.outputTokens) * multiplier;
    }, 0);

    if (totalProductTokensUsed >= monthlyLimit) {
      // Gifted tokens exhausted — check USD balance as fallback
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { usdBalance: true } });
      const usdBalance = user ? Number(user.usdBalance) : 0;

      if (usdBalance > 0) {
        return {
          allowed: true,
          billingMode: 'usd',
          totalUsed: totalProductTokensUsed,
          monthlyLimit,
          remaining: 0,
          usdBalance,
          error: null
        };
      }

      return {
        allowed: false,
        billingMode: 'none',
        totalUsed: totalProductTokensUsed,
        monthlyLimit,
        remaining: 0,
        usdBalance: 0,
        error: `Monthly token limit exceeded (${totalProductTokensUsed}/${monthlyLimit}) and no USD balance remaining. Please top up your balance or wait until the 1st of next month.`
      };
    }

    return {
      allowed: true,
      billingMode: 'token',
      totalUsed: totalProductTokensUsed,
      monthlyLimit,
      remaining: monthlyLimit - totalProductTokensUsed,
      error: null
    };
  } catch (error) {
    console.error('Error checking token usage:', error);
    return { allowed: true, billingMode: 'token', error: null };
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
  
  // Check token usage limits (if userId provided), scoped to this model for per-model caps
  if (userId) {
    const tokenCheck = await checkTokenUsage(userId, userPlan, model);
    if (!tokenCheck.allowed) {
      return {
        allowed: false,
        error: tokenCheck.error,
        tokenUsage: {
          used: tokenCheck.totalUsed,
          limit: tokenCheck.monthlyLimit,
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
