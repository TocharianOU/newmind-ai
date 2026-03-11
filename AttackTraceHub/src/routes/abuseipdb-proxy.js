import express from 'express';
import fetch from 'node-fetch';
import { authenticateToken } from '../middleware/auth.js';
import { checkToolQuota, recordToolUsage } from '../middleware/toolQuota.js';
import logger from '../utils/logger.js';

const router = express.Router();

const ABUSEIPDB_API_BASE = 'https://api.abuseipdb.com/api/v2';

// Proxy all AbuseIPDB API calls through the Hub.
//
// The local MCP server sends requests to:
//   GET /api/abuseipdb-proxy/v2/<endpoint>?<query>
//   Authorization: Bearer <oap-device-jwt>
//
// This handler:
//   1. Verifies the caller is an authenticated OAP user (JWT check via authenticateToken).
//   2. Strips the user JWT and injects the real AbuseIPDB API key stored in
//      ABUSEIPDB_HUB_API_KEY as a "Key" header (AbuseIPDB native auth format).
//   3. Forwards the full request (method, path, query string, body) to the real AbuseIPDB API.
//   4. Streams the AbuseIPDB response back to the caller.
//   5. Records usage for billing / analytics.
router.all('/*', authenticateToken, checkToolQuota('abuseipdb'), async (req, res) => {
  const abuseipdbApiKey = process.env.ABUSEIPDB_HUB_API_KEY;
  if (!abuseipdbApiKey) {
    logger.error('[AbuseIPDB-Proxy] ABUSEIPDB_HUB_API_KEY is not configured');
    return res.status(503).json({
      error: 'AbuseIPDB Hub integration is not configured on the server'
    });
  }

  const apiPath = req.path === '/' ? '' : req.path;
  const queryParams = new URLSearchParams(req.query);
  const targetUrl = queryParams.toString()
    ? `${ABUSEIPDB_API_BASE}${apiPath}?${queryParams.toString()}`
    : `${ABUSEIPDB_API_BASE}${apiPath}`;

  logger.info(`[AbuseIPDB-Proxy] ${req.method} ${ABUSEIPDB_API_BASE}${apiPath} (user: ${req.user.email})`);

  const fetchOptions = {
    method: req.method,
    headers: {
      // AbuseIPDB uses the "Key" header for authentication (not Authorization)
      'Key': abuseipdbApiKey,
      'Accept': req.headers['accept'] || 'application/json',
      'Content-Type': req.headers['content-type'] || 'application/json',
    },
  };

  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
    fetchOptions.body = JSON.stringify(req.body);
  }

  let apiResponse;
  try {
    apiResponse = await fetch(targetUrl, fetchOptions);
  } catch (err) {
    logger.error(`[AbuseIPDB-Proxy] Upstream fetch failed: ${err.message}`);
    return res.status(502).json({ error: 'Failed to reach AbuseIPDB API', details: err.message });
  }

  logger.info(`[AbuseIPDB-Proxy] AbuseIPDB responded ${apiResponse.status} for ${req.method} ${apiPath}`);

  // Async usage recording — fire and forget, never blocks response
  recordToolUsage(req, apiPath).catch(() => {});

  // Forward status and key response headers
  res.status(apiResponse.status);
  ['content-type'].forEach(h => {
    const val = apiResponse.headers.get(h);
    if (val) res.setHeader(h, val);
  });

  // Stream the body back directly
  apiResponse.body.pipe(res);
});

export default router;
