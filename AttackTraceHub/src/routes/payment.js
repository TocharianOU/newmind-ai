import express from 'express';
import { stripe, TOKEN_PACKAGES, SUBSCRIPTION_PLANS, PLAN_HIERARCHY, TOOL_QUOTA_PACKAGES } from '../config/stripe.js';
import { prisma } from '../config/database.js';
import { createResponse } from '../config/constants.js';
import { authenticateToken } from '../middleware/auth.js';
import { addTokens } from '../utils/tokenBalance.js';
import logger from '../utils/logger.js';
import { writeAudit, AUDIT_ACTIONS, RESOURCE_TYPES } from '../utils/auditLog.js';
import { validateBody } from '../middleware/validate.js';
import { CreateTokenCheckoutSchema, CreateSubscriptionCheckoutSchema } from '../schemas/payment.schemas.js';

const router = express.Router();

// GET /api/v1/payment/token-packages - 获取 Token 包列表
router.get('/token-packages', authenticateToken, async (req, res) => {
  try {
    const packages = Object.values(TOKEN_PACKAGES);
    res.json(createResponse(packages));
  } catch (error) {
    logger.error('Error fetching token packages:', error);
    res.status(500).json(createResponse(null, 'Failed to fetch token packages'));
  }
});

// GET /api/v1/payment/tool-quota-packages - 获取工具额度补充包列表
router.get('/tool-quota-packages', authenticateToken, async (req, res) => {
  try {
    const packages = Object.values(TOOL_QUOTA_PACKAGES);
    res.json(createResponse(packages));
  } catch (error) {
    logger.error('Error fetching tool quota packages:', error);
    res.status(500).json(createResponse(null, 'Failed to fetch tool quota packages'));
  }
});

