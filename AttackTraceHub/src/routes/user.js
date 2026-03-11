import express from 'express';
import { prisma } from '../config/database.js';
import { createResponse, TOOL_TIER_QUOTA, TOOL_TIER_MAP } from '../config/constants.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { writeAudit, AUDIT_ACTIONS, RESOURCE_TYPES } from '../utils/auditLog.js';
import featureFlags from '../config/featureFlags.js';
import { getLicenseStatus } from '../license/validator.js';
import logger from '../utils/logger.js';
import { validateBody } from '../middleware/validate.js';
import { UpdateSettingsSchema, UpdatePreferencesSchema } from '../schemas/user.schemas.js';

const router = express.Router();

// GET /api/v1/user/me - Get current user info (Dive requirement)
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        Subscription: true
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
      role: user.role,
      tokenBalance: user.tokenBalance || 0,
      subscription: {
        PlanName: user.Subscription?.planName || 'BASE',
        IsDefaultPlan: user.Subscription?.isDefaultPlan || true,
        StartDate: user.Subscription?.startDate?.toISOString() || new Date().toISOString(),
        Start: user.Subscription?.startDate?.toISOString() || new Date().toISOString(),
        End: user.Subscription?.endDate?.toISOString() || null,
        NextBillingDate: user.Subscription?.nextBillingDate?.toISOString() || null
      },
      deploymentMode: featureFlags.DEPLOYMENT_MODE,
    };

    // Enterprise: enrich with license plan info
    if (featureFlags.LICENSE_ENABLED) {
      const { status, license } = await getLicenseStatus();
      userData.enterpriseLicense = {
        status,
        customerName: license?.customerName || null,
        maxSeats: license?.maxSeats || 0,
        maxTokens: license ? Number(license.maxTokens) : 0,
        expiresAt: license?.expiresAt || null,
        features: license?.features || [],
      };
    }

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
      include: { Subscription: true }
    });

    const planName = user?.Subscription?.planName || 'BASE';

    // Calculate usage for current month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const usageRecords = await prisma.usageRecord.findMany({
      where: {
        userId: req.user.id,
        createdAt: { gte: startOfMonth }
      }
    });

    const totalTokens = usageRecords.reduce((acc, r) => acc + r.inputTokens + r.outputTokens, 0);

    let limit;
    let enterpriseQuota = null;

    if (featureFlags.LICENSE_ENABLED) {
      // Enterprise: limit comes from license maxTokens (global pool)
      const { status, license } = await getLicenseStatus();
      const maxTokens = license ? Number(license.maxTokens) : 0;
      limit = maxTokens > 0 ? maxTokens : Number.MAX_SAFE_INTEGER;

      // Global usage across all users
      const globalAggregate = await prisma.usageRecord.aggregate({
        _sum: { inputTokens: true, outputTokens: true },
      });
      const globalUsed = (globalAggregate._sum.inputTokens || 0) + (globalAggregate._sum.outputTokens || 0);

      const userCount = await prisma.user.count();
      enterpriseQuota = {
        status,
        maxSeats: license?.maxSeats || 0,
        currentSeats: userCount,
        maxTokens,
        globalUsedTokens: globalUsed,
        expiresAt: license?.expiresAt || null,
      };
    } else {
      // SaaS: daily limit from subscription plan
      const { PLAN_LIMITS } = await import('../config/constants.js');
      const dailyLimit = PLAN_LIMITS[planName]?.dailyTokens || PLAN_LIMITS.BASE.dailyTokens;
      limit = dailyLimit * 30;
    }

    const usageData = {
      limit,
      mcp: 0,
      model: totalTokens,
      total: totalTokens,
      coupon: { model: 0, mcp: 0, total: 0, limit: 0 },
      ...(enterpriseQuota ? { enterpriseQuota } : {}),
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

    await writeAudit(req, {
      userId: req.user.id,
      action: AUDIT_ACTIONS.LOGOUT,
      resourceType: RESOURCE_TYPES.AUTH,
      resourceId: req.user.id,
      metadata: { email: req.user.email },
    });

    res.json(createResponse({ message: 'Logged out successfully' }));
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json(createResponse(null, 'Logout failed'));
  }
});

