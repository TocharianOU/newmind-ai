import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Import routes
import authRoutes from './routes/auth.js';
import ssoRoutes from './routes/sso.js';
import userRoutes from './routes/user.js';
import modelRoutes from './routes/models.js';
import proxyRoutes from './routes/proxy.js';
import mcpRoutes from './routes/mcp.js';
import llmRoutes from './routes/llms.js';
import systemPromptRoutes from './routes/system-prompt.js';
import paymentRoutes, { stripeWebhookHandler } from './routes/payment.js';
import projectRoutes from './routes/projects.js';
import auditRoutes from './routes/audit.js';
import vtProxyRoutes from './routes/vt-proxy.js';
import shodanProxyRoutes from './routes/shodan-proxy.js';
import abuseipdbProxyRoutes from './routes/abuseipdb-proxy.js';
import syncRoutes from './routes/sync.js';

// Import middleware
import { errorHandler } from './middleware/errorHandler.js';
import { rateLimiter, authLimiter, paymentLimiter, syncLimiter } from './middleware/rateLimiter.js';

// Import utilities
import logger from './utils/logger.js';
import { startSubscriptionExpirationCheck } from './utils/subscriptionExpiration.js';
import { initializeSSOProviders } from './sso/index.js';
import { prisma } from './config/database.js';

// Create Express app
const app = express();
const server = createServer(app);

// Trust the first proxy so that req.ip reflects the real client IP
// from X-Forwarded-For when deployed behind Nginx / load balancer.
app.set('trust proxy', 1);

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [
  'http://localhost:23001',
  'http://localhost:23000',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:3001'
];

// Add Hub frontend URL if specified
if (process.env.HUB_FRONTEND_URL) {
  allowedOrigins.push(process.env.HUB_FRONTEND_URL);
}

// Middleware
// Configure helmet for compatibility with Tor browser and modern frontend frameworks
// Build CSP connectSrc list with custom URLs from environment variables
const cspConnectSrc = ["'self'", "http://localhost:23000", "https:", "http:"];

// Add custom LM Studio URL if configured
if (process.env.CUSTOM_LMSTUDIO_URL) {
  cspConnectSrc.push(process.env.CUSTOM_LMSTUDIO_URL);
}

// Add frontend URL if configured
if (process.env.HUB_FRONTEND_URL) {
  cspConnectSrc.push(process.env.HUB_FRONTEND_URL);
}

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Allow inline scripts and eval (required by Vite)
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"], // Allow inline styles
      imgSrc: ["'self'", "data:", "blob:", "https:", "http:"], // Allow images from various sources
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      connectSrc: cspConnectSrc, // Use dynamically built connection source list
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false, // Disable to avoid download issues
  crossOriginResourcePolicy: { policy: "cross-origin" } // Allow cross-origin resources
}));

// CORS 配置 - 允许下载地址域名
app.use(cors({
  origin: (origin, callback) => {
    // 允许通配符或特定origins
    if (allowedOrigins.includes('*') || !origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Range'], // 添加 Range 支持断点续传
  exposedHeaders: ['Content-Length', 'Content-Range', 'Accept-Ranges'] // 暴露下载相关头
}));
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) }}));

// ⚠️ CRITICAL: Stripe webhook 必须在 express.json() 之前挂载，需要原始请求体
app.post('/api/v1/payment/webhook', express.raw({ type: 'application/json' }), stripeWebhookHandler);

// 移除所有请求体大小限制，直到大模型报错为止
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting
app.use('/api/', rateLimiter);

// Serve static files from integrations directory (for logos)
app.use('/integrations', express.static(path.join(__dirname, '../integrations')));

// Health check — also verifies DB connectivity
app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      service: 'OAP-Platform',
      timestamp: new Date().toISOString(),
      db: 'ok',
    });
  } catch {
    res.status(503).json({
      status: 'error',
      service: 'OAP-Platform',
      timestamp: new Date().toISOString(),
      db: 'unreachable',
    });
  }
});

// API Routes — SSO must be registered before /api/auth to avoid matching authRoutes first
app.use('/api/auth/sso', authLimiter, ssoRoutes);     // SSO authentication routes
app.use('/api/auth', authLimiter, authRoutes);         // stricter limit on auth
app.use('/api/v1/user/sync', syncLimiter, syncRoutes); // sync before /api/v1/user to avoid catch-all
app.use('/api/v1/user', userRoutes);
app.use('/api/v1', modelRoutes);
app.use('/api/v1', proxyRoutes);
app.use('/api/v1', mcpRoutes);
app.use('/api/v1', llmRoutes);
app.use('/api/v1/system-prompt', systemPromptRoutes);
app.use('/api/v1/payment', paymentLimiter, paymentRoutes); // stricter limit on payments
app.use('/api/v1/projects', projectRoutes);
app.use('/api/v1/audit', auditRoutes);
app.use('/api/vt-proxy/v3', vtProxyRoutes);
app.use('/api/shodan-proxy/v1', shodanProxyRoutes);
app.use('/api/abuseipdb-proxy/v2', abuseipdbProxyRoutes);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    error: 'Not Found',
    data: null
  });
});

// Initialize SSO providers
initializeSSOProviders();

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`🚀 OAP Platform server running on port ${PORT}`);
  logger.info(`📊 Environment: ${process.env.NODE_ENV}`);
  logger.info(`🌐 CORS origins: ${allowedOrigins.join(',')}`);
  startSubscriptionExpirationCheck();
});

// Graceful shutdown — close DB connections before exiting
async function shutdown(signal) {
  logger.info(`[Shutdown] Received ${signal}, closing server…`);
  server.close(async () => {
    try {
      await prisma.$disconnect();
      logger.info('[Shutdown] Database connection closed. Bye.');
    } catch (err) {
      logger.error('[Shutdown] Error disconnecting from DB:', err);
    }
    process.exit(0);
  });
  // Force exit if graceful close takes too long
  setTimeout(() => {
    logger.error('[Shutdown] Timeout — forcing exit.');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
