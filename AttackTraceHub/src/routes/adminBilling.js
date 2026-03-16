import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { createResponse } from '../config/constants.js';
import { prisma } from '../config/database.js';
import logger from '../utils/logger.js';

const router = express.Router();

// GET /api/v1/admin/billing/summary
router.get('/summary', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { range = '30d' } = req.query;
    const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const startOfMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));

    // All balance transactions in range
    const transactions = await prisma.balanceTransaction.findMany({
      where: { createdAt: { gte: since } },
      select: { type: true, amountUsd: true, createdAt: true },
    });

    let totalTopups = 0;
    let totalAutoTopups = 0;
    let totalModelCharges = 0;
    let totalToolCharges = 0;

    const dailyMap = {};

    for (const t of transactions) {
      const amt = Number(t.amountUsd);
      const day = t.createdAt.toISOString().slice(0, 10);
      if (!dailyMap[day]) dailyMap[day] = { date: day, topups: 0, charges: 0 };

      if (t.type === 'topup') { totalTopups += amt; dailyMap[day].topups += amt; }
      else if (t.type === 'auto_topup') { totalAutoTopups += amt; dailyMap[day].topups += amt; }
      else if (t.type === 'model_charge') { totalModelCharges += Math.abs(amt); dailyMap[day].charges += Math.abs(amt); }
      else if (t.type === 'tool_charge') { totalToolCharges += Math.abs(amt); dailyMap[day].charges += Math.abs(amt); }
    }

    const daily = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

    // This month's totals
    const monthlyTxns = transactions.filter(t => t.createdAt >= startOfMonth);
    let monthTopups = 0;
    let monthCharges = 0;
    for (const t of monthlyTxns) {
      const amt = Number(t.amountUsd);
      if (t.type === 'topup' || t.type === 'auto_topup') monthTopups += amt;
      else monthCharges += Math.abs(amt);
    }

    // Active users (users who have any BalanceTransaction in range)
    const activeUserIds = new Set(
      (await prisma.balanceTransaction.findMany({
        where: { createdAt: { gte: since } },
        select: { userId: true },
        distinct: ['userId'],
      })).map(r => r.userId)
    );

    res.json(createResponse({
      range,
      totalTopups: +totalTopups.toFixed(4),
      totalAutoTopups: +totalAutoTopups.toFixed(4),
      totalModelCharges: +totalModelCharges.toFixed(4),
      totalToolCharges: +totalToolCharges.toFixed(4),
      monthTopups: +monthTopups.toFixed(4),
      monthCharges: +monthCharges.toFixed(4),
      activeUsers: activeUserIds.size,
      daily,
    }));
  } catch (error) {
    logger.error('Error fetching billing summary:', error);
    res.status(500).json(createResponse(null, 'Failed to fetch billing summary'));
  }
});

// GET /api/v1/admin/billing/users
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const startOfMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        usdBalance: true,
        monthlySpendCapUsd: true,
        role: true,
        Subscription: { select: { planName: true } },
      },
      orderBy: { usdBalance: 'desc' },
    });

    // Per-user monthly charges
    const monthlyCharges = await prisma.balanceTransaction.groupBy({
      by: ['userId', 'type'],
      where: {
        createdAt: { gte: startOfMonth },
        type: { in: ['model_charge', 'tool_charge', 'topup', 'auto_topup'] },
      },
      _sum: { amountUsd: true },
    });

    const chargeMap = {};
    for (const row of monthlyCharges) {
      if (!chargeMap[row.userId]) chargeMap[row.userId] = { modelCharged: 0, toolCharged: 0, topups: 0 };
      const amt = Math.abs(Number(row._sum.amountUsd));
      if (row.type === 'model_charge') chargeMap[row.userId].modelCharged = amt;
      else if (row.type === 'tool_charge') chargeMap[row.userId].toolCharged = amt;
      else chargeMap[row.userId].topups = Number(row._sum.amountUsd);
    }

    const result = users.map(u => ({
      id: u.id,
      email: u.email,
      username: u.username,
      plan: u.Subscription?.planName || 'BASE',
      usdBalance: Number(u.usdBalance),
      monthlySpendCapUsd: u.monthlySpendCapUsd !== null ? Number(u.monthlySpendCapUsd) : null,
      monthModelCharged: chargeMap[u.id]?.modelCharged ?? 0,
      monthToolCharged: chargeMap[u.id]?.toolCharged ?? 0,
      monthTopups: chargeMap[u.id]?.topups ?? 0,
      monthTotal: (chargeMap[u.id]?.modelCharged ?? 0) + (chargeMap[u.id]?.toolCharged ?? 0),
    }));

    result.sort((a, b) => b.monthTotal - a.monthTotal);

    res.json(createResponse(result));
  } catch (error) {
    logger.error('Error fetching billing users:', error);
    res.status(500).json(createResponse(null, 'Failed to fetch billing users'));
  }
});

// GET /api/v1/admin/billing/users/:userId/transactions
router.get('/users/:userId/transactions', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const [transactions, total] = await Promise.all([
      prisma.balanceTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset),
        select: {
          id: true,
          type: true,
          amountUsd: true,
          balanceBefore: true,
          balanceAfter: true,
          referenceType: true,
          referenceId: true,
          metadata: true,
          createdAt: true,
        },
      }),
      prisma.balanceTransaction.count({ where: { userId } }),
    ]);

    const result = transactions.map(t => ({
      ...t,
      amountUsd: Number(t.amountUsd),
      balanceBefore: Number(t.balanceBefore),
      balanceAfter: Number(t.balanceAfter),
    }));

    res.json(createResponse({ transactions: result, total }));
  } catch (error) {
    logger.error('Error fetching user transactions:', error);
    res.status(500).json(createResponse(null, 'Failed to fetch transactions'));
  }
});

// PATCH /api/v1/admin/billing/users/:userId/spend-cap
router.patch('/users/:userId/spend-cap', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { monthlySpendCapUsd } = req.body;

    const cap = monthlySpendCapUsd === null || monthlySpendCapUsd === undefined
      ? null
      : parseFloat(monthlySpendCapUsd);

    if (cap !== null && (isNaN(cap) || cap < 0)) {
      return res.status(400).json(createResponse(null, 'Invalid spending cap value'));
    }

    await prisma.user.update({
      where: { id: userId },
      data: { monthlySpendCapUsd: cap },
    });

    logger.info(`[Admin] Set spending cap for user ${userId} to ${cap === null ? 'unlimited' : `$${cap}`}`);
    res.json(createResponse({ userId, monthlySpendCapUsd: cap }));
  } catch (error) {
    logger.error('Error updating spend cap:', error);
    res.status(500).json(createResponse(null, 'Failed to update spending cap'));
  }
});

export default router;