// GET /api/v1/user/settings - Get user settings
router.get('/settings', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        username: true,
        picture: true,
        team: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      return res.status(404).json(createResponse(null, 'User not found'));
    }

    res.json(createResponse(user));
  } catch (error) {
    logger.error('Error fetching user settings:', error);
    res.status(500).json(createResponse(null, 'Failed to fetch user settings'));
  }
});

// PUT /api/v1/user/settings - Update user settings
router.put('/settings', authenticateToken, validateBody(UpdateSettingsSchema), async (req, res) => {
  try {
    const { username, picture, team } = req.body;

    const updateData = {};
    if (username !== undefined) updateData.username = username;
    if (picture !== undefined) updateData.picture = picture;
    if (team !== undefined) updateData.team = team;

    // Check if username is already taken by another user
    if (username) {
      const existingUser = await prisma.user.findFirst({
        where: {
          username,
          id: { not: req.user.id }
        }
      });

      if (existingUser) {
        return res.status(400).json(createResponse(null, 'Username already taken'));
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        username: true,
        picture: true,
        team: true,
        updatedAt: true
      }
    });

    logger.info(`User settings updated: ${req.user.email}`);

    res.json(createResponse(updatedUser));
  } catch (error) {
    logger.error('Error updating user settings:', error);
    res.status(500).json(createResponse(null, 'Failed to update user settings'));
  }
});

// GET /api/v1/user/preferences - Get user preferences
router.get('/preferences', authenticateToken, async (req, res) => {
  try {
    let preferences = await prisma.userPreferences.findUnique({
      where: { userId: req.user.id }
    });

    // Create default preferences if none exist
    if (!preferences) {
      preferences = await prisma.userPreferences.create({
        data: {
          userId: req.user.id,
          theme: 'light',
          language: 'en',
          notifications: true,
          emailNotifications: true
        }
      });
    }

    res.json(createResponse(preferences));
  } catch (error) {
    logger.error('Error fetching user preferences:', error);
    res.status(500).json(createResponse(null, 'Failed to fetch user preferences'));
  }
});

// PUT /api/v1/user/preferences - Update user preferences
router.put('/preferences', authenticateToken, validateBody(UpdatePreferencesSchema), async (req, res) => {
  try {
    const { theme, language, notifications, emailNotifications } = req.body;

    const updateData = {};
    if (theme !== undefined) updateData.theme = theme;
    if (language !== undefined) updateData.language = language;
    if (notifications !== undefined) updateData.notifications = notifications;
    if (emailNotifications !== undefined) updateData.emailNotifications = emailNotifications;

    const preferences = await prisma.userPreferences.upsert({
      where: { userId: req.user.id },
      update: updateData,
      create: {
        userId: req.user.id,
        theme: theme || 'light',
        language: language || 'en',
        notifications: notifications !== undefined ? notifications : true,
        emailNotifications: emailNotifications !== undefined ? emailNotifications : true
      }
    });

    logger.info(`User preferences updated: ${req.user.email}`);

    res.json(createResponse(preferences));
  } catch (error) {
    logger.error('Error updating user preferences:', error);
    res.status(500).json(createResponse(null, 'Failed to update user preferences'));
  }
});