// POST /api/v1/payment/create-tool-quota-checkout - 购买工具额度补充包
router.post('/create-tool-quota-checkout', authenticateToken, async (req, res) => {
  try {
    const { packageId } = req.body;
    const user = req.user;

    if (!TOOL_QUOTA_PACKAGES[packageId]) {
      return res.status(400).json(createResponse(null, 'Invalid tool quota package ID'));
    }

    const pkg = TOOL_QUOTA_PACKAGES[packageId];

    const session = await stripe.checkout.sessions.create({
      customer_email: user.email,
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: pkg.name,
            description: pkg.description,
          },
          unit_amount: Math.round(pkg.price * 100),
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${process.env.HUB_FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.HUB_FRONTEND_URL}/billing?cancelled=true`,
      metadata: {
        userId: user.id,
        packageId: pkg.id,
        tier: pkg.tier,
        callsAmount: pkg.calls.toString(),
        type: 'tool_quota_purchase',
      },
    });

    await prisma.toolQuotaPurchase.create({
      data: {
        userId: user.id,
        tier: pkg.tier,
        callsAmount: pkg.calls,
        price: pkg.price,
        stripeSessionId: session.id,
        stripePaymentId: `session_${session.id}`,
        status: 'PENDING',
      },
    });

    logger.info(`🛒 Tool quota checkout created for ${user.email}: ${pkg.name}`);
    res.json(createResponse({ sessionId: session.id, url: session.url }));
  } catch (error) {
    logger.error('Error creating tool quota checkout:', error);
    res.status(500).json(createResponse(null, 'Failed to create checkout session'));
  }
});

// POST /api/v1/payment/create-token-checkout - 创建 Token 包购买会话
router.post('/create-token-checkout', authenticateToken, validateBody(CreateTokenCheckoutSchema), async (req, res) => {
  try {
    const { packageId } = req.body;
    const user = req.user;
    
    if (!TOKEN_PACKAGES[packageId]) {
      return res.status(400).json(createResponse(null, 'Invalid package ID'));
    }
    
    const package_ = TOKEN_PACKAGES[packageId];
    
    // 创建 Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer_email: user.email,
      payment_method_types: ['card', 'alipay', 'wechat_pay'],
      payment_method_options: {
        wechat_pay: {
          client: 'web'
        }
      },
      line_items: [{
        price_data: {
          currency: 'usd',  // 使用美元
          product_data: {
            name: package_.name,
            description: `${package_.tokens.toLocaleString()} tokens - ${package_.description}`
          },
          unit_amount: Math.round(package_.price * 100)  // 转换为美分
        },
        quantity: 1
      }],
      mode: 'payment',
      success_url: `${process.env.HUB_FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.HUB_FRONTEND_URL}/billing?cancelled=true`,
      metadata: {
        userId: user.id,
        packageId: package_.id,
        tokensAmount: package_.tokens.toString(),
        type: 'token_purchase'
      }
    });
    
    // 创建待处理的购买记录（使用 session.id 作为临时的 payment ID）
    await prisma.tokenPurchase.create({
      data: {
        userId: user.id,
        stripeSessionId: session.id,
        stripePaymentId: `session_${session.id}`,  // 使用 session ID 确保唯一性
        amount: package_.price,
        tokensAmount: package_.tokens,
        status: 'PENDING',
        metadata: {
          packageId: package_.id,
          packageName: package_.name
        }
      }
    });
    
    logger.info(`🛒 Created checkout session for user ${user.email}: ${package_.name}`);

    await writeAudit(req, {
      userId: user.id,
      action: AUDIT_ACTIONS.PAYMENT_CHECKOUT_CREATED,
      resourceType: RESOURCE_TYPES.PAYMENT,
      resourceId: session.id,
      metadata: { packageId: package_.id, packageName: package_.name, amount: package_.price },
    });
    
    res.json(createResponse({ sessionId: session.id, url: session.url }));
  } catch (error) {
    logger.error('Error creating token checkout:', error);
    res.status(500).json(createResponse(null, 'Failed to create checkout session'));
  }
});

// POST /api/v1/payment/create-subscription-checkout - 创建订阅购买会话（手动支付模式）
router.post('/create-subscription-checkout', authenticateToken, validateBody(CreateSubscriptionCheckoutSchema), async (req, res) => {
  try {
    const { planId, period } = req.body; // period: 'monthly' | 'yearly'
    const user = req.user;
    
    if (!SUBSCRIPTION_PLANS[planId]) {
      return res.status(400).json(createResponse(null, 'Invalid plan ID'));
    }
    
    // 检查是否尝试降级
    const currentSub = await prisma.subscription.findUnique({
      where: { userId: user.id }
    });
    
    if (currentSub && !currentSub.isDefaultPlan) {
      const currentTier = PLAN_HIERARCHY[currentSub.planName] || 0;
      const newTier = PLAN_HIERARCHY[planId.toUpperCase()] || 0;
      
      if (newTier < currentTier) {
        return res.status(400).json(createResponse(null, 
          'Cannot downgrade to a lower plan. Please wait for current plan to expire.'));
      }
    }
    
    const plan = SUBSCRIPTION_PLANS[planId];
    const price = period === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
    const durationDays = period === 'monthly' ? 30 : 365;
    
    // 创建 Stripe Checkout Session（一次性支付模式 - 支持支付宝/微信）
    const session = await stripe.checkout.sessions.create({
      customer_email: user.email,
      payment_method_types: ['card', 'alipay', 'wechat_pay'],
      payment_method_options: {
        wechat_pay: {
          client: 'web'
        }
      },
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${plan.name} Plan - ${period === 'monthly' ? '1 Month' : '1 Year'}`,
            description: `${(plan.features.monthlyTokens || 0).toLocaleString()} monthly tokens, valid for ${durationDays} days`
          },
          unit_amount: Math.round(price * 100)
        },
        quantity: 1
      }],
      mode: 'payment', // 改为一次性支付
      success_url: `${process.env.HUB_FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.HUB_FRONTEND_URL}/billing?cancelled=true`,
      metadata: {
        userId: user.id,
        planId: plan.id,
        period: period,
        durationDays: durationDays.toString(),
        type: 'manual_subscription' // 改为手动订阅
      }
    });
    
    logger.info(`📅 Created manual subscription checkout for user ${user.email}: ${plan.name} (${period})`);

    await writeAudit(req, {
      userId: user.id,
      action: AUDIT_ACTIONS.SUBSCRIPTION_CHECKOUT_CREATED,
      resourceType: RESOURCE_TYPES.PAYMENT,
      resourceId: session.id,
      metadata: { planId: plan.id, planName: plan.name, period, amount: price },
    });
    
    res.json(createResponse({ sessionId: session.id, url: session.url }));
  } catch (error) {
    logger.error('Error creating subscription checkout:', error);
    res.status(500).json(createResponse(null, 'Failed to create subscription checkout'));
  }
});

