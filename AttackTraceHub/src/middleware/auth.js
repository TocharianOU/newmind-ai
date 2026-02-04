import jwt from 'jsonwebtoken';
import { prisma } from '../config/database.js';
import { createResponse } from '../config/constants.js';
import logger from '../utils/logger.js';

export const authenticateToken = async (req, res, next) => {
  try {
    // Support multiple authentication methods
    const authHeader = req.headers['authorization'];
    const xApiKey = req.headers['x-api-key'];
    const hubToken = req.headers['x-hub-token']; // Custom header for Hub authentication
    
    let token = null;
    
    // Priority 1: Authorization header (standard)
    if (authHeader) {
      token = authHeader.split(' ')[1];
    }
    // Priority 2: Custom Hub token header
    else if (hubToken) {
      token = hubToken;
    }
    // Priority 3: Check if x-api-key looks like a JWT (for Anthropic client)
    else if (xApiKey) {
      // JWT tokens typically have 3 parts separated by dots
      if (xApiKey.includes('.') && xApiKey.split('.').length === 3) {
        // This looks like a JWT token, not an Anthropic API key
        token = xApiKey;
        logger.info('🔐 Using JWT from x-api-key header');
      }
    }

    if (!token) {
      logger.warn('❌ No valid token found in any header');
      return res.status(401).json(createResponse(null, 'No token provided'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { 
        Subscription: true 
      }
    });

    if (!user) {
      return res.status(401).json(createResponse(null, 'User not found'));
    }

    // Check if subscription is active
    if (user.Subscription && !user.Subscription.isActive) {
      return res.status(403).json(createResponse(null, 'Subscription inactive'));
    }

    req.user = {
      id: user.id,
      email: user.email,
      username: user.username,
      planName: user.Subscription?.planName || 'BASE'
    };

    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json(createResponse(null, 'Invalid token'));
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json(createResponse(null, 'Token expired'));
    }
    
    return res.status(500).json(createResponse(null, 'Authentication failed'));
  }
};

export const requirePlan = (requiredPlans) => {
  return (req, res, next) => {
    const userPlan = req.user?.planName || 'BASE';
    
    if (!requiredPlans.includes(userPlan)) {
      return res.status(403).json(
        createResponse(null, `Insufficient subscription plan. Required: ${requiredPlans.join(' or ')}`)
      );
    }
    
    next();
  };
};
