import { prisma } from '../config/database.js';
import { TOOL_TIER_QUOTA, PLAN_LIMITS } from '../config/constants.js';
import logger from '../utils/logger.js';
import { writeAudit, AUDIT_ACTIONS, RESOURCE_TYPES } from '../utils/auditLog.js';
import { deductUsd } from '../utils/usdBalance.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// In-memory cache: toolName -> { toolTier, unitPriceUsd }
// Populated on first use, refreshable via refreshToolPricing().
// ---------------------------------------------------------------------------
let _toolPricingCache = null;

async function getToolPricing() {
  if (_toolPricingCache) return _toolPricingCache;
  return refreshToolPricing();
}

export async function refreshToolPricing() {
  const servers = await prisma.mcpServer.findMany({
    where: { isActive: true },
    select: { id: true, name: true, toolTier: true, unitPriceUsd: true },
  });

  const map = {};
  for (const s of servers) {
    const key = s.name.toLowerCase();
    map[key] = { toolTier: s.toolTier || 'X', unitPriceUsd: s.unitPriceUsd ?? 0 };
  }
  _toolPricingCache = map;
  return map;
}

/**
 * Sync toolTier + unitPriceUsd from integration config.js files into McpServer
 * records that are missing these fields.  Called once at startup.
 */
export async function syncToolPricingFromConfigs() {
  try {
    const integrationsDir = path.resolve(__dirname, '../../integrations');
    if (!fs.existsSync(integrationsDir)) return;

    const dirs = fs.readdirSync(integrationsDir).filter(d => !d.startsWith('_') && !d.startsWith('.'));

    for (const dir of dirs) {
      const cfgPath = path.join(integrationsDir, dir, 'config.js');
      if (!fs.existsSync(cfgPath)) continue;

      try {
        const mod = await import(pathToFileURL(cfgPath).href);
        const cfg = mod.default;
        if (!cfg?.name || cfg.toolTier == null) continue;

        const existing = await prisma.mcpServer.findFirst({ where: { name: cfg.name } });
        if (!existing) continue;

        const needsUpdate =
          existing.toolTier !== cfg.toolTier ||
          (existing.unitPriceUsd ?? 0) !== (cfg.unitPriceUsd ?? 0);

        if (needsUpdate) {
          await prisma.mcpServer.update({
            where: { id: existing.id },
            data: {
              toolTier: cfg.toolTier,
              unitPriceUsd: cfg.unitPriceUsd ?? 0,
            },
          });
          logger.info(`[ToolPricing] Synced ${cfg.name}: tier=${cfg.toolTier}, price=$${cfg.unitPriceUsd ?? 0}`);
        }
      } catch (e) {
        logger.debug(`[ToolPricing] Skip ${dir}: ${e.message}`);
      }
    }

    _toolPricingCache = null;
  } catch (err) {
    logger.warn(`[ToolPricing] Config sync failed: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCurrentPeriodStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function getMonthlyLimit(userPlan, tier) {
  const plan = userPlan || 'BASE';
  const quotaMap = TOOL_TIER_QUOTA[plan] || TOOL_TIER_QUOTA.BASE;
  return quotaMap[tier] ?? 0;
}

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

// ---------------------------------------------------------------------------
// Middleware factory
// ---------------------------------------------------------------------------

/**
 * @param {string} toolName - key that matches the integration name (lowercase)
 * @param {Function} [keyModeResolver] - fn(req) returning 'hub' | 'byok'
 */
export function checkToolQuota(toolName, keyModeResolver = () => 'hub') {
  return async (req, res, next) => {
    const keyMode = keyModeResolver(req);

    if (keyMode === 'byok') {
      req.toolMeta = { toolName, tier: null, keyMode: 'byok', chargeUsd: 0 };
      return next();
    }

    const pricing = await getToolPricing();
    const info = pricing[toolName] || { toolTier: 'X', unitPriceUsd: 0 };
    const tier = info.toolTier;

    if (tier === 'X') {
      req.toolMeta = { toolName, tier: 'X', keyMode: 'hub', chargeUsd: 0 };
      return next();
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let userPlan = 'BASE';
    try {
      const subscription = await prisma.subscription.findFirst({
        where: { userId, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' }
      });
      if (subscription?.plan) userPlan = subscription.plan;
      else if (subscription?.planName) userPlan = subscription.planName;
    } catch (err) {
      logger.warn(`[ToolQuota] Could not resolve plan for ${userId}: ${err.message}`);
    }

    const monthlyLimit = getMonthlyLimit(userPlan, tier);
    let quota;
    try {
      quota = await ensureQuotaRow(userId, tier, monthlyLimit);
    } catch (err) {
      logger.error(`[ToolQuota] DB error for ${userId}/${tier}: ${err.message}`);
      req.toolMeta = { toolName, tier, keyMode: 'hub', skipRecord: true, chargeUsd: 0 };
      return next();
    }

    const effectiveLimit = quota.monthlyLimit + (quota.extraCalls || 0);

    if (quota.usedThisMonth < effectiveLimit) {
      req.toolMeta = { toolName, tier, keyMode: 'hub', quotaId: quota.id, chargeUsd: 0 };
      return next();
    }

    // Free quota exhausted — fall through to USD balance if unitPriceUsd > 0
    const unitPrice = info.unitPriceUsd;

    if (unitPrice <= 0) {
      writeAudit(req, {
        userId,
        action: AUDIT_ACTIONS.TOOL_QUOTA_EXCEEDED,
        resourceType: RESOURCE_TYPES.TOOL,
        resourceId: toolName,
        metadata: { tier, used: quota.usedThisMonth, limit: effectiveLimit },
      });
      return res.status(429).json({
        error: 'Tool quota exceeded',
        tier, toolName,
        used: quota.usedThisMonth,
        limit: effectiveLimit,
        message: `Monthly ${tier}-tier tool quota exhausted (${quota.usedThisMonth}/${effectiveLimit}). Please upgrade or top up your balance.`
      });
    }

    // Check USD balance
    let user;
    try {
      user = await prisma.user.findUnique({ where: { id: userId }, select: { usdBalance: true } });
    } catch (err) {
      logger.error(`[ToolQuota] Balance check error for ${userId}: ${err.message}`);
      req.toolMeta = { toolName, tier, keyMode: 'hub', skipRecord: true, chargeUsd: 0 };
      return next();
    }

    const balance = user ? Number(user.usdBalance) : 0;
    if (balance < unitPrice) {
      return res.status(402).json({
        error: 'Insufficient balance',
        toolName,
        unitPriceUsd: unitPrice,
        currentBalance: balance,
        message: `Free quota exhausted and insufficient USD balance ($${balance.toFixed(2)}). Each ${toolName} call costs $${unitPrice}. Please top up your balance.`
      });
    }

    req.toolMeta = { toolName, tier, keyMode: 'hub', quotaId: quota.id, chargeUsd: unitPrice };
    next();
  };
}

// ---------------------------------------------------------------------------
// Post-call usage recorder
// ---------------------------------------------------------------------------

/**
 * Records one tool call, increments quota counter (if still in free tier),
 * and deducts USD balance if chargeUsd > 0.
 */
export async function recordToolUsage(req, endpoint) {
  const meta = req.toolMeta;
  if (!meta || meta.skipRecord) return;

  const userId = req.user?.id;
  if (!userId) return;

  const { toolName, tier, keyMode, quotaId, chargeUsd } = meta;

  try {
    const txOps = [
      prisma.toolUsageRecord.create({
        data: {
          userId,
          toolName,
          tier: tier || 'C',
          keyMode: keyMode || 'hub',
          endpoint: endpoint || null,
          chargedUsd: chargeUsd || 0,
        }
      }),
    ];

    if (keyMode === 'hub' && quotaId && chargeUsd <= 0) {
      txOps.push(prisma.toolQuota.update({
        where: { id: quotaId },
        data: { usedThisMonth: { increment: 1 } }
      }));
    }

    await prisma.$transaction(txOps);

    if (chargeUsd > 0) {
      await deductUsd(userId, chargeUsd, 'tool_charge', 'tool_usage_record', toolName, { toolName, endpoint });
    }

    writeAudit(req, {
      userId,
      action: AUDIT_ACTIONS.TOOL_CALL,
      resourceType: RESOURCE_TYPES.TOOL,
      resourceId: toolName,
      metadata: { tier: tier || 'C', keyMode: keyMode || 'hub', endpoint: endpoint || null, chargedUsd: chargeUsd || 0 },
    });
  } catch (err) {
    logger.debug(`[ToolQuota] Usage record failed for ${userId}/${toolName}: ${err.message}`);
  }
}