// Stripe Webhook 处理函数（必须在 server.js 中单独挂载，在 express.json() 之前）
export async function stripeWebhookHandler(req, res) {
  const sig = req.headers['stripe-signature'];
  let event;
  
  try {
    // req.body 是 Buffer（由 express.raw() 解析），需要转换为字符串
    const payload = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : req.body;
    event = stripe.webhooks.constructEvent(payload, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.error('⚠️ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  logger.info(`📥 Received webhook: ${event.type}`);
  
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;
        
      case 'invoice.payment_succeeded':
        await handleSubscriptionPayment(event.data.object);
        break;
        
      case 'customer.subscription.deleted':
        await handleSubscriptionCancelled(event.data.object);
        break;
        
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
        
      default:
        logger.debug(`Unhandled webhook event type: ${event.type}`);
    }
    
    res.json({ received: true });
  } catch (error) {
    logger.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}

// 处理 Checkout 完成
async function handleCheckoutCompleted(session) {
  const { userId, packageId, tokensAmount, planId, period, durationDays, type } = session.metadata;
  
  if (type === 'token_purchase') {
    // Token 包购买
    const purchase = await prisma.tokenPurchase.findUnique({
      where: { stripeSessionId: session.id }
    });
    
    if (!purchase) {
      logger.error(`❌ Purchase record not found for session ${session.id}`);
      return;
    }
    
    // 防止重复处理
    if (purchase.status === 'COMPLETED') {
      logger.warn(`⚠️ Purchase ${purchase.id} already completed`);
      return;
    }
    
    // 更新购买记录
    await prisma.tokenPurchase.update({
      where: { id: purchase.id },
      data: {
        status: 'COMPLETED',
        stripePaymentId: session.payment_intent,
        amountInEur: session.amount_total / 100, // Stripe 返回的实际金额
        completedAt: new Date()
      }
    });
    
    // 增加用户 Token 余额
    await addTokens(userId, parseInt(tokensAmount), purchase.id);
    
    logger.info(`✅ Token purchase completed: ${tokensAmount} tokens for user ${userId}`);

  } else if (type === 'tool_quota_purchase') {
    // 工具额度补充包购买
    const { tier, callsAmount } = session.metadata;

    const purchase = await prisma.toolQuotaPurchase.findUnique({
      where: { stripeSessionId: session.id }
    });

    if (!purchase) {
      logger.error(`❌ ToolQuotaPurchase record not found for session ${session.id}`);
      return;
    }

    if (purchase.status === 'COMPLETED') {
      logger.warn(`⚠️ ToolQuotaPurchase ${purchase.id} already completed`);
      return;
    }

    await prisma.toolQuotaPurchase.update({
      where: { id: purchase.id },
      data: {
        status: 'COMPLETED',
        stripePaymentId: session.payment_intent,
        completedAt: new Date(),
      },
    });

    // 把额外调用次数累加到 ToolQuota.extraCalls（upsert 保证行存在）
    await prisma.toolQuota.upsert({
      where: { userId_tier: { userId, tier } },
      update: { extraCalls: { increment: parseInt(callsAmount) } },
      create: {
        userId,
        tier,
        monthlyLimit: 0,
        usedThisMonth: 0,
        extraCalls: parseInt(callsAmount),
      },
    });

    logger.info(`✅ Tool quota purchase completed: ${callsAmount} ${tier}-tier calls for user ${userId}`);

  } else if (type === 'manual_subscription') {
    // 手动订阅购买（一次性支付）
    const subscription = await prisma.subscription.findUnique({
      where: { userId: userId }
    });
    
    if (!subscription) {
      logger.error(`❌ Subscription not found for user ${userId}`);
      return;
    }
    
    // 检查是否降级（webhook 层面的二次验证）
    const currentTier = PLAN_HIERARCHY[subscription.planName] || 0;
    const newTier = PLAN_HIERARCHY[planId.toUpperCase()] || 0;
    
    // 只允许升级或同级延期
    if (newTier < currentTier) {
      logger.warn(`⚠️ Downgrade attempt blocked in webhook: ${subscription.planName} -> ${planId} for user ${userId}`);
      return;
    }
    
    // 计算订阅结束日期
    const now = new Date();
    let finalEndDate;
    
    // 如果是同级套餐且当前订阅仍有效，则在当前结束日期基础上延期
    if (newTier === currentTier && subscription.endDate && subscription.endDate > now) {
      finalEndDate = new Date(subscription.endDate.getTime() + (parseInt(durationDays) * 86400000));
      logger.info(`📅 Extending ${planId.toUpperCase()} subscription for user ${userId} by ${durationDays} days`);
    } else {
      // 升级或首次购买，从现在开始计算
      finalEndDate = new Date(now);
      finalEndDate.setDate(finalEndDate.getDate() + parseInt(durationDays));
    }
    
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        planName: planId.toUpperCase(),
        isDefaultPlan: false,
        isActive: true,
        startDate: newTier > currentTier ? now : subscription.startDate, // 升级时更新开始时间
        endDate: finalEndDate,
        nextBillingDate: null, // 手动续费没有自动账单
        stripeCustomerId: session.customer,
        stripeSubscriptionId: null // 不是自动订阅
      }
    });
    
    // 记录支付
    const plan = SUBSCRIPTION_PLANS[planId];
    const amount = period === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
    
    await prisma.subscriptionPayment.create({
      data: {
        userId: userId,
        subscriptionId: subscription.id,
        stripePaymentId: session.payment_intent,
        amount: amount,
        amountInEur: session.amount_total / 100,
        period: period,
        status: 'COMPLETED',
        paidAt: new Date()
      }
    });
    
    logger.info(`✅ Manual subscription activated: ${planId} (${period}, ${durationDays} days) for user ${userId}`);
    
  } else if (type === 'subscription') {
    // 自动订阅购买（保留旧代码以防万一）
    const subscription = await prisma.subscription.findUnique({
      where: { userId: userId }
    });
    
    if (!subscription) {
      logger.error(`❌ Subscription not found for user ${userId}`);
      return;
    }
    
    // 更新订阅信息
    const nextBillingDate = new Date();
    if (period === 'monthly') {
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
    } else {
      nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
    }
    
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        planName: planId.toUpperCase(),
        isDefaultPlan: false,
        isActive: true,
        stripeCustomerId: session.customer,
        stripeSubscriptionId: session.subscription,
        nextBillingDate: nextBillingDate
      }
    });
    
    // 记录支付
    const plan = SUBSCRIPTION_PLANS[planId];
    const amount = period === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
    
    await prisma.subscriptionPayment.create({
      data: {
        userId: userId,
        subscriptionId: subscription.id,
        stripePaymentId: session.payment_intent,
        amount: amount,
        amountInEur: session.amount_total / 100,
        period: period,
        status: 'COMPLETED',
        paidAt: new Date()
      }
    });
    
    logger.info(`✅ Subscription upgraded: ${planId} (${period}) for user ${userId}`);
  }
}

