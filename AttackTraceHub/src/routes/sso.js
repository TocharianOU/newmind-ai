/**
 * SSO Authentication Routes
 * 处理 SSO 登录流程：start 和 callback
 */

import express from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../config/database.js';
import { createResponse } from '../config/constants.js';
import logger from '../utils/logger.js';
import ssoRegistry from '../sso/index.js';
import { writeAudit, AUDIT_ACTIONS, RESOURCE_TYPES } from '../utils/auditLog.js';

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

const router = express.Router();

// In-memory state store (in production, use Redis or database)
// Key: state, Value: { timestamp, appRedirect }
const stateStore = new Map();

// Clean up old states (older than 10 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [state, data] of stateStore.entries()) {
    if (now - data.timestamp > 10 * 60 * 1000) {
      stateStore.delete(state);
    }
  }
}, 5 * 60 * 1000); // Run every 5 minutes

/**
 * GET /api/auth/sso/:provider/start
 * 启动 SSO 登录流程
 */
router.get('/:provider/start', async (req, res) => {
  try {
    const { provider } = req.params;
    const { appRedirect } = req.query; // 'attacktrace' for AttackTrace

    logger.info(`SSO login start requested for provider: ${provider}`);

    // Check if provider exists and is enabled
    if (!ssoRegistry.isEnabled(provider)) {
      return res.status(400).json(
        createResponse(null, `SSO provider '${provider}' is not available or not enabled`)
      );
    }

    const ssoProvider = ssoRegistry.get(provider);

    // Generate CSRF state token
    const state = crypto.randomBytes(32).toString('hex');
    
    // Store state with metadata
    stateStore.set(state, {
      timestamp: Date.now(),
      appRedirect: appRedirect || null,
      provider: provider
    });

    // Get authorization URL (may be async for OIDC discovery)
    const authUrl = await Promise.resolve(ssoProvider.getAuthorizationUrl(state));

    logger.info(`Redirecting to ${provider} authorization URL`);
    
    // Redirect user to SSO provider
    res.redirect(authUrl);
  } catch (error) {
    logger.error('SSO start error:', error);
    res.status(500).json(createResponse(null, 'Failed to start SSO login'));
  }
});

/**
 * GET /api/auth/sso/:provider/callback
 * 处理 SSO 回调
 */
router.get('/:provider/callback', async (req, res) => {
  try {
    const { provider } = req.params;
    const { code, state, error, error_description } = req.query;

    logger.info(`SSO callback received for provider: ${provider}`);

    // Handle OAuth errors
    if (error) {
      logger.error(`SSO callback error: ${error} - ${error_description}`);
      return res.redirect(
        `${process.env.HUB_FRONTEND_URL || 'http://localhost:23001'}/login?error=${encodeURIComponent(error_description || error)}`
      );
    }

    // Validate required parameters
    if (!code || !state) {
      return res.status(400).json(
        createResponse(null, 'Missing code or state parameter')
      );
    }

    // Verify state (CSRF protection)
    const stateData = stateStore.get(state);
    if (!stateData) {
      logger.error('Invalid or expired state parameter');
      return res.status(400).json(
        createResponse(null, 'Invalid or expired state parameter')
      );
    }

    // Clean up state
    stateStore.delete(state);

    // Verify provider matches
    if (stateData.provider !== provider) {
      logger.error('Provider mismatch in state');
      return res.status(400).json(
        createResponse(null, 'Invalid state parameter')
      );
    }

    // Get SSO provider
    const ssoProvider = ssoRegistry.get(provider);
    if (!ssoProvider) {
      return res.status(400).json(
        createResponse(null, `SSO provider '${provider}' not found`)
      );
    }

    // Exchange code for user info
    logger.info(`Exchanging authorization code for ${provider}`);
    const userInfo = await ssoProvider.handleCallback(code);

    // Find or create user
    const user = await findOrCreateSSOUser(provider, userInfo);

    // Generate JWT token (matching existing format)
    const accessToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Generate and store hashed refresh token (same as password login flow)
    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
    );
    await prisma.refreshToken.create({
      data: {
        id: uuidv4(),
        userId: user.id,
        token: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });

    logger.info(`SSO login successful for user: ${user.email}`);

    await writeAudit(req, {
      userId: user.id,
      action: AUDIT_ACTIONS.SSO_LOGIN_SUCCESS,
      resourceType: RESOURCE_TYPES.AUTH,
      resourceId: user.id,
      metadata: { provider, email: user.email },
    });

    // Determine redirect URL — pass both tokens so the frontend can store refreshToken
    const hubFrontendUrl = process.env.HUB_FRONTEND_URL || 'http://localhost:23001';
    let redirectUrl = `${hubFrontendUrl}/login?token=${accessToken}&refreshToken=${refreshToken}`;

    // Add appRedirect parameter if specified (for AttackTrace)
    if (stateData.appRedirect) {
      redirectUrl += `&appRedirect=${encodeURIComponent(stateData.appRedirect)}`;
    }

    logger.info(`Redirecting to: ${redirectUrl}`);
    res.redirect(redirectUrl);

  } catch (error) {
    logger.error('SSO callback error:', error);
    await writeAudit(req, {
      userId: null,
      action: AUDIT_ACTIONS.SSO_LOGIN_FAILURE,
      resourceType: RESOURCE_TYPES.AUTH,
      metadata: { error: error.message },
    });
    const hubFrontendUrl = process.env.HUB_FRONTEND_URL || 'http://localhost:23001';
    res.redirect(
      `${hubFrontendUrl}/login?error=${encodeURIComponent('SSO login failed. Please try again.')}`
    );
  }
});

