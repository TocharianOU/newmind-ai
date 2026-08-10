import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import CryptoJS from 'crypto-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../config/database.js';
import { createResponse } from '../config/constants.js';
import logger from '../utils/logger.js';
import HARDCODED_CONFIG from '../config/hardcoded.js';
import featureFlags from '../config/featureFlags.js';
import { checkSeatAvailable } from '../license/validator.js';
import ssoRegistry from '../sso/index.js';
import { writeAudit, AUDIT_ACTIONS, RESOURCE_TYPES } from '../utils/auditLog.js';
import { validateBody } from '../middleware/validate.js';
import { RegisterSchema, LoginSchema, RefreshTokenSchema, ForgotPasswordSchema, ResetPasswordSchema } from '../schemas/auth.schemas.js';
import { sendPasswordResetEmail } from '../utils/email.js';

/** Hash a refresh token for secure storage. */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DOWNLOAD_DIR = path.resolve(__dirname, '../../downloads');

function getDownloadInviteCodes() {
  return (process.env.DOWNLOAD_INVITE_CODES || process.env.INVITE_CODES || '')
    .split(',')
    .map(code => code.trim())
    .filter(Boolean);
}

function isValidDownloadInvite(inviteCode) {
  const codes = getDownloadInviteCodes();
  return Boolean(inviteCode) && codes.includes(inviteCode);
}

function getDownloadPackages() {
  return HARDCODED_CONFIG.DOWNLOAD_PACKAGES.map(pkg => {
    const filePath = path.resolve(DOWNLOAD_DIR, pkg.fileName);
    const available = fs.existsSync(filePath);
    const stats = available ? fs.statSync(filePath) : null;
    const checksumFileName = `${pkg.fileName}.sha256`;
    const checksumPath = path.resolve(DOWNLOAD_DIR, checksumFileName);

    return {
      ...pkg,
      available,
      fileSize: stats?.size || 0,
      checksumFileName,
      checksumAvailable: fs.existsSync(checksumPath),
    };
  });
}

// Get auth configuration (e.g., invite code requirement)
router.get('/config', (req, res) => {
  try {
    res.json(createResponse({
      inviteCodeRequired: HARDCODED_CONFIG.INVITE_CODE_ENABLED
    }));
  } catch (error) {
    logger.error('Config fetch error:', error);
    res.status(500).json(createResponse(null, 'Failed to fetch configuration'));
  }
});

// GET /api/auth/flags — public endpoint exposing feature flags relevant to the frontend
router.get('/flags', (req, res) => {
  const enabledSSOProviders = ssoRegistry.getEnabled().map(({ name }) => name);

  res.json(createResponse({
    deploymentMode:            featureFlags.DEPLOYMENT_MODE,
    billingEnabled:            featureFlags.BILLING_ENABLED,
    ssoEnabled:                featureFlags.SSO_ENABLED,
    auditExportEnabled:        featureFlags.AUDIT_EXPORT_ENABLED,
    enterpriseFeaturesEnabled: featureFlags.ENTERPRISE_FEATURES_ENABLED,
    licenseEnabled:            featureFlags.LICENSE_ENABLED,
    inviteCodeEnabled:         featureFlags.INVITE_CODE_ENABLED,
    enabledSSOProviders,
  }));
});

// Get download configuration (public endpoint)
router.get('/download-config', (req, res) => {
  try {
    res.json(createResponse({
      inviteRequired: true,
      packages: getDownloadPackages(),
    }));
  } catch (error) {
    logger.error('Download config fetch error:', error);
    res.status(500).json(createResponse(null, 'Failed to fetch download configuration'));
  }
});

// Invite-gated customer package download.
function sendDownloadPackage(req, res) {
  try {
    const { inviteCode, packageId } = ['GET', 'HEAD'].includes(req.method) ? req.query : (req.body || {});

    if (!isValidDownloadInvite(inviteCode)) {
      return res.status(403).json(createResponse(null, 'Invalid invite code'));
    }

    const pkg = HARDCODED_CONFIG.DOWNLOAD_PACKAGES.find(item => item.id === packageId);
    if (!pkg) {
      return res.status(404).json(createResponse(null, 'Download package not found'));
    }

    const filePath = path.resolve(DOWNLOAD_DIR, pkg.fileName);
    if (!filePath.startsWith(DOWNLOAD_DIR + path.sep) || !fs.existsSync(filePath)) {
      return res.status(404).json(createResponse(null, 'Download file is not available'));
    }

    res.download(filePath, pkg.fileName);
  } catch (error) {
    logger.error('Package download error:', error);
    res.status(500).json(createResponse(null, 'Failed to download package'));
  }
}

