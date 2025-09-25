import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database.js';
import { createResponse } from '../config/constants.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { email, username, password } = req.body;

    // Validate input
    if (!email || !username || !password) {
      return res.status(400).json(
        createResponse(null, 'Email, username and password are required')
      );
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

export default router;
