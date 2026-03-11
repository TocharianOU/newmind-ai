import { prisma } from '../config/database.js';
import logger from './logger.js';
import { writeAudit, AUDIT_ACTIONS, RESOURCE_TYPES } from './auditLog.js';

/**
 * 增加用户 Token 余额
 * @param {string} userId - 用户 ID
 * @param {number} amount - Token 数量
 * @param {string} transactionId - 交易 ID（用于日志）
 */
export async function addTokens(userId, amount, transactionId) {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { tokenBalance: { increment: amount } }
    });
    
    logger.info(`Added ${amount} tokens to user ${userId} (transaction: ${transactionId})`);

    writeAudit(null, {
      userId,
      action: AUDIT_ACTIONS.TOKEN_ADDED,
      resourceType: RESOURCE_TYPES.TOKEN,
      metadata: { amount, transactionId },
    });
  } catch (error) {
    logger.error(`Failed to add tokens to user ${userId}:`, error);
    throw error;
  }
}

/**
 * 扣减用户 Token 余额
 * @param {string} userId - 用户 ID
 * @param {number} amount - Token 数量
 */
export async function deductTokens(userId, amount) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tokenBalance: true }
    });
    
    if (!user) {
      throw new Error('User not found');
    }
    
    if (user.tokenBalance < amount) {
      throw new Error('Insufficient token balance');
    }
    
    await prisma.user.update({
      where: { id: userId },
      data: { tokenBalance: { decrement: amount } }
    });
    
    writeAudit(null, {
      userId,
      action: AUDIT_ACTIONS.TOKEN_DEDUCTED,
      resourceType: RESOURCE_TYPES.TOKEN,
      metadata: { amount },
    });
  } catch (error) {
    if (error.message === 'Insufficient token balance') {
      logger.warn(`⚠️ User ${userId} has insufficient tokens (needed: ${amount}, available: ${user?.tokenBalance || 0})`);
    } else {
      logger.error(`❌ Failed to deduct tokens from user ${userId}:`, error);
    }
    throw error;
  }
}

/**
 * 检查用户 Token 余额
 * @param {string} userId - 用户 ID
 * @returns {Promise<number>} Token 余额
 */
export async function checkBalance(userId) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tokenBalance: true }
    });
    
    return user?.tokenBalance || 0;
  } catch (error) {
    logger.error(`❌ Failed to check balance for user ${userId}:`, error);
    throw error;
  }
}