router.get('/download', sendDownloadPackage);
router.post('/download', sendDownloadPackage);

// Register new user
router.post('/register', validateBody(RegisterSchema), async (req, res) => {
  try {
    let { email, username, password, inviteCode, encrypted } = req.body;

    // Security: Removed client-side password encryption (security theater)
    // Passwords should be transmitted over HTTPS only, never pre-encrypted with hardcoded keys
    // The 'encrypted' parameter is now ignored for backward compatibility

    // Check invite code
    if (HARDCODED_CONFIG.INVITE_CODE_ENABLED) {
      if (!inviteCode || !HARDCODED_CONFIG.VALID_INVITE_CODES.includes(inviteCode)) {
        return res.status(400).json(
          createResponse(null, 'Invalid or missing invite code')
        );
      }
    }

    // Enterprise: enforce license seat limit before creating user
    if (featureFlags.LICENSE_ENABLED) {
      const { allowed, reason } = await checkSeatAvailable();
      if (!allowed) {
        return res.status(403).json(createResponse(null, `Registration blocked: ${reason}`));
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

    // Determine role: ADMIN_EMAILS is a comma-separated list of emails in env
    const adminEmails = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(Boolean);
    const role = adminEmails.includes(email.toLowerCase()) ? 'ADMIN' : 'USER';

    // Create user with default subscription and default project
    const userId = uuidv4();
    const user = await prisma.user.create({
      data: {
        id: userId,
        email,
        username,
        password: hashedPassword,
        role,
        Subscription: {
          create: {
            id: uuidv4(),
            planName: 'BASE',
            isDefaultPlan: true,
            isActive: true
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
        Subscription: true
      }
    });

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    logger.info(`New user registered: ${email}`);

    await writeAudit(req, {
      userId: user.id,
      action: AUDIT_ACTIONS.REGISTER,
      resourceType: RESOURCE_TYPES.AUTH,
      resourceId: user.id,
      metadata: { email, username },
    });

    res.status(201).json(createResponse({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        subscription: {
          PlanName: user.Subscription.planName,
          IsDefaultPlan: user.Subscription.isDefaultPlan,
          StartDate: user.Subscription.startDate,
          Start: user.Subscription.startDate,
          End: user.Subscription.endDate,
          NextBillingDate: user.Subscription.nextBillingDate
        }
      }
    }));
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json(createResponse(null, 'Registration failed'));
  }
});

// Login
router.post('/login', validateBody(LoginSchema), async (req, res) => {
  try {
    let { email, password, encrypted } = req.body;

    // Security: Removed client-side password encryption (security theater)
    // The 'encrypted' parameter is now ignored for backward compatibility

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: { 
        Subscription: true 
      }
    });

    if (!user) {
      await writeAudit(req, {
        userId: null,
        action: AUDIT_ACTIONS.LOGIN_FAILURE,
        resourceType: RESOURCE_TYPES.AUTH,
        metadata: { email, reason: 'user_not_found' },
      });
      return res.status(401).json(
        createResponse(null, 'Invalid credentials')
      );
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      await writeAudit(req, {
        userId: user.id,
        action: AUDIT_ACTIONS.LOGIN_FAILURE,
        resourceType: RESOURCE_TYPES.AUTH,
        resourceId: user.id,
        metadata: { email, reason: 'invalid_password' },
      });
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
    // jti 保证唯一：payload 仅含 userId 时，同一用户同一秒内登录会生成完全相同的 JWT，
    // hashToken 后触发 RefreshToken.token 唯一约束冲突（500）。加随机 jti 消除碰撞。
    const refreshToken = jwt.sign(
      { userId: user.id, jti: crypto.randomUUID() },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
    );

    // Save hashed refresh token — never store the raw token in DB.
    await prisma.refreshToken.create({
      data: {
        id: uuidv4(),
        userId: user.id,
        token: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      }
    });

    logger.info(`User logged in: ${email}`);

    await writeAudit(req, {
      userId: user.id,
      action: AUDIT_ACTIONS.LOGIN_SUCCESS,
      resourceType: RESOURCE_TYPES.AUTH,
      resourceId: user.id,
      metadata: { email },
    });

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
            PlanName: user.Subscription.planName,
            IsDefaultPlan: user.Subscription.isDefaultPlan,
            StartDate: user.Subscription.startDate,
            Start: user.Subscription.startDate,
            End: user.Subscription.endDate,
            NextBillingDate: user.Subscription.nextBillingDate
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
router.post('/refresh', validateBody(RefreshTokenSchema), async (req, res) => {
  try {
    const { refreshToken } = req.body;

    // Verify refresh token signature first (cheap, no DB hit)
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

    // Look up the stored hash — never compare raw tokens in DB
    const tokenHash = hashToken(refreshToken);
    let storedToken = await prisma.refreshToken.findUnique({
      where: { token: tokenHash }
    });

    // ── Compatibility fallback for tokens stored as plaintext (pre-hashing era) ──
    // If no hashed token found, attempt a plaintext lookup and migrate on the fly.
    if (!storedToken) {
      const legacyToken = await prisma.refreshToken.findUnique({
        where: { token: refreshToken }
      });
      if (legacyToken && legacyToken.expiresAt >= new Date()) {
        logger.warn(`[Auth] Migrating plaintext refresh token to hash for user ${legacyToken.userId}`);
        storedToken = await prisma.refreshToken.update({
          where: { token: refreshToken },
          data: { token: tokenHash }
        });
      }
    }

    if (!storedToken || storedToken.expiresAt < new Date()) {
      return res.status(401).json(
        createResponse(null, 'Invalid or expired refresh token')
      );
    }

    // Generate new access token
    const newAccessToken = jwt.sign(
      { userId: decoded.userId },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Rotate refresh token（同样加随机 jti 避免同秒生成的 JWT 碰撞唯一约束）
    const newRefreshToken = jwt.sign(
      { userId: decoded.userId, jti: crypto.randomUUID() },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
    );

    // Replace old hash with new hash
    await prisma.refreshToken.update({
      where: { token: tokenHash },
      data: {
        token: hashToken(newRefreshToken),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      }
    });

    await writeAudit(req, {
      userId: decoded.userId,
      action: AUDIT_ACTIONS.TOKEN_REFRESH,
      resourceType: RESOURCE_TYPES.AUTH,
      resourceId: decoded.userId,
    });

    res.json(createResponse({ 
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    }));
  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(401).json(createResponse(null, 'Token refresh failed'));
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', validateBody(ForgotPasswordSchema), async (req, res) => {
  try {
    const { email } = req.body;

    // Always respond with success to prevent email enumeration
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      // No account or SSO-only account — return 200 without sending email
      return res.json(createResponse({ message: 'If that email exists, a reset link has been sent.' }));
    }

    // Invalidate any existing unused tokens for this user
    await prisma.passwordReset.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true },
    });

    // Generate a cryptographically random token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    await prisma.passwordReset.create({
      data: {
        id: uuidv4(),
        userId: user.id,
        token: tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    await sendPasswordResetEmail(email, rawToken);

    await writeAudit(req, {
      userId: user.id,
      action: AUDIT_ACTIONS.PASSWORD_RESET_REQUESTED,
      resourceType: RESOURCE_TYPES.AUTH,
      resourceId: user.id,
      metadata: { email },
    });

    res.json(createResponse({ message: 'If that email exists, a reset link has been sent.' }));
  } catch (error) {
    logger.error('Forgot-password error:', error);
    res.status(500).json(createResponse(null, 'Failed to process request'));
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', validateBody(ResetPasswordSchema), async (req, res) => {
  try {
    const { token, password } = req.body;

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const record = await prisma.passwordReset.findUnique({
      where: { token: tokenHash },
      include: { User: true },
    });

    if (!record || record.used || record.expiresAt < new Date()) {
      return res.status(400).json(createResponse(null, 'Invalid or expired reset token'));
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { password: hashedPassword, updatedAt: new Date() },
      }),
      prisma.passwordReset.update({
        where: { token: tokenHash },
        data: { used: true },
      }),
      // Invalidate all refresh tokens so existing sessions are logged out
      prisma.refreshToken.deleteMany({ where: { userId: record.userId } }),
    ]);

    await writeAudit(req, {
      userId: record.userId,
      action: AUDIT_ACTIONS.PASSWORD_RESET_COMPLETED,
      resourceType: RESOURCE_TYPES.AUTH,
      resourceId: record.userId,
      metadata: { email: record.User.email },
    });

    logger.info(`Password reset completed for user: ${record.User.email}`);
    res.json(createResponse({ message: 'Password updated successfully. Please log in.' }));
  } catch (error) {
    logger.error('Reset-password error:', error);
    res.status(500).json(createResponse(null, 'Failed to reset password'));
  }
});

export default router;
