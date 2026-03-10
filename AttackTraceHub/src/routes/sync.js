/**
 * Chat history sync endpoints.
 *
 * The Electron client calls:
 *   POST /api/v1/user/sync/push  – upload local SQLite data to Hub (push)
 *   GET  /api/v1/user/sync/pull  – download Hub data back to local SQLite (pull)
 *
 * Payload format (mirrors the Python mcp-host SyncPayload model):
 *   {
 *     project_id : string            – local project slug, e.g. "default"
 *     chats      : SyncChatRecord[]
 *     messages   : SyncMessageRecord[]
 *   }
 *
 * SyncChatRecord    : { id, title, created_at, updated_at, starred_at }
 * SyncMessageRecord : { message_id, chat_id, content, role, created_at,
 *                       files, tool_calls }
 *
 * Data isolation:
 *   - All records are scoped to the authenticated user (req.user.id).
 *   - project_id is resolved to a Hub Project row (created on-demand) so that
 *     each user's projects remain isolated.
 *   - Pushes are idempotent: existing chats are updated; messages are skipped
 *     if their message_id already exists on the Hub.
 */

import express from 'express';
import crypto from 'crypto';
import { prisma } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { writeAudit, AUDIT_ACTIONS, RESOURCE_TYPES } from '../utils/auditLog.js';
import logger from '../utils/logger.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { SyncPushSchema, SyncPullQuerySchema } from '../schemas/sync.schemas.js';

const router = express.Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Unified response shape matching what the Electron syncService expects. */
function syncResponse(success, data = null, message = '') {
  return { success, data, message };
}

/**
 * Find the Hub Project for a given user + local project slug.
 * Creates the project if it does not exist yet so the first push always works.
 */
async function findOrCreateProject(userId, projectSlug) {
  let project = await prisma.project.findFirst({
    where: { userId, name: projectSlug },
  });

  if (!project) {
    project = await prisma.project.create({
      data: {
        id: crypto.randomUUID(),
        name: projectSlug,
        userId,
        isDefault: projectSlug === 'default',
        updatedAt: new Date(),
      },
    });
    logger.info(`[Sync] Created Hub project "${projectSlug}" for user ${userId}`);
  }

  return project;
}

/**
 * Map local role strings to the Hub's MessageRole enum values.
 * The mcp-host may emit "tool" or other variants; we normalise them here.
 */
function mapRole(role) {
  const map = {
    user: 'user',
    human: 'user',
    assistant: 'assistant',
    ai: 'assistant',
    tool: 'tool_call',
    tool_call: 'tool_call',
    tool_calls: 'tool_call',
    tool_result: 'tool_result',
    tool_results: 'tool_result',
  };
  return map[role?.toLowerCase()] ?? 'assistant';
}

// ---------------------------------------------------------------------------
// POST /push  – client → Hub
// ---------------------------------------------------------------------------

router.post('/push', authenticateToken, validateBody(SyncPushSchema), async (req, res) => {
  const { project_id = 'default', chats = [], messages = [] } = req.body;
  const userId = req.user.id;

  try {
    const project = await findOrCreateProject(userId, project_id);

    const { chatCount, msgCount } = await prisma.$transaction(async (tx) => {
      let pushedChats = 0;
      let pushedMessages = 0;

      // ── Upsert chat sessions with ownership guard ───────────────────────
      for (const chat of chats) {
        if (!chat.id || !chat.title) continue;

        const existing = await tx.chatSession.findUnique({
          where: { id: chat.id },
          select: { id: true, userId: true },
        });

        // Never allow cross-user updates even if an ID collides.
        if (existing && existing.userId !== userId) {
          logger.warn(
            `[Sync] Skip chat ${chat.id}: belongs to another user`,
          );
          continue;
        }

        if (existing) {
          await tx.chatSession.update({
            where: { id: chat.id },
            data: {
              projectId: project.id,
              title: chat.title,
              isStarred: !!chat.starred_at,
              starredAt: chat.starred_at ? new Date(chat.starred_at) : null,
              updatedAt: chat.updated_at ? new Date(chat.updated_at) : new Date(),
            },
          });
        } else {
          await tx.chatSession.create({
            data: {
              id: chat.id,
              userId,
              projectId: project.id,
              title: chat.title,
              isStarred: !!chat.starred_at,
              starredAt: chat.starred_at ? new Date(chat.starred_at) : null,
              createdAt: chat.created_at ? new Date(chat.created_at) : new Date(),
              updatedAt: chat.updated_at ? new Date(chat.updated_at) : new Date(),
            },
          });
        }
        pushedChats++;
      }

      // ── Insert messages (idempotent in user scope) ──────────────────────
      for (const msg of messages) {
        if (!msg.message_id || !msg.chat_id) continue;

        // Parent chat must exist and belong to this user.
        const chatExists = await tx.chatSession.findFirst({
          where: { id: msg.chat_id, userId, projectId: project.id },
          select: { id: true },
        });
        if (!chatExists) continue;

        // Scope dedupe by (userId, messageId) to avoid cross-user bleed.
        const exists = await tx.message.findFirst({
          where: { userId, messageId: msg.message_id },
          select: { id: true },
        });
        if (exists) continue;

        const createdAt = msg.created_at ? new Date(msg.created_at) : new Date();
        await tx.message.create({
          data: {
            id: crypto.randomUUID(),
            chatSessionId: msg.chat_id,
            userId,
            role: mapRole(msg.role),
            content: msg.content ?? '',
            messageId: msg.message_id,
            toolCalls: msg.tool_calls ?? null,
            // Store the `files` JSON string inside the attachments blob
            attachments: msg.files && msg.files !== '[]'
              ? { files: msg.files }
              : null,
            createdAt,
          },
        });
        // Keep chat updatedAt aligned to latest message timestamp.
        await tx.chatSession.updateMany({
          where: { id: msg.chat_id, userId },
          data: { updatedAt: createdAt },
        });
        pushedMessages++;
      }

      return { chatCount: pushedChats, msgCount: pushedMessages };
    });

    logger.info(`[Sync] Push: user=${userId} project=${project_id} chats=${chatCount} msgs=${msgCount}`);

    await writeAudit(req, {
      userId,
      action: AUDIT_ACTIONS.SYNC_PUSH,
      resourceType: RESOURCE_TYPES.SYNC,
      resourceId: project.id,
      projectId: project.id,
      metadata: { project_id, chatCount, msgCount },
    });

    res.json(syncResponse(true, { chatCount, msgCount },
      `Pushed ${chatCount} chats, ${msgCount} messages`));

  } catch (err) {
    logger.error('[Sync] Push error:', err);
    res.status(500).json(syncResponse(false, null, err.message));
  }
});