// GET /api/v1/user/stats - Get user statistics for dashboard
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const { range = '30d' } = req.query;

    // Calculate date range
    const now = new Date();
    let startDate = new Date();

    switch (range) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      case 'all':
        startDate = new Date(0); // Beginning of time
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }

    // Get usage records
    const usageRecords = await prisma.usageRecord.findMany({
      where: {
        userId: req.user.id,
        createdAt: {
          gte: startDate
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    // Calculate statistics
    const totalCalls = usageRecords.length;
    const totalTokens = usageRecords.reduce((acc, record) => {
      return acc + record.inputTokens + record.outputTokens;
    }, 0);
    const totalInputTokens = usageRecords.reduce((acc, record) => acc + record.inputTokens, 0);
    const totalOutputTokens = usageRecords.reduce((acc, record) => acc + record.outputTokens, 0);

    // Group by model
    const modelStats = {};
    usageRecords.forEach(record => {
      if (!modelStats[record.modelName]) {
        modelStats[record.modelName] = {
          calls: 0,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0
        };
      }
      modelStats[record.modelName].calls++;
      modelStats[record.modelName].inputTokens += record.inputTokens;
      modelStats[record.modelName].outputTokens += record.outputTokens;
      modelStats[record.modelName].totalTokens += record.inputTokens + record.outputTokens;
    });

    // Group by date for chart data
    const dailyUsage = {};
    usageRecords.forEach(record => {
      const date = record.createdAt.toISOString().split('T')[0];
      if (!dailyUsage[date]) {
        dailyUsage[date] = {
          date,
          calls: 0,
          tokens: 0
        };
      }
      dailyUsage[date].calls++;
      dailyUsage[date].tokens += record.inputTokens + record.outputTokens;
    });

    const stats = {
      summary: {
        totalCalls,
        totalTokens,
        totalInputTokens,
        totalOutputTokens,
        averageTokensPerCall: totalCalls > 0 ? Math.round(totalTokens / totalCalls) : 0
      },
      modelStats: Object.entries(modelStats).map(([model, stats]) => ({
        model,
        ...stats
      })),
      dailyUsage: Object.values(dailyUsage),
      range,
      startDate: startDate.toISOString(),
      endDate: now.toISOString()
    };

    res.json(createResponse(stats));
  } catch (error) {
    logger.error('Error fetching user stats:', error);
    res.status(500).json(createResponse(null, 'Failed to fetch user stats'));
  }
});

// GET /api/v1/user/admin/users - Get all users list (enterprise only)
router.get('/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {

    // Get all users with their subscription info
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        picture: true,
        team: true,
        createdAt: true,
        Subscription: {
          select: {
            planName: true,
            startDate: true,
            endDate: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Get usage count for each user in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const usersWithUsage = await Promise.all(users.map(async (user) => {
      const usageCount = await prisma.usageRecord.count({
        where: {
          userId: user.id,
          createdAt: {
            gte: thirtyDaysAgo
          }
        }
      });

      const totalTokens = await prisma.usageRecord.aggregate({
        where: {
          userId: user.id,
          createdAt: {
            gte: thirtyDaysAgo
          }
        },
        _sum: {
          inputTokens: true,
          outputTokens: true
        }
      });

      return {
        ...user,
        usage30d: {
          calls: usageCount,
          totalTokens: (totalTokens._sum.inputTokens || 0) + (totalTokens._sum.outputTokens || 0)
        }
      };
    }));

    logger.info(`Admin users list accessed by ${req.user.email}`);
    await writeAudit(req, {
      userId: req.user.id,
      action: AUDIT_ACTIONS.ADMIN_LIST_USERS,
      resourceType: RESOURCE_TYPES.ADMIN,
      metadata: { userCount: usersWithUsage.length },
    });
    res.json(createResponse(usersWithUsage));
  } catch (error) {
    logger.error('Error fetching admin users:', error);
    res.status(500).json(createResponse(null, 'Failed to fetch users'));
  }
});

// GET /api/v1/user/admin/users/:userId/stats - Get specific user statistics (enterprise only)
router.get('/admin/users/:userId/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {

    const { userId } = req.params;
    const { range = '30d' } = req.query;

    // Check if user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        picture: true,
        team: true,
        createdAt: true,
        Subscription: {
          select: {
            planName: true,
            startDate: true,
            endDate: true
          }
        }
      }
    });

    if (!targetUser) {
      return res.status(404).json(createResponse(null, 'User not found'));
    }

    // Calculate date range
    const now = new Date();
    let startDate = new Date();

    switch (range) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      case 'all':
        startDate = new Date(0);
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }

    // Get usage records for the specific user
    const usageRecords = await prisma.usageRecord.findMany({
      where: {
        userId: userId,
        createdAt: {
          gte: startDate
        }
      },
      select: {
        modelName: true,
        inputTokens: true,
        outputTokens: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    // Calculate statistics
    const totalCalls = usageRecords.length;
    const totalTokens = usageRecords.reduce((acc, record) => {
      return acc + record.inputTokens + record.outputTokens;
    }, 0);
    const totalInputTokens = usageRecords.reduce((acc, record) => acc + record.inputTokens, 0);
    const totalOutputTokens = usageRecords.reduce((acc, record) => acc + record.outputTokens, 0);

    // Group by model
    const modelStats = {};
    usageRecords.forEach(record => {
      if (!modelStats[record.modelName]) {
        modelStats[record.modelName] = {
          calls: 0,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0
        };
      }
      modelStats[record.modelName].calls++;
      modelStats[record.modelName].inputTokens += record.inputTokens;
      modelStats[record.modelName].outputTokens += record.outputTokens;
      modelStats[record.modelName].totalTokens += record.inputTokens + record.outputTokens;
    });

    // Group by date for chart data
    const dailyUsage = {};
    usageRecords.forEach(record => {
      const date = record.createdAt.toISOString().split('T')[0];
      if (!dailyUsage[date]) {
        dailyUsage[date] = {
          date,
          calls: 0,
          tokens: 0
        };
      }
      dailyUsage[date].calls++;
      dailyUsage[date].tokens += record.inputTokens + record.outputTokens;
    });

    const stats = {
      user: targetUser,
      summary: {
        totalCalls,
        totalTokens,
        totalInputTokens,
        totalOutputTokens,
        averageTokensPerCall: totalCalls > 0 ? Math.round(totalTokens / totalCalls) : 0
      },
      modelStats: Object.entries(modelStats).map(([model, stats]) => ({
        model,
        ...stats
      })),
      dailyUsage: Object.values(dailyUsage),
      range,
      startDate: startDate.toISOString(),
      endDate: now.toISOString()
    };

    logger.info(`Admin accessed user stats for ${targetUser.email} by ${req.user.email}`);
    await writeAudit(req, {
      userId: req.user.id,
      action: AUDIT_ACTIONS.ADMIN_VIEW_USER_STATS,
      resourceType: RESOURCE_TYPES.ADMIN,
      resourceId: targetUser.id,
      metadata: { targetEmail: targetUser.email, range },
    });
    res.json(createResponse(stats));
  } catch (error) {
    logger.error('Error fetching user stats:', error);
    res.status(500).json(createResponse(null, 'Failed to fetch user stats'));
  }
});

