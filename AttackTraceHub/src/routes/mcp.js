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

// GET /api/v1/user/mcp/configs - Get user's MCP configurations
router.get('/user/mcp/configs', authenticateToken, async (req, res) => {
  try {
    const userConfigs = await prisma.userMcpConfig.findMany({
      where: { 
        userId: req.user.id,
        enabled: true
      },
      include: {
        mcpServer: true
      }
    });

    // Get language from Accept-Language header
    const acceptLanguage = req.headers['accept-language'];
    const lang = acceptLanguage?.split(',')[0]?.split('-')[0] || 'en';

    const configs = userConfigs.map(config => {
      const descriptionI18n = safeParseJSON(config.mcpServer.descriptionI18n, {});
      const documentI18n = safeParseJSON(config.mcpServer.documentI18n, {});
      
      return {
        id: config.mcpServer.id,
        name: config.mcpServer.name,
        plan: config.mcpServer.planRequired.toLowerCase(),
        description: descriptionI18n[lang] || config.mcpServer.description || '',
        tags: safeParseJSON(config.mcpServer.tags, []),
        transport: config.mcpServer.transport || 'stdio',
        command: config.mcpServer.command || null,
        args: safeParseJSON(config.mcpServer.args, []),
        url: config.mcpServer.url || null,
        env: safeParseJSON(config.mcpServer.env, {}),
        headers: safeParseJSON(config.mcpServer.headers, {}),
        banner: config.mcpServer.banner || null,
        document: documentI18n[lang] || config.mcpServer.document || '',
        version: config.mcpServer.version || null,
        downloadUrl: config.mcpServer.downloadUrl || null,
        configSchema: safeParseJSON(config.mcpServer.configSchema, null),
        token_cost: config.mcpServer.tokenCost || 0,
        token_required: config.mcpServer.tokenRequired || 0,
        token_price_unit: config.mcpServer.tokenPriceUnit || 'request',
        popular: config.mcpServer.popular || false,
        new: config.mcpServer.new || false
      };
    });

    res.json(createResponse(configs));
  } catch (error) {
    logger.error('Error fetching MCP configs:', error);
    res.status(500).json(createResponse(null, 'Failed to fetch MCP configs'));
  }
});

// POST /api/v1/user/mcp/search - Search MCP services
router.post('/user/mcp/search', authenticateToken, async (req, res) => {
  try {
    const { search_input, filter } = req.body;
    
    // Build where clause
    const where = {
      isActive: true
    };

    if (search_input) {
      where.OR = [
        { name: { contains: search_input } },
        { description: { contains: search_input } }
      ];
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
        banner: server.banner || null,
        document: documentI18n[lang] || server.document || '',
        version: server.version || null,
        downloadUrl: server.downloadUrl || null,
        configSchema: safeParseJSON(server.configSchema, null),
        token_cost: server.tokenCost || 0,
        token_required: server.tokenRequired || 0,
        token_price_unit: server.tokenPriceUnit || 'request',
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

// POST /api/v1/user/mcp/apply - Apply for MCP services
router.post('/user/mcp/apply', authenticateToken, async (req, res) => {
  try {
    const ids = req.body; // Array of MCP server IDs
    
    if (!Array.isArray(ids)) {
      return res.status(400).json(createResponse(null, 'Invalid request format'));
    }

    // Create user configs for each server
    const configs = await Promise.all(
      ids.map(async (serverId) => {
        const existing = await prisma.userMcpConfig.findUnique({
          where: {
            userId_mcpServerId: {
              userId: req.user.id,
              mcpServerId: serverId
            }
          }
        });

        if (existing) {
          return prisma.userMcpConfig.update({
            where: { id: existing.id },
            data: { enabled: true }
          });
        }

        return prisma.userMcpConfig.create({
          data: {
            userId: req.user.id,
            mcpServerId: serverId,
            enabled: true
          }
        });
      })
    );

    res.json(createResponse({ applied: configs.length }));
  } catch (error) {
    logger.error('Error applying MCP servers:', error);
    res.status(500).json(createResponse(null, 'Failed to apply MCP servers'));
  }
});

export default router;