// ---------------------------------------------------------------------------
// GET /pull  – Hub → client
// ---------------------------------------------------------------------------

router.get('/pull', authenticateToken, validateQuery(SyncPullQuerySchema), async (req, res) => {
  const { project_id = 'default', since } = req.query;
  const userId = req.user.id;

  try {
    // Look up the Hub project for this user+slug
    const project = await prisma.project.findFirst({
      where: { userId, name: project_id },
      select: { id: true },
    });

    if (!project) {
      // No data on Hub for this project yet – return empty payload
      return res.json(syncResponse(true, { project_id, chats: [], messages: [] }));
    }

    let hubChats = [];
    let hubMessages = [];

    if (since) {
      const sinceDate = new Date(since);

      // Chats explicitly updated since last sync.
      const changedChats = await prisma.chatSession.findMany({
        where: { userId, projectId: project.id, updatedAt: { gt: sinceDate } },
        orderBy: { updatedAt: 'asc' },
      });

      // Messages created since last sync for this user+project.
      // We scope by the project's chat IDs to avoid relation-filter ambiguity.
      const projectChatIds = (
        await prisma.chatSession.findMany({
          where: { userId, projectId: project.id },
          select: { id: true },
        })
      ).map(c => c.id);

      if (projectChatIds.length > 0) {
        hubMessages = await prisma.message.findMany({
          where: {
            userId,
            chatSessionId: { in: projectChatIds },
            messageId: { not: null },
            createdAt: { gt: sinceDate },
          },
          orderBy: { createdAt: 'asc' },
        });
      }

      const changedChatIds = new Set(changedChats.map(c => c.id));
      for (const m of hubMessages) changedChatIds.add(m.chatSessionId);

      if (changedChatIds.size > 0) {
        hubChats = await prisma.chatSession.findMany({
          where: {
            userId,
            projectId: project.id,
            id: { in: Array.from(changedChatIds) },
          },
          orderBy: { updatedAt: 'asc' },
        });
      }
    } else {
      hubChats = await prisma.chatSession.findMany({
        where: { userId, projectId: project.id },
        orderBy: { updatedAt: 'asc' },
      });

      const chatIds = hubChats.map(c => c.id);
      if (chatIds.length > 0) {
        hubMessages = await prisma.message.findMany({
          where: {
            userId,
            chatSessionId: { in: chatIds },
            messageId: { not: null },   // Only return messages with a client UUID
          },
          orderBy: { createdAt: 'asc' },
        });
      }
    }

    // ── Map to client payload format ──────────────────────────────────────
    const chats = hubChats.map(c => ({
      id: c.id,
      title: c.title,
      created_at: c.createdAt.toISOString(),
      updated_at: c.updatedAt.toISOString(),
      starred_at: c.starredAt ? c.starredAt.toISOString() : null,
    }));

    const messages = hubMessages.map(m => ({
      message_id: m.messageId,
      chat_id: m.chatSessionId,
      content: m.content,
      role: m.role,
      created_at: m.createdAt.toISOString(),
      files: m.attachments?.files ?? '[]',
      tool_calls: m.toolCalls ?? null,
    }));

    logger.info(`[Sync] Pull: user=${userId} project=${project_id} chats=${chats.length} msgs=${messages.length}`);

    await writeAudit(req, {
      userId,
      action: AUDIT_ACTIONS.SYNC_PULL,
      resourceType: RESOURCE_TYPES.SYNC,
      resourceId: project?.id ?? null,
      projectId: project?.id ?? null,
      metadata: { project_id, chatCount: chats.length, msgCount: messages.length, since: since ?? null },
    });

    res.json(syncResponse(true, { project_id, chats, messages }));

  } catch (err) {
    logger.error('[Sync] Pull error:', err);
    res.status(500).json(syncResponse(false, null, err.message));
  }
});

export default router;