// GET /api/v1/user/admin/stats - Get admin statistics (enterprise only)
router.get('/admin/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {

    const { range = '30d' } = req.query;

    // Calculate date range
    const now = new Date();
    let startDate = new Date();

    switch (range) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      case 'all':
        startDate = new Date(0); // Beginning of time
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }

    // Get total users count
    const totalUsers = await prisma.user.count();

    // Get all usage records for the specified range
    const usageRecords = await prisma.usageRecord.findMany({
      where: {
        createdAt: {
          gte: startDate
        }
      },
      select: {
        modelName: true,
        inputTokens: true,
        outputTokens: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    // Calculate aggregate statistics
    const totalCalls = usageRecords.length;
    const totalTokens = usageRecords.reduce((acc, record) => {
      return acc + record.inputTokens + record.outputTokens;
    }, 0);
    const totalInputTokens = usageRecords.reduce((acc, record) => acc + record.inputTokens, 0);
    const totalOutputTokens = usageRecords.reduce((acc, record) => acc + record.outputTokens, 0);

    // Group by model
    const modelStats = {};
    usageRecords.forEach(record => {
      if (!modelStats[record.modelName]) {
        modelStats[record.modelName] = {
          calls: 0,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0
        };
      }
      modelStats[record.modelName].calls++;
      modelStats[record.modelName].inputTokens += record.inputTokens;
      modelStats[record.modelName].outputTokens += record.outputTokens;
      modelStats[record.modelName].totalTokens += record.inputTokens + record.outputTokens;
    });

    // Group by date for chart data
    const dailyUsage = {};
    usageRecords.forEach(record => {
      const date = record.createdAt.toISOString().split('T')[0];
      if (!dailyUsage[date]) {
        dailyUsage[date] = {
          date,
          calls: 0,
          tokens: 0
        };
      }
      dailyUsage[date].calls++;
      dailyUsage[date].tokens += record.inputTokens + record.outputTokens;
    });

    const stats = {
      totalUsers,
      summary: {
        totalCalls,
        totalTokens,
        totalInputTokens,
        totalOutputTokens,
        averageTokensPerCall: totalCalls > 0 ? Math.round(totalTokens / totalCalls) : 0
      },
      modelStats: Object.entries(modelStats).map(([model, stats]) => ({
        model,
        ...stats
      })),
      dailyUsage: Object.values(dailyUsage),
      range,
      startDate: startDate.toISOString(),
      endDate: now.toISOString()
    };

    logger.info(`Admin stats accessed by ${req.user.email} for range ${range}`);
    await writeAudit(req, {
      userId: req.user.id,
      action: AUDIT_ACTIONS.ADMIN_VIEW_STATS,
      resourceType: RESOURCE_TYPES.ADMIN,
      metadata: { range },
    });
    res.json(createResponse(stats));
  } catch (error) {
    logger.error('Error fetching admin stats:', error);
    res.status(500).json(createResponse(null, 'Failed to fetch admin stats'));
  }
});

