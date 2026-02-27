import express from 'express';
import fetch from 'node-fetch';
import { authenticateToken } from '../middleware/auth.js';
import { prisma } from '../config/database.js';
import logger from '../utils/logger.js';

const router = express.Router();

const VT_API_BASE = 'https://www.virustotal.com/api/v3';

// Proxy all VirusTotal API calls through the Hub.
//
// The local MCP server sends requests to:
//   POST/GET /api/vt-proxy/v3/<path>?<query>
//   Authorization: Bearer <oap-device-jwt>
//
// This handler:
//   1. Verifies the caller is an authenticated OAP user (JWT check via authenticateToken).
//   2. Strips the user JWT and injects the real VirusTotal API key stored in VIRUSTOTAL_HUB_API_KEY.
//   3. Forwards the full request (method, path, query string, body) to the real VT API.
//   4. Streams the VT response back to the caller.
//   5. Records usage for billing / analytics.
router.all('/*', authenticateToken, async (req, res) => {
  const vtApiKey = process.env.VIRUSTOTAL_HUB_API_KEY;
  if (!vtApiKey) {
    logger.error('[VT-Proxy] VIRUSTOTAL_HUB_API_KEY is not configured');
    return res.status(503).json({
      error: 'VirusTotal Hub integration is not configured on the server'
    });
  }

  // Build the target URL: strip the mount prefix (/vt-proxy/v3) to get the VT path
  const vtPath = req.path === '/' ? '' : req.path;
  const queryString = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  const targetUrl = `${VT_API_BASE}${vtPath}${queryString}`;

  logger.info(`[VT-Proxy] ${req.method} ${targetUrl} (user: ${req.user.email})`);

  // Forward headers, replacing auth with VT API key
  const forwardHeaders = {
    'x-apikey': vtApiKey,
    'Accept': req.headers['accept'] || 'application/json',
    'Content-Type': req.headers['content-type'] || 'application/json',
  };

  // Build fetch options
  const fetchOptions = {
    method: req.method,
    headers: forwardHeaders,
  };

  // Forward body for methods that carry one
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
    fetchOptions.body = JSON.stringify(req.body);
  }

  let vtResponse;
  try {
    vtResponse = await fetch(targetUrl, fetchOptions);
  } catch (err) {
    logger.error(`[VT-Proxy] Upstream fetch failed: ${err.message}`);
    return res.status(502).json({ error: 'Failed to reach VirusTotal API', details: err.message });
  }

  logger.info(`[VT-Proxy] VT responded ${vtResponse.status} for ${req.method} ${vtPath}`);

  // Async usage recording — fire and forget, never blocks response
  recordVtUsage(req.user.id, req.method, vtPath, vtResponse.status).catch(() => {});

  // Forward status and key response headers
  res.status(vtResponse.status);
  const passthroughHeaders = ['content-type', 'x-apikey-remaining', 'x-apikey-minuteallowance'];
  passthroughHeaders.forEach(h => {
    const val = vtResponse.headers.get(h);
    if (val) res.setHeader(h, val);
  });

  // Stream the body back directly
  vtResponse.body.pipe(res);
});

async function recordVtUsage(userId, method, path, statusCode) {
  try {
    await prisma.usageRecord.create({
      data: {
        userId,
        modelName: 'virustotal-hub',
        inputTokens: 1,
        outputTokens: 0,
        cost: 0.0001,
      }
    });
  } catch (err) {
    // Non-critical — a missing usageRecord schema field should not break the proxy
    logger.debug(`[VT-Proxy] Usage record skipped: ${err.message}`);
  }
}

export default router;
