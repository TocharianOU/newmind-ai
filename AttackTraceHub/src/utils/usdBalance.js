import { prisma } from '../config/database.js';
import { Prisma } from '@prisma/client';
import logger from './logger.js';
import { writeAudit, AUDIT_ACTIONS, RESOURCE_TYPES } from './auditLog.js';

// Dynamic import breaks the potential autoTopUp ↔ usdBalance circular reference
function _triggerAutoTopUpCheck(userId, balanceAfter) {
  setImmediate(async () => {
    try {
      const { maybeAutoTopUp } = await import('./autoTopUp.js');
      await maybeAutoTopUp(userId, balanceAfter);
    } catch (err) {
      logger.warn(`[AutoTopUp] Trigger check failed for user ${userId}: ${err.message}`);
    }
  });
}

/**
 * Add USD to a user's balance inside a serialisable transaction so the
 * balanceBefore / balanceAfter ledger stays consistent.
 *
 * @returns {{ balanceBefore: number, balanceAfter: number }}
 */
export async function addUsd(userId, amountUsd, type, referenceType = null, referenceId = null, metadata = null) {
  const amount = new Prisma.Decimal(amountUsd);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { usdBalance: true },
    });

    const balanceBefore = user.usdBalance;
    const balanceAfter = balanceBefore.add(amount);

    await tx.user.update({
      where: { id: userId },
      data: { usdBalance: balanceAfter },
    });

    await tx.balanceTransaction.create({
      data: {
        userId,
        type,
        amountUsd: amount,
        balanceBefore,
        balanceAfter,
        referenceType,
        referenceId,
        metadata,
      },
    });

    return { balanceBefore: Number(balanceBefore), balanceAfter: Number(balanceAfter) };
  });

  writeAudit(null, {
    userId,
    action: AUDIT_ACTIONS.USD_TOPUP,
    resourceType: RESOURCE_TYPES.BALANCE,
    metadata: { amountUsd: Number(amount), type, referenceType, referenceId, ...result },
  });

  logger.info(`[Balance] +$${amountUsd} for user ${userId} (${type}), new balance $${result.balanceAfter}`);
  return result;
}

/**
 * Deduct USD from a user's balance. Throws if insufficient funds or monthly cap exceeded.
 *
 * @returns {{ balanceBefore: number, balanceAfter: number }}
 */
export async function deductUsd(userId, amountUsd, type, referenceType = null, referenceId = null, metadata = null) {
  const amount = new Prisma.Decimal(amountUsd);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { usdBalance: true, monthlySpendCapUsd: true },
    });

    // Spending cap enforcement
    if (user.monthlySpendCapUsd !== null) {
      const startOfMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
      const agg = await tx.balanceTransaction.aggregate({
        where: {
          userId,
          createdAt: { gte: startOfMonth },
          type: { in: ['model_charge', 'tool_charge'] },
        },
        _sum: { amountUsd: true },
      });
      const spentThisMonth = Math.abs(Number(agg._sum.amountUsd ?? 0));
      if (new Prisma.Decimal(spentThisMonth).add(amount).greaterThan(user.monthlySpendCapUsd)) {
        throw new Error('Monthly spending cap exceeded');
      }
    }

    const balanceBefore = user.usdBalance;
    if (balanceBefore.lessThan(amount)) {
      throw new Error('Insufficient USD balance');
    }

    const balanceAfter = balanceBefore.sub(amount);

    await tx.user.update({
      where: { id: userId },
      data: { usdBalance: balanceAfter },
    });

    await tx.balanceTransaction.create({
      data: {
        userId,
        type,
        amountUsd: amount.negated(),
        balanceBefore,
        balanceAfter,
        referenceType,
        referenceId,
        metadata,
      },
    });

    return { balanceBefore: Number(balanceBefore), balanceAfter: Number(balanceAfter) };
  });

  writeAudit(null, {
    userId,
    action: AUDIT_ACTIONS.USD_CHARGED,
    resourceType: RESOURCE_TYPES.BALANCE,
    metadata: { amountUsd: Number(amount), type, referenceType, referenceId, ...result },
  });

  logger.debug(`[Balance] -$${amountUsd} for user ${userId} (${type}), new balance $${result.balanceAfter}`);

  // Fire-and-forget: check if auto top-up or low-balance email should trigger
  _triggerAutoTopUpCheck(userId, result.balanceAfter);

  return result;
}

/**
 * @returns {number} Current USD balance
 */
export async function checkUsdBalance(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { usdBalance: true },
  });
  return user ? Number(user.usdBalance) : 0;
}

/**
 * @returns {{ spent: number, cap: number|null }}
 */
export async function getMonthlySpend(userId) {
  const startOfMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const [agg, user] = await Promise.all([
    prisma.balanceTransaction.aggregate({
      where: {
        userId,
        createdAt: { gte: startOfMonth },
        type: { in: ['model_charge', 'tool_charge'] },
      },
      _sum: { amountUsd: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { monthlySpendCapUsd: true } }),
  ]);
  return {
    spent: Math.abs(Number(agg._sum.amountUsd ?? 0)),
    cap: user?.monthlySpendCapUsd !== null ? Number(user.monthlySpendCapUsd) : null,
  };
}