// DELETE /api/v1/user/account - Permanently delete the authenticated user's account
// All user data is cascade-deleted via Prisma schema (AuditLog, ChatSession, Message,
// Project, RefreshToken, Subscription, TokenPurchase, UsageRecord, UserPreferences).
router.delete('/account', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const email  = req.user.email;

    // Write audit entry before deletion (the record disappears with the user)
    await writeAudit(req, {
      userId,
      action: AUDIT_ACTIONS.ACCOUNT_DELETED,
      resourceType: RESOURCE_TYPES.USER,
      resourceId: userId,
      metadata: { email },
    });

    await prisma.user.delete({ where: { id: userId } });

    logger.info(`Account permanently deleted: ${email} (${userId})`);
    res.json(createResponse({ message: 'Account and all associated data have been permanently deleted.' }));
  } catch (error) {
    logger.error('Error deleting account:', error);
    res.status(500).json(createResponse(null, 'Failed to delete account'));
  }
});

// GET /api/v1/user/tool-quota - Current user's tool tier quota and usage
router.get('/tool-quota', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userPlan = req.user.planName || 'BASE';
    const tierQuota = TOOL_TIER_QUOTA[userPlan] || TOOL_TIER_QUOTA.BASE;

    const periodStart = new Date();
    periodStart.setUTCDate(1);
    periodStart.setUTCHours(0, 0, 0, 0);

    const quotaRows = await prisma.toolQuota.findMany({
      where: { userId }
    }).catch(() => []);

    const quotaMap = {};
    for (const row of quotaRows) {
      const isCurrentPeriod = row.periodStart <= new Date() && new Date() >= periodStart;
      quotaMap[row.tier] = {
        used: isCurrentPeriod ? row.usedThisMonth : 0,
        limit: tierQuota[row.tier] ?? row.monthlyLimit
      };
    }

    // Build tier → tools mapping from TOOL_TIER_MAP
    const tierTools = {};
    for (const [toolName, tier] of Object.entries(TOOL_TIER_MAP)) {
      if (!tierTools[tier]) tierTools[tier] = [];
      tierTools[tier].push(toolName);
    }

    const result = {};
    for (const tier of ['A', 'B', 'C']) {
      result[tier] = {
        ...(quotaMap[tier] ?? { used: 0, limit: tierQuota[tier] ?? 0 }),
        tools: tierTools[tier] ?? []
      };
    }

    res.json(createResponse({ tiers: result, plan: userPlan }));
  } catch (error) {
    logger.error('Error fetching tool quota:', error);
    res.status(500).json(createResponse(null, 'Failed to fetch tool quota'));
  }
});

// GET /api/v1/user/data-export - Export all personal data for the authenticated user (GDPR)
router.get('/data-export', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const [user, projects, sessions, preferences] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, username: true, picture: true, team: true, role: true, createdAt: true, updatedAt: true },
      }),
      prisma.project.findMany({
        where: { userId },
        select: { id: true, name: true, description: true, isDefault: true, createdAt: true, updatedAt: true },
      }),
      prisma.chatSession.findMany({
        where: { userId },
        select: { id: true, title: true, isStarred: true, createdAt: true, updatedAt: true, projectId: true },
      }),
      prisma.userPreferences.findUnique({ where: { userId } }),
    ]);

    await writeAudit(req, {
      userId,
      action: AUDIT_ACTIONS.DATA_EXPORT,
      resourceType: RESOURCE_TYPES.USER,
      resourceId: userId,
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="my-data-${Date.now()}.json"`);
    res.json({
      exportedAt: new Date().toISOString(),
      profile: user,
      preferences,
      projects,
      chatSessions: sessions,
    });
  } catch (error) {
    logger.error('Error exporting user data:', error);
    res.status(500).json(createResponse(null, 'Failed to export data'));
  }
});

export default router;
