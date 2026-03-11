import express from 'express';
import fetch from 'node-fetch';
import { authenticateToken } from '../middleware/auth.js';
import { checkToolQuota, recordToolUsage } from '../middleware/toolQuota.js';
import logger from '../utils/logger.js';

const router = express.Router();

const SHODAN_API_BASE = 'https://api.shodan.io';

// Proxy all Shodan API calls through the Hub.
//
// The local MCP server sends requests to:
//   GET /api/shodan-proxy/v1/<path>?<query>
//   Authorization: Bearer <oap-device-jwt>
//
// This handler:
//   1. Verifies the caller is an authenticated OAP user (JWT check via authenticateToken).
//   2. Strips the user JWT and injects the real Shodan API key stored in SHODAN_HUB_API_KEY
//      as a query parameter (Shodan uses ?key= rather than a header).
//   3. Forwards the full request (method, path, query string, body) to the real Shodan API.
//   4. Streams the Shodan response back to the caller.
//   5. Records usage for billing / analytics.
router.all('/*', authenticateToken, checkToolQuota('shodan'), async (req, res) => {
  const shodanApiKey = process.env.SHODAN_HUB_API_KEY;
  if (!shodanApiKey) {
    logger.error('[Shodan-Proxy] SHODAN_HUB_API_KEY is not configured');
    return res.status(503).json({
      error: 'Shodan Hub integration is not configured on the server'
    });
  }

  // Build the target URL: strip the mount prefix (/shodan-proxy/v1) to get the Shodan path
  const shodanPath = req.path === '/' ? '' : req.path;

  // Merge existing query params and inject the API key
  const queryParams = new URLSearchParams(req.query);
  queryParams.set('key', shodanApiKey);
  const targetUrl = `${SHODAN_API_BASE}${shodanPath}?${queryParams.toString()}`;

  logger.info(`[Shodan-Proxy] ${req.method} ${SHODAN_API_BASE}${shodanPath} (user: ${req.user.email})`);

  const fetchOptions = {
    method: req.method,
    headers: {
      'Accept': req.headers['accept'] || 'application/json',
      'Content-Type': req.headers['content-type'] || 'application/json',
    },
  };

  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
    fetchOptions.body = JSON.stringify(req.body);
  }

  let shodanResponse;
  try {
    shodanResponse = await fetch(targetUrl, fetchOptions);
  } catch (err) {
    logger.error(`[Shodan-Proxy] Upstream fetch failed: ${err.message}`);
    return res.status(502).json({ error: 'Failed to reach Shodan API', details: err.message });
  }

  logger.info(`[Shodan-Proxy] Shodan responded ${shodanResponse.status} for ${req.method} ${shodanPath}`);

  // Async usage recording — fire and forget, never blocks response
  recordToolUsage(req, shodanPath).catch(() => {});

  // Forward status and key response headers
  res.status(shodanResponse.status);
  ['content-type'].forEach(h => {
    const val = shodanResponse.headers.get(h);
    if (val) res.setHeader(h, val);
  });

  // Stream the body back directly
  shodanResponse.body.pipe(res);
});

export default router;
