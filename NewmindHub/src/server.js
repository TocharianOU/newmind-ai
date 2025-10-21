import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

// Load environment variables
dotenv.config();

// Import routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import modelRoutes from './routes/models.js';
import proxyRoutes from './routes/proxy.js';
import mcpRoutes from './routes/mcp.js';
import llmRoutes from './routes/llms.js';
import systemPromptRoutes from './routes/system-prompt.js';
// import syncRoutes from './routes/sync.js';

// Import middleware
import { errorHandler } from './middleware/errorHandler.js';
import { rateLimiter } from './middleware/rateLimiter.js';

// Import utilities
import logger from './utils/logger.js';

// Create Express app
const app = express();
const server = createServer(app);

// WebSocket server for /api/v1/socket
const wss = new WebSocketServer({ 
  server,
  path: '/api/v1/socket'
});

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:3000',
  'http://localhost:3001'
];

// Add Hub frontend URL if specified
if (process.env.HUB_FRONTEND_URL) {
  allowedOrigins.push(process.env.HUB_FRONTEND_URL);
}

// Middleware
// 配置 helmet 以兼容 Tor 浏览器和现代前端框架
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // 允许 inline scripts 和 eval（Vite 需要）
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"], // 允许 inline styles
      imgSrc: ["'self'", "data:", "blob:", "https:", "http:"], // 允许各种来源的图片
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      connectSrc: ["'self'", "http://xiaopenges.tocharian.eu:11234", "http://xiaopenges.tocharian.eu:23000", "http://localhost:23000", "https:", "http:"], // 允许 API 连接
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false, // 关闭以避免下载问题
  crossOriginResourcePolicy: { policy: "cross-origin" } // 允许跨域资源
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
// 移除所有请求体大小限制，直到大模型报错为止
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting
app.use('/api/', rateLimiter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    service: 'NewmindHub',
    timestamp: new Date().toISOString()
  });
});

// API Routes - Re-enabled for authentication
app.use('/api/auth', authRoutes);        // Dive expects this path for login
app.use('/api/v1/user', userRoutes);
app.use('/api/v1', modelRoutes);
app.use('/api/v1', proxyRoutes);
app.use('/api/v1', mcpRoutes);
app.use('/api/v1', llmRoutes);
app.use('/api/v1/system-prompt', systemPromptRoutes);
// app.use('/api/v1/sync', syncRoutes);     // Cloud sync endpoints (still disabled)

// WebSocket handling
wss.on('connection', (ws, req) => {
  logger.info('WebSocket client connected');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      logger.info('WebSocket message received:', data);
      
      // Handle different message types
      switch(data.type) {
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
        case 'subscribe':
          // Handle subscription logic
          ws.send(JSON.stringify({ 
            type: 'subscribed',
            channel: data.channel 
          }));
          break;
        default:
          ws.send(JSON.stringify({ 
            type: 'error',
            message: 'Unknown message type' 
          }));
      }
    } catch (error) {
      logger.error('WebSocket message error:', error);
      ws.send(JSON.stringify({ 
        type: 'error',
        message: 'Invalid message format' 
      }));
    }
  });
  
  ws.on('close', () => {
    logger.info('WebSocket client disconnected');
  });
  
  ws.on('error', (error) => {
    logger.error('WebSocket error:', error);
  });
});

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

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`🚀 NewmindHub server running on port ${PORT}`);
  logger.info(`📊 Environment: ${process.env.NODE_ENV}`);
  logger.info(`🌐 CORS origins: ${allowedOrigins.join(',')}`);
});