/**
 * Find or create user based on SSO identity
 * @param {string} provider - SSO provider name
 * @param {SSOUserInfo} userInfo - User info from SSO provider
 * @returns {Promise<User>}
 */
async function findOrCreateSSOUser(provider, userInfo) {
  // Try to find existing AuthIdentity
  let authIdentity = await prisma.authIdentity.findUnique({
    where: {
      provider_providerUserId: {
        provider: provider,
        providerUserId: userInfo.providerUserId
      }
    },
    include: {
      User: {
        include: {
          Subscription: true
        }
      }
    }
  });

  if (authIdentity) {
    // Update user info if changed
    const updateData = {};
    if (userInfo.displayName && authIdentity.displayName !== userInfo.displayName) {
      updateData.displayName = userInfo.displayName;
    }
    if (userInfo.profilePicture && authIdentity.profilePicture !== userInfo.profilePicture) {
      updateData.profilePicture = userInfo.profilePicture;
    }
    if (userInfo.metadata) {
      updateData.metadata = userInfo.metadata;
    }

    if (Object.keys(updateData).length > 0) {
      authIdentity = await prisma.authIdentity.update({
        where: { id: authIdentity.id },
        data: { ...updateData, updatedAt: new Date() },
        include: {
          User: {
            include: {
              Subscription: true
            }
          }
        }
      });
    }

    logger.info(`Existing SSO user found: ${authIdentity.User.email}`);
    return authIdentity.User;
  }

  // Check if user exists by email (link existing account)
  if (userInfo.email) {
    const existingUser = await prisma.user.findUnique({
      where: { email: userInfo.email },
      include: { Subscription: true }
    });

    if (existingUser) {
      // Link SSO identity to existing user
      await prisma.authIdentity.create({
        data: {
          userId: existingUser.id,
          provider: provider,
          providerUserId: userInfo.providerUserId,
          email: userInfo.email,
          displayName: userInfo.displayName,
          profilePicture: userInfo.profilePicture,
          metadata: userInfo.metadata
        }
      });

      logger.info(`SSO identity linked to existing user: ${existingUser.email}`);
      return existingUser;
    }
  }

  // Create new user with SSO identity
  logger.info(`Creating new SSO user: ${userInfo.email || userInfo.displayName}`);
  
  const newUser = await prisma.user.create({
    data: {
      id: uuidv4(),
      email: userInfo.email || `${provider}_${userInfo.providerUserId}@sso.local`,
      username: userInfo.displayName || `${provider}_user`,
      password: null, // SSO-only user
      picture: userInfo.profilePicture,
      subscription: {
        create: {
          id: uuidv4(),
          planName: 'BASE',
          isDefaultPlan: true,
          isActive: true
        }
      },
      authIdentities: {
        create: {
          provider: provider,
          providerUserId: userInfo.providerUserId,
          email: userInfo.email,
          displayName: userInfo.displayName,
          profilePicture: userInfo.profilePicture,
          metadata: userInfo.metadata
        }
      },
      Project: {
        create: {
          id: 'default',
          name: 'Default',
          description: 'Default project',
          isDefault: true,
          updatedAt: new Date(),
        }
      }
    },
    include: {
      subscription: true,
      authIdentities: true
    }
  });

  logger.info(`New SSO user created: ${newUser.email}`);
  return newUser;
}

export default router;
