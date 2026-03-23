import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables BEFORE importing feature flags or any config that reads process.env
dotenv.config();

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import feature flags (reads process.env at evaluation time — must come after dotenv.config)
// Because static imports are hoisted in ES modules, featureFlags.js also calls dotenv.config()
// internally as a guard; see featureFlags.js for details.
import featureFlags from './config/featureFlags.js';

// Import routes
import authRoutes from './routes/auth.js';
import ssoRoutes from './routes/sso.js';
import userRoutes from './routes/user.js';
import modelRoutes from './routes/models.js';
import proxyRoutes from './routes/proxy.js';
import mcpRoutes from './routes/mcp.js';
import llmRoutes from './routes/llms.js';
import systemPromptRoutes from './routes/system-prompt.js';
import projectRoutes from './routes/projects.js';
import auditRoutes from './routes/audit.js';
import vtProxyRoutes from './routes/vt-proxy.js';
import shodanProxyRoutes from './routes/shodan-proxy.js';
import abuseipdbProxyRoutes from './routes/abuseipdb-proxy.js';
import syncRoutes from './routes/sync.js';
import customModelsRoutes from './routes/customModels.js';
import adminBillingRoutes from './routes/adminBilling.js';
import mcpProxyRoutes from './routes/mcp-proxy.js';

// Import middleware
import { errorHandler } from './middleware/errorHandler.js';
import { rateLimiter, authLimiter, paymentLimiter, paymentReadLimiter, syncLimiter } from './middleware/rateLimiter.js';

// Import utilities
import logger from './utils/logger.js';
import { startSubscriptionExpirationCheck } from './utils/subscriptionExpiration.js';
import { initializeSSOProviders } from './sso/index.js';
import { prisma } from './config/database.js';
import { startLicenseCheck } from './license/scheduler.js'
import { startAuditFileCleanup } from './utils/auditFileWriter.js';
import { syncToolPricingFromConfigs } from './middleware/toolQuota.js';

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------

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

if (process.env.HUB_FRONTEND_URL) {
  allowedOrigins.push(process.env.HUB_FRONTEND_URL);
}

// Build CSP connectSrc list
const cspConnectSrc = ["'self'", "http://localhost:23000", "https:", "http:"];
if (process.env.CUSTOM_LMSTUDIO_URL) cspConnectSrc.push(process.env.CUSTOM_LMSTUDIO_URL);
if (process.env.HUB_FRONTEND_URL) cspConnectSrc.push(process.env.HUB_FRONTEND_URL);

const useHttps = (process.env.FORCE_HTTPS === 'true');
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      connectSrc: cspConnectSrc,
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'self'"],
      ...(useHttps ? { upgradeInsecureRequests: [] } : {})
    }
  },
  hsts: useHttps,
  crossOriginOpenerPolicy: useHttps,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// ---------------------------------------------------------------------------
// Static files — mounted BEFORE CORS so that CSS/JS/image assets served with
// the Vite-generated `crossorigin` attribute are never rejected by the origin
// allow-list. Only API routes need CORS checking.
// ---------------------------------------------------------------------------
app.use('/integrations', express.static(path.join(__dirname, '../integrations')));

const APP_DIST_PATH = process.env.APP_DIST_PATH || path.join(__dirname, '../app-dist');
if (process.env.SERVE_WEB_APP !== 'false') {
  app.use('/app', express.static(APP_DIST_PATH, { index: false }));
  app.get('/app', (_req, res) => res.sendFile(path.join(APP_DIST_PATH, 'index.html')));
  app.get('/app/*', (_req, res) => res.sendFile(path.join(APP_DIST_PATH, 'index.html')));
  logger.info(`[Web App] Serving SPA from ${APP_DIST_PATH} at /app`);
}

const CONSOLE_DIST_PATH = process.env.CONSOLE_DIST_PATH || path.join(__dirname, '../console-dist');
if (process.env.SERVE_CONSOLE !== 'false') {
  app.use('/console', express.static(CONSOLE_DIST_PATH, { index: false }));
  app.get('/console', (_req, res) => res.sendFile(path.join(CONSOLE_DIST_PATH, 'index.html')));
  app.get('/console/*', (_req, res) => res.sendFile(path.join(CONSOLE_DIST_PATH, 'index.html')));
  logger.info(`[Console] Serving admin console from ${CONSOLE_DIST_PATH} at /console`);
}

