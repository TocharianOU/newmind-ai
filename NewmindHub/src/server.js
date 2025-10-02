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

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) }}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
  logger.info(`🌐 CORS origins: ${process.env.ALLOWED_ORIGINS}`);
});
