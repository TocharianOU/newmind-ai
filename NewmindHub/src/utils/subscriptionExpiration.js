import { prisma } from '../config/database.js';
import logger from './logger.js';

/**
 * 检查并处理过期的订阅
 * 将过期的订阅降级到 BASE 套餐
 */
export async function checkExpiredSubscriptions() {
  try {
    const now = new Date();
    
    // 查找所有已过期但仍然活跃的订阅
    const expiredSubscriptions = await prisma.subscription.findMany({
      where: {
        isActive: true,
        isDefaultPlan: false,
        endDate: {
          lte: now // 结束日期 <= 当前时间
        }
      },
      include: {
        user: {
          select: {
            email: true
          }
        }
      }
    });
    
    if (expiredSubscriptions.length === 0) {
      logger.debug('✅ No expired subscriptions found');
      return;
    }
    
    logger.info(`📉 Found ${expiredSubscriptions.length} expired subscriptions`);
    
    // 批量降级到 BASE 套餐
    for (const subscription of expiredSubscriptions) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          planName: 'BASE',
          isDefaultPlan: true,
          isActive: true,
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          nextBillingDate: null
        }
      });
      
      logger.info(`📉 Downgraded subscription for user ${subscription.user.email} to BASE plan (expired)`);
    }
    
    logger.info(`✅ Processed ${expiredSubscriptions.length} expired subscriptions`);
  } catch (error) {
    logger.error('❌ Error checking expired subscriptions:', error);
  }
}

/**
 * 启动订阅过期检查定时任务
 * 每小时检查一次
 */
export function startSubscriptionExpirationCheck() {
  // 立即执行一次
  checkExpiredSubscriptions();
  
  // 每小时检查一次 (3600000 毫秒 = 1 小时)
  const intervalId = setInterval(checkExpiredSubscriptions, 3600000);
  
  logger.info('⏰ Subscription expiration check started (runs every hour)');
  
  return intervalId;
}

