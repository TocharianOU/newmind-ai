import express from 'express';
import { prisma } from '../config/database.js';
import { createResponse } from '../config/constants.js';
import { authenticateToken } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const router = express.Router();

// GET /api/v1/user/me - Get current user info (Dive requirement)
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { 
        subscription: true 
      }
    });

    if (!user) {
      return res.status(404).json(createResponse(null, 'User not found'));
    }

    // Format response to match Dive's OAPUser interface
    const userData = {
      id: user.id,
      email: user.email,
      username: user.username,
      picture: user.picture || '',
      team: user.team || '',
      subscription: {
        PlanName: user.subscription?.planName || 'BASE',
        IsDefaultPlan: user.subscription?.isDefaultPlan || true,
        StartDate: user.subscription?.startDate?.toISOString() || new Date().toISOString(),
        Start: user.subscription?.startDate?.toISOString() || new Date().toISOString(),
        End: user.subscription?.endDate?.toISOString() || null,
        NextBillingDate: user.subscription?.nextBillingDate?.toISOString() || null
      }
    };

    res.json(createResponse(userData));
  } catch (error) {
    logger.error('Error fetching user info:', error);
    res.status(500).json(createResponse(null, 'Failed to fetch user info'));
  }
});

// GET /api/v1/user/usage - Get user usage statistics (Dive requirement)
router.get('/usage', authenticateToken, async (req, res) => {
  try {
    // Get user's plan limits
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { subscription: true }
    });

    const planName = user?.subscription?.planName || 'BASE';
    
    // Calculate usage for current month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const usageRecords = await prisma.usageRecord.findMany({
      where: {
        userId: req.user.id,
        createdAt: {
          gte: startOfMonth
        }
      }
    });

    // Calculate total tokens
    const totalTokens = usageRecords.reduce((acc, record) => {
      return acc + record.inputTokens + record.outputTokens;
    }, 0);

    // Get plan limits from constants - convert daily to monthly
    const { PLAN_LIMITS } = await import('../config/constants.js');
    const dailyLimit = PLAN_LIMITS[planName]?.dailyTokens || PLAN_LIMITS.BASE.dailyTokens;
    const monthlyLimit = dailyLimit * 30; // Convert daily to monthly

    // Separate model and MCP usage (temporary - should track separately)
    // For now, assume all usage is model usage since proxy only handles model calls
    const modelUsage = totalTokens;
    const mcpUsage = 0; // TODO: Track MCP usage separately

    // Format response to match Dive's OAPUsage interface
    const usageData = {
      limit: monthlyLimit,
      mcp: mcpUsage,
      model: modelUsage,
      total: totalTokens,
      coupon: {
        // TODO: Implement token package tracking
        // Token packages are pre-purchased credits that don't expire
        // Should track separately from monthly subscription limits
        model: 0,
        mcp: 0,
        total: 0,
        limit: 0
      }
    };

    res.json(createResponse(usageData));
  } catch (error) {
    logger.error('Error fetching usage:', error);
    res.status(500).json(createResponse(null, 'Failed to fetch usage'));
  }
});

// POST /api/v1/user/logout - Logout user (Dive requirement)
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // Delete all refresh tokens for the user
    await prisma.refreshToken.deleteMany({
      where: { userId: req.user.id }
    });

    logger.info(`User logged out: ${req.user.email}`);

    res.json(createResponse({ message: 'Logged out successfully' }));
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json(createResponse(null, 'Logout failed'));
  }
});

export default router;
