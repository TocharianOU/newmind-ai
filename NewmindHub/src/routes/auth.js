import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import passport from 'passport';
import { prisma } from '../config/database.js';
import { createResponse } from '../config/constants.js';
import logger from '../utils/logger.js';
import HARDCODED_CONFIG from '../config/hardcoded.js';
import { getOAuthConfig, getPublicProviderList, getProviderScope } from '../config/oauth.js';

const router = express.Router();

// Get auth configuration (e.g., invite code requirement, OAuth config)
router.get('/config', (req, res) => {
  try {
    const oauthConfig = getOAuthConfig();
    res.json(createResponse({
      inviteCodeRequired: HARDCODED_CONFIG.INVITE_CODE_ENABLED,
      oauthEnabled: oauthConfig.enabled,
      brandText: oauthConfig.brandText,
      providers: getPublicProviderList()
    }));
  } catch (error) {
    logger.error('Config fetch error:', error);
    res.status(500).json(createResponse(null, 'Failed to fetch configuration'));
  }
});

// Get download configuration (public endpoint)
router.get('/download-config', (req, res) => {
  try {
    res.json(createResponse(HARDCODED_CONFIG.DOWNLOAD_URLS));
  } catch (error) {
    logger.error('Download config fetch error:', error);
    res.status(500).json(createResponse(null, 'Failed to fetch download configuration'));
  }
});

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { email, username, password, inviteCode } = req.body;

    // Validate input
    if (!email || !username || !password) {
      return res.status(400).json(
        createResponse(null, 'Email, username and password are required')
      );
    }

    // Check invite code
    if (HARDCODED_CONFIG.INVITE_CODE_ENABLED) {
      if (!inviteCode || !HARDCODED_CONFIG.VALID_INVITE_CODES.includes(inviteCode)) {
        return res.status(400).json(
          createResponse(null, 'Invalid or missing invite code')
        );
      }
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json(
        createResponse(null, 'User already exists')
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user with default subscription
    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        subscription: {
          create: {
            planName: 'BASE',
            isDefaultPlan: true,
            isActive: true
          }
        }
      },
      include: {
        subscription: true
      }
    });

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    logger.info(`New user registered: ${email}`);

    res.status(201).json(createResponse({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        subscription: {
          PlanName: user.subscription.planName,
          IsDefaultPlan: user.subscription.isDefaultPlan,
          StartDate: user.subscription.startDate,
          Start: user.subscription.startDate,
          End: user.subscription.endDate,
          NextBillingDate: user.subscription.nextBillingDate
        }
      }
    }));
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json(createResponse(null, 'Registration failed'));
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json(
        createResponse(null, 'Email and password are required')
      );
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: { subscription: true }
    });

    if (!user) {
      return res.status(401).json(
        createResponse(null, 'Invalid credentials')
      );
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json(
        createResponse(null, 'Invalid credentials')
      );
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Generate refresh token
    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
    );

    // Save refresh token
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      }
    });

    logger.info(`User logged in: ${email}`);

    // Dive expects 'accessToken' in data.data.accessToken
    res.json({
      success: true,
      data: {
        accessToken: token,  // Dive expects this field name
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          subscription: {
            PlanName: user.subscription.planName,
            IsDefaultPlan: user.subscription.isDefaultPlan,
            StartDate: user.subscription.startDate,
            Start: user.subscription.startDate,
            End: user.subscription.endDate,
            NextBillingDate: user.subscription.nextBillingDate
          }
        }
      },
      error: null
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json(createResponse(null, 'Login failed'));
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json(
        createResponse(null, 'Refresh token required')
      );
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

    // Check if refresh token exists in database
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken }
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      return res.status(401).json(
        createResponse(null, 'Invalid or expired refresh token')
      );
    }

    // Generate new access token
    const newToken = jwt.sign(
      { userId: decoded.userId },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json(createResponse({ token: newToken }));
  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(401).json(createResponse(null, 'Token refresh failed'));
  }
});

// ==================== OAuth Routes ====================

/**
 * 启动OAuth认证流程
 * GET /auth/:provider
 * 支持的provider: google, microsoft, github, gitlab
 */
router.get('/:provider', (req, res, next) => {
  const provider = req.params.provider;
  const scope = getProviderScope(provider);
  
  logger.info(`Starting OAuth flow for provider: ${provider}`);
  
  passport.authenticate(provider, {
    scope,
    session: false,
    state: req.query.client || 'dive' // 传递client信息
  })(req, res, next);
});

/**
 * OAuth回调处理
 * GET /auth/:provider/callback
 */
router.get('/:provider/callback', (req, res, next) => {
  const provider = req.params.provider;
  
  passport.authenticate(provider, { session: false }, async (err, user, info) => {
    try {
      if (err) {
        logger.error(`OAuth callback error for ${provider}:`, err);
        return res.redirect(`dive://login/error?message=${encodeURIComponent(err.message || 'Authentication failed')}`);
      }

      if (!user) {
        logger.warn(`OAuth authentication failed for ${provider}:`, info);
        return res.redirect(`dive://login/error?message=${encodeURIComponent('Authentication failed')}`);
      }

      // 生成JWT token
      const token = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      // 生成refresh token
      const refreshToken = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
      );

      // 保存refresh token
      await prisma.refreshToken.create({
        data: {
          userId: user.id,
          token: refreshToken,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      });

      logger.info(`OAuth login successful for ${provider}: ${user.email}`);

      // 通过deep link返回token给Electron应用
      res.redirect(`dive://login/${token}`);
    } catch (error) {
      logger.error(`OAuth callback processing error for ${provider}:`, error);
      res.redirect(`dive://login/error?message=${encodeURIComponent('Login processing failed')}`);
    }
  })(req, res, next);
});

export default router;