// 处理订阅支付成功（续费）
async function handleSubscriptionPayment(invoice) {
  const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
  const stripeSubscription = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subscription.id }
  });
  
  if (!stripeSubscription) {
    logger.error(`❌ Subscription not found for Stripe ID ${subscription.id}`);
    return;
  }
  
  // 记录支付
  await prisma.subscriptionPayment.create({
    data: {
      userId: stripeSubscription.userId,
      subscriptionId: stripeSubscription.id,
      stripePaymentId: invoice.payment_intent,
      stripeInvoiceId: invoice.id,
      amount: invoice.amount_paid / 100,
      amountInEur: invoice.amount_paid / 100,
      period: subscription.items.data[0].plan.interval,
      status: 'COMPLETED',
      paidAt: new Date()
    }
  });
  
  // 更新下次账单日期
  const nextBillingDate = new Date(subscription.current_period_end * 1000);
  await prisma.subscription.update({
    where: { id: stripeSubscription.id },
    data: { nextBillingDate: nextBillingDate }
  });
  
  logger.info(`✅ Subscription payment processed for user ${stripeSubscription.userId}`);
}

// 处理订阅取消
async function handleSubscriptionCancelled(subscription) {
  const dbSubscription = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subscription.id }
  });
  
  if (!dbSubscription) {
    logger.error(`❌ Subscription not found for Stripe ID ${subscription.id}`);
    return;
  }
  
  // 降级到 BASE 套餐
  await prisma.subscription.update({
    where: { id: dbSubscription.id },
    data: {
      planName: 'BASE',
      isDefaultPlan: true,
      isActive: true,
      stripeSubscriptionId: null,
      nextBillingDate: null
    }
  });
  
  logger.info(`📉 Subscription cancelled for user ${dbSubscription.userId}, downgraded to BASE`);
}

