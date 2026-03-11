import { prisma } from '../config/database.js';
import { TOOL_TIER_MAP, TOOL_TIER_QUOTA, PLAN_LIMITS } from '../config/constants.js';
import logger from '../utils/logger.js';

/**
 * Get the current calendar month's period start (1st day 00:00 UTC)
 */
function getCurrentPeriodStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Returns the effective monthly limit for a tier given the user's plan.
 * Enterprise deployments (no subscription) get PRO-equivalent quota.
 */
function getMonthlyLimit(userPlan, tier) {
  const plan = userPlan || 'BASE';
  const quotaMap = TOOL_TIER_QUOTA[plan] || TOOL_TIER_QUOTA.BASE;
  return quotaMap[tier] ?? 0;
}

/**
 * Upsert a ToolQuota row, resetting usedThisMonth if a new billing period has started.
 */
async function ensureQuotaRow(userId, tier, monthlyLimit) {
  const periodStart = getCurrentPeriodStart();

  let quota = await prisma.toolQuota.findUnique({
    where: { userId_tier: { userId, tier } }
  });

  if (!quota) {
    quota = await prisma.toolQuota.create({
      data: { userId, tier, monthlyLimit, usedThisMonth: 0, periodStart }
    });
  } else if (quota.periodStart < periodStart) {
    quota = await prisma.toolQuota.update({
      where: { userId_tier: { userId, tier } },
      data: { usedThisMonth: 0, periodStart, monthlyLimit }
    });
  } else if (quota.monthlyLimit !== monthlyLimit) {
    quota = await prisma.toolQuota.update({
      where: { userId_tier: { userId, tier } },
      data: { monthlyLimit }
    });
  }

  return quota;
}

/**
 * Express middleware factory.
 *
 * Usage:
 *   router.all('/*', authenticateToken, checkToolQuota('virustotal'), async (req, res) => { ... })
 *
 * @param {string} toolName - key in TOOL_TIER_MAP (e.g. 'virustotal')
 * @param {Function} [keyModeResolver] - optional fn(req) returning 'hub' or 'byok'.
 *   Defaults to always 'hub'. Proxy routes that support BYOK can pass their own resolver.
 */
export function checkToolQuota(toolName, keyModeResolver = () => 'hub') {
  return async (req, res, next) => {
    const keyMode = keyModeResolver(req);

    // BYOK: user supplies their own key, no platform quota consumed
    if (keyMode === 'byok') {
      req.toolMeta = { toolName, tier: TOOL_TIER_MAP[toolName], keyMode: 'byok' };
      return next();
    }

    const tier = TOOL_TIER_MAP[toolName];
    if (!tier) {
      // Unknown tool — treat as X tier (free, no quota gate)
      req.toolMeta = { toolName, tier: null, keyMode: 'hub' };
      return next();
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Resolve user plan
    let userPlan = 'BASE';
    try {
      const subscription = await prisma.subscription.findFirst({
        where: { userId, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' }
      });
      if (subscription?.plan) userPlan = subscription.plan;
    } catch (err) {
      logger.warn(`[ToolQuota] Could not resolve plan for ${userId}: ${err.message}`);
    }

    const monthlyLimit = getMonthlyLimit(userPlan, tier);
    let quota;
    try {
      quota = await ensureQuotaRow(userId, tier, monthlyLimit);
    } catch (err) {
      logger.error(`[ToolQuota] DB error for ${userId}/${tier}: ${err.message}`);
      // Fail open to avoid blocking legitimate users on DB hiccups
      req.toolMeta = { toolName, tier, keyMode: 'hub', skipRecord: true };
      return next();
    }

    if (quota.usedThisMonth >= quota.monthlyLimit) {
      return res.status(429).json({
        error: 'Tool quota exceeded',
        tier,
        toolName,
        used: quota.usedThisMonth,
        limit: quota.monthlyLimit,
        message: `您本月 ${tier} 梯队工具额度已用尽 (${quota.usedThisMonth}/${quota.monthlyLimit})。请升级套餐或购买额外包。`
      });
    }

    req.toolMeta = { toolName, tier, keyMode: 'hub', quotaId: quota.id };
    next();
  };
}

/**
 * Records one tool call and increments the quota counter.
 * Call this AFTER the upstream request succeeds (fire-and-forget).
 *
 * @param {Request} req - Express request (must have req.user and req.toolMeta)
 * @param {string} [endpoint] - Optional endpoint path for logging
 */
export async function recordToolUsage(req, endpoint) {
  const meta = req.toolMeta;
  if (!meta || meta.skipRecord) return;

  const userId = req.user?.id;
  if (!userId) return;

  const { toolName, tier, keyMode, quotaId } = meta;

  try {
    await prisma.$transaction([
      prisma.toolUsageRecord.create({
        data: {
          userId,
          toolName,
          tier: tier || 'C',
          keyMode: keyMode || 'hub',
          endpoint: endpoint || null
        }
      }),
      ...(keyMode === 'hub' && quotaId
        ? [prisma.toolQuota.update({
            where: { id: quotaId },
            data: { usedThisMonth: { increment: 1 } }
          })]
        : [])
    ]);
  } catch (err) {
    logger.debug(`[ToolQuota] Usage record failed for ${userId}/${toolName}: ${err.message}`);
  }
}
