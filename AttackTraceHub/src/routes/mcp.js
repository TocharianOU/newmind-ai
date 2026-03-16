import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { prisma } from '../config/database.js';
import { createResponse } from '../config/constants.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Helper function to safely parse JSON fields
const safeParseJSON = (jsonString, fallback = []) => {
  if (!jsonString) return fallback;
  if (Array.isArray(jsonString)) return jsonString;
  if (typeof jsonString === 'object') return jsonString;
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    logger.warn('Failed to parse JSON:', jsonString, error);
    return fallback;
  }
};

// POST /api/v1/user/mcp/search - Search MCP services
router.post('/user/mcp/search', authenticateToken, async (req, res) => {
  try {
    const { search_input, filter } = req.body;
    
    console.log('[MCP Search] Received search_input:', search_input, 'Type:', typeof search_input);
    
    // Build where clause
    const where = {
      isActive: true
    };

    if (search_input && search_input.trim() && search_input.trim() !== '') {
      console.log('[MCP Search] Applying name filter:', search_input.trim());
      where.name = { contains: search_input.trim(), mode: 'insensitive' };
    } else {
      console.log('[MCP Search] No search filter applied (empty search)');
    }

    // Filter by plan
    if (filter === 1) {
      where.planRequired = 'BASE';
    } else if (filter === 2) {
      where.planRequired = { in: ['BASE', 'PRO'] };
    }

    const servers = await prisma.mcpServer.findMany({ where });

    // Get language from Accept-Language header
    const acceptLanguage = req.headers['accept-language'];
    const lang = acceptLanguage?.split(',')[0]?.split('-')[0] || 'en';

    const results = servers.map(server => {
      const descriptionI18n = safeParseJSON(server.descriptionI18n, {});
      const documentI18n = safeParseJSON(server.documentI18n, {});
      
      return {
        id: server.id,
        name: server.name,
        plan: server.planRequired.toLowerCase(),
        description: descriptionI18n[lang] || server.description || '',
        tags: safeParseJSON(server.tags, []),
        transport: server.transport || 'stdio',
        command: server.command || null,
        args: safeParseJSON(server.args, []),
        url: server.url || null,
        env: safeParseJSON(server.env, {}),
        headers: safeParseJSON(server.headers, {}),
        logo: server.logo || null,
        banner: server.banner || null,
        document: documentI18n[lang] || server.document || '',
        version: server.version || null,
        downloadUrl: server.downloadUrl || null,
        configSchema: safeParseJSON(server.configSchema, null),
        tool_tier: server.toolTier || 'X',
        unit_price_usd: server.unitPriceUsd ?? 0,
        popular: server.popular || false,
        new: server.new || false
      };
    });

    res.json(createResponse(results));
  } catch (error) {
    logger.error('Error searching MCP servers:', error);
    res.status(500).json(createResponse(null, 'Failed to search MCP servers'));
  }
});

export default router;