// 处理支付失败
async function handlePaymentFailed(paymentIntent) {
  // 查找相关的购买记录
  const purchase = await prisma.tokenPurchase.findFirst({
    where: { stripePaymentId: paymentIntent.id }
  });
  
  if (purchase) {
    await prisma.tokenPurchase.update({
      where: { id: purchase.id },
      data: { status: 'FAILED' }
    });
    
    logger.warn(`⚠️ Token purchase payment failed for user ${purchase.userId}`);
  }
}

// GET /api/v1/payment/history - 获取充值记录
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20, offset = 0 } = req.query;
    
    const [tokenPurchases, subscriptionPayments] = await Promise.all([
      prisma.tokenPurchase.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset)
      }),
      prisma.subscriptionPayment.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset)
      })
    ]);
    
    // 合并并排序
    const history = [
      ...tokenPurchases.map(p => ({
        id: p.id,
        type: 'token_purchase',
        amount: p.amount,
        amountInEur: p.amountInEur,
        tokensAmount: p.tokensAmount,
        status: p.status,
        createdAt: p.createdAt,
        completedAt: p.completedAt
      })),
      ...subscriptionPayments.map(p => ({
        id: p.id,
        type: 'subscription',
        amount: p.amount,
        amountInEur: p.amountInEur,
        period: p.period,
        status: p.status,
        createdAt: p.createdAt,
        paidAt: p.paidAt
      }))
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json(createResponse(history));
  } catch (error) {
    logger.error('Error fetching payment history:', error);
    res.status(500).json(createResponse(null, 'Failed to fetch payment history'));
  }
});

// POST /api/v1/payment/cancel-subscription - 取消订阅
router.post('/cancel-subscription', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const subscription = await prisma.subscription.findUnique({
      where: { userId }
    });
    
    if (!subscription || !subscription.stripeSubscriptionId) {
      return res.status(400).json(createResponse(null, 'No active subscription found'));
    }
    
    // 在 Stripe 中取消订阅
    await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
    
    logger.info(`🚫 Subscription cancelled for user ${userId}`);
    
    res.json(createResponse({ message: 'Subscription cancelled successfully' }));
  } catch (error) {
    logger.error('Error cancelling subscription:', error);
    res.status(500).json(createResponse(null, 'Failed to cancel subscription'));
  }
});

// GET /api/v1/payment/verify-session - 验证支付会话
router.get('/verify-session/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;
    
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (session.metadata.userId !== userId) {
      return res.status(403).json(createResponse(null, 'Unauthorized'));
    }
    
    res.json(createResponse({
      status: session.status,
      paymentStatus: session.payment_status,
      amountTotal: session.amount_total / 100,
      metadata: session.metadata
    }));
  } catch (error) {
    logger.error('Error verifying session:', error);
    res.status(500).json(createResponse(null, 'Failed to verify session'));
  }
});

export default router;

