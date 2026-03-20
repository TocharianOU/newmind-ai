/**
 * MCP Host reverse proxy for web deployment.
 *
 * Routes:  /api/chat/*, /api/tools/*, /api/config/*, /api/memory/*,
 *          /api/sync/*, /api/plugins/*, /v1/openai/*, /model_verify/*
 *
 * The Hub validates the user's JWT (via authenticateToken), then forwards the
 * request to the internal MCP Host with:
 *   X-Auth-Token  — shared internal secret (MCP_HOST_INTERNAL_TOKEN)
 *   X-User-ID     — extracted from the validated JWT
 *   X-Project-ID  — forwarded as-is from the original request
 *
 * SSE streaming is fully supported: response headers and body are piped
 * directly from the MCP Host to the browser without buffering.
 */

import http from 'node:http';
import https from 'node:https';
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const router = Router();

const MCP_HOST_URL = process.env.MCP_HOST_URL || 'http://localhost:8100';
const MCP_HOST_INTERNAL_TOKEN = process.env.MCP_HOST_INTERNAL_TOKEN || '';

if (!MCP_HOST_INTERNAL_TOKEN) {
  logger.warn('[mcp-proxy] MCP_HOST_INTERNAL_TOKEN is not set — MCP Host requests will be rejected.');
}

const mcpHostUrl = new URL(MCP_HOST_URL);
const transport = mcpHostUrl.protocol === 'https:' ? https : http;

/**
 * Forward an Express request to the MCP Host and stream the response back.
 * Handles both regular JSON responses and SSE (text/event-stream).
 */
function proxyToMcpHost(req, res, userId) {
  const targetPath = req.originalUrl; // preserves query string

  const options = {
    hostname: mcpHostUrl.hostname,
    port: mcpHostUrl.port || (mcpHostUrl.protocol === 'https:' ? 443 : 80),
    path: targetPath,
    method: req.method,
    headers: {
      ...req.headers,
      host: mcpHostUrl.host,
      'x-auth-token': MCP_HOST_INTERNAL_TOKEN,
      'x-user-id': userId || '',
      // Forward project ID unchanged
    },
  };

  // Remove hop-by-hop headers that must not be forwarded
  delete options.headers['authorization'];
  delete options.headers['connection'];
  delete options.headers['upgrade'];
  delete options.headers['transfer-encoding'];

  const proxyReq = transport.request(options, (proxyRes) => {
    // Forward status + headers
    const responseHeaders = { ...proxyRes.headers };
    delete responseHeaders['transfer-encoding']; // let Node handle chunking

    res.writeHead(proxyRes.statusCode || 502, responseHeaders);

    // Pipe response body — this works for both JSON and SSE streams
    proxyRes.pipe(res, { end: true });

    proxyRes.on('error', (err) => {
      logger.error('[mcp-proxy] Upstream response error:', err.message);
      if (!res.headersSent) {
        res.status(502).json({ error: 'Bad Gateway', message: err.message });
      } else {
        res.end();
      }
    });
  });

  proxyReq.on('error', (err) => {
    logger.error('[mcp-proxy] Upstream connection error:', err.message);
    if (!res.headersSent) {
      res.status(502).json({ error: 'Bad Gateway', message: 'MCP Host unreachable' });
    } else {
      res.end();
    }
  });

  // Forward request body for POST/PUT/PATCH
  if (req.body && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const bodyStr = JSON.stringify(req.body);
    proxyReq.setHeader('content-length', Buffer.byteLength(bodyStr));
    proxyReq.write(bodyStr);
    proxyReq.end();
  } else if (req.readable) {
    req.pipe(proxyReq, { end: true });
  } else {
    proxyReq.end();
  }
}

// Middleware: authenticate JWT, then proxy
function mcpProxyHandler(req, res) {
  authenticateToken(req, res, () => {
    const userId = req.user?.id || req.user?.userId || '';
    proxyToMcpHost(req, res, userId);
  });
}

// Register proxy routes — all MCP Host path prefixes
const MCP_PREFIXES = [
  '/api/chat',
  '/api/tools',
  '/api/config',
  '/api/memory',
  '/api/sync',
  '/api/plugins',
  '/v1/openai',
  '/model_verify',
  '/health',
];

for (const prefix of MCP_PREFIXES) {
  router.all(`${prefix}`, mcpProxyHandler);
  router.all(`${prefix}/*`, mcpProxyHandler);
}

export default router;
