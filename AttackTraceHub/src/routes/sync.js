import express from 'express';
import { prisma } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { createResponse } from '../config/constants.js';
import logger from '../utils/logger.js';

const router = express.Router();

// GET /api/v1/sync/sessions - Get sessions for sync
router.get('/sessions', authenticateToken, async (req, res) => {
  try {
    const { lastSync, limit = 10, offset = 0 } = req.query;
    
    const where = {
      userId: req.user.id,
      isDeleted: false
    };
    
    // If lastSync provided, only get updated sessions
    if (lastSync) {
      where.updatedAt = {
        gt: new Date(lastSync)
      };
    }
    
    const sessions = await prisma.chatSession.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset),
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 100 // Limit messages per session
        }
      }
    });
    
    const totalCount = await prisma.chatSession.count({ where });
    
    res.json(createResponse({
      sessions,
      totalCount,
      hasMore: totalCount > parseInt(offset) + sessions.length
    }));
  } catch (error) {
    logger.error('Error fetching sessions for sync:', error);
    res.status(500).json(createResponse(null, 'Failed to fetch sessions'));
  }
});

// POST /api/v1/sync/sessions - Sync sessions from client
router.post('/sessions', authenticateToken, async (req, res) => {
  try {
    const { sessions } = req.body;
    
    if (!sessions || !Array.isArray(sessions)) {
      return res.status(400).json(createResponse(null, 'Invalid sessions data'));
    }
    
    const syncResults = [];
    
    for (const session of sessions) {
      try {
        // Upsert session
        const upsertedSession = await prisma.chatSession.upsert({
          where: { id: session.id },
          update: {
            title: session.title,
            updatedAt: new Date(session.updatedAt),
            lastSyncedAt: new Date(),
            isDeleted: session.isDeleted || false,
            deviceId: session.deviceId
          },
          create: {
            id: session.id,
            userId: req.user.id,
            title: session.title,
            createdAt: new Date(session.createdAt),
            updatedAt: new Date(session.updatedAt),
            lastSyncedAt: new Date(),
            deviceId: session.deviceId,
            isDeleted: session.isDeleted || false
          }
        });
        
        // Sync messages if provided
        if (session.messages && Array.isArray(session.messages)) {
          for (const message of session.messages) {
            await prisma.chatMessage.upsert({
              where: { id: message.id },
              update: {
                content: message.content,
                updatedAt: new Date(message.updatedAt),
                syncStatus: 'synced'
              },
              create: {
                id: message.id,
                sessionId: session.id,
                content: message.content,
                role: message.role,
                createdAt: new Date(message.createdAt),
                updatedAt: new Date(message.updatedAt),
                syncStatus: 'synced',
                deviceId: message.deviceId
              }
            });
          }
        }
        
        syncResults.push({
          sessionId: session.id,
          status: 'success'
        });
      } catch (error) {
        logger.error(`Error syncing session ${session.id}:`, error);
        syncResults.push({
          sessionId: session.id,
          status: 'error',
          error: error.message
        });
      }
    }
    
    res.json(createResponse({
      syncResults,
      syncedAt: new Date()
    }));
  } catch (error) {
    logger.error('Error syncing sessions:', error);
    res.status(500).json(createResponse(null, 'Failed to sync sessions'));
  }
});

// DELETE /api/v1/sync/sessions/:id - Mark session as deleted
router.delete('/sessions/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const session = await prisma.chatSession.updateMany({
      where: {
        id,
        userId: req.user.id
      },
      data: {
        isDeleted: true,
        updatedAt: new Date()
      }
    });
    
    if (session.count === 0) {
      return res.status(404).json(createResponse(null, 'Session not found'));
    }
    
    res.json(createResponse({
      message: 'Session deleted successfully'
    }));
  } catch (error) {
    logger.error('Error deleting session:', error);
    res.status(500).json(createResponse(null, 'Failed to delete session'));
  }
});

// GET /api/v1/sync/status - Get sync status
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const lastSync = await prisma.chatSession.findFirst({
      where: { userId: req.user.id },
      orderBy: { lastSyncedAt: 'desc' },
      select: { lastSyncedAt: true }
    });
    
    const pendingCount = await prisma.chatMessage.count({
      where: {
        session: {
          userId: req.user.id
        },
        syncStatus: 'pending'
      }
    });
    
    res.json(createResponse({
      lastSyncedAt: lastSync?.lastSyncedAt || null,
      pendingMessages: pendingCount,
      syncEnabled: true
    }));
  } catch (error) {
    logger.error('Error fetching sync status:', error);
    res.status(500).json(createResponse(null, 'Failed to fetch sync status'));
  }
});

export default router;