// ---------------------------------------------------------------------------
// CORS — applies to API routes only (static files already handled above)
// ---------------------------------------------------------------------------
app.use(cors({
  origin: (origin, callback) => {
    if (allowedOrigins.includes('*') || !origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Range'],
  exposedHeaders: ['Content-Length', 'Content-Range', 'Accept-Ranges']
}));

app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// ---------------------------------------------------------------------------
// Conditional route setup — must happen before express.json() for webhook raw body
// Uses top-level await (Node.js ES module feature)
// ---------------------------------------------------------------------------

// ⚠️ CRITICAL: Stripe webhook requires raw body — mount BEFORE express.json()
if (featureFlags.BILLING_ENABLED) {
  const { stripeWebhookHandler } = await import('./routes/payment.js');
  app.post('/api/v1/payment/webhook', express.raw({ type: 'application/json' }), stripeWebhookHandler);
  logger.info('[Routes] Stripe payment routes enabled (SaaS mode)');
} else {
  logger.info('[Routes] Stripe payment routes disabled (enterprise mode)');
}

// MCP Host reverse proxy — MUST be mounted BEFORE body parsers so that
// multipart/form-data and streaming request bodies are piped raw to the
// upstream without express consuming them.
if (process.env.MCP_HOST_URL) {
  app.use('/', mcpProxyRoutes);
  logger.info(`[mcp-proxy] Proxying MCP Host routes → ${process.env.MCP_HOST_URL}`);
}

// Body parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting
app.use('/api/', rateLimiter);

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      service: 'OAP-Platform',
      mode: featureFlags.DEPLOYMENT_MODE,
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

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

// SSO must be registered before /api/auth to avoid matching authRoutes first
app.use('/api/auth/sso', authLimiter, ssoRoutes);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/v1/user/sync', syncLimiter, syncRoutes); // sync before /api/v1/user
app.use('/api/v1/user', userRoutes);
app.use('/api/v1', modelRoutes);
app.use('/api/v1', proxyRoutes);
app.use('/api/v1', mcpRoutes);
app.use('/api/v1', llmRoutes);
app.use('/api/v1/system-prompt', systemPromptRoutes);

// Payment routes — SaaS only
if (featureFlags.BILLING_ENABLED) {
  const { default: paymentRoutes } = await import('./routes/payment.js');
  const paymentRateSplit = (req, _res, next) => {
    if (req.method === 'GET') return paymentReadLimiter(req, _res, next);
    return paymentLimiter(req, _res, next);
  };
  app.use('/api/v1/payment', paymentRateSplit, paymentRoutes);
}

// License routes — Enterprise only
if (featureFlags.LICENSE_ENABLED) {
  const { default: licenseRoutes } = await import('./routes/license.js');
  app.use('/api/v1/license', licenseRoutes);
  logger.info('[Routes] License routes enabled (enterprise mode)');
}

app.use('/api/v1/admin/custom-models', customModelsRoutes);
app.use('/api/v1/admin/billing', adminBillingRoutes);
app.use('/api/v1/projects', projectRoutes);
app.use('/api/v1/audit', auditRoutes);
app.use('/api/vt-proxy/v3', vtProxyRoutes);
app.use('/api/shodan-proxy/v1', shodanProxyRoutes);
app.use('/api/abuseipdb-proxy/v2', abuseipdbProxyRoutes);

// (MCP Host proxy is mounted early — before body parsers — see above)

// ---------------------------------------------------------------------------
// Error handlers
// ---------------------------------------------------------------------------
app.use(errorHandler);

app.use((req, res) => {
  res.status(404).json({ status: 'error', error: 'Not Found', data: null });
});

// ---------------------------------------------------------------------------
// Initialize services and start
// ---------------------------------------------------------------------------

initializeSSOProviders();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`🚀 OAP Platform server running on port ${PORT}`);
  logger.info(`📊 Environment: ${process.env.NODE_ENV}`);
  logger.info(`🚦 Deployment mode: ${featureFlags.DEPLOYMENT_MODE.toUpperCase()}`);
  logger.info(`🌐 CORS origins: ${allowedOrigins.join(', ')}`);

  // Audit file writer: daily JSONL rotation + cleanup
  startAuditFileCleanup();

  // Sync tool tier/pricing from integration configs into DB
  syncToolPricingFromConfigs().catch(e => logger.warn(`Tool pricing sync: ${e.message}`));

  // SaaS: watch for subscription expiry
  if (featureFlags.BILLING_ENABLED) {
    startSubscriptionExpirationCheck();
  }

  // Enterprise: periodic license validity check
  if (featureFlags.LICENSE_ENABLED) {
    startLicenseCheck();
  }
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------
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
  setTimeout(() => {
    logger.error('[Shutdown] Timeout — forcing exit.');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
