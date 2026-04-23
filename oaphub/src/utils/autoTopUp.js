/**
 * Auto Top-Up: automatically charge the user's saved payment method
 * when their USD balance drops below the configured threshold.
 *
 * Called via setImmediate from usdBalance.deductUsd after each deduction.
 * All operations are fire-and-forget — failures are logged but never surface
 * to the calling request.
 *
 * Circular import note: this file imports from autoTopUp → stripe, prisma, email.
 * usdBalance.js calls this via dynamic import to break the potential cycle.
 */
import { Prisma } from '@prisma/client';
import { stripe } from '../config/stripe.js';
import { prisma } from '../config/database.js';
import { sendLowBalanceEmail } from './email.js';
import { writeAudit, AUDIT_ACTIONS, RESOURCE_TYPES } from './auditLog.js';
import logger from './logger.js';

const LOW_BALANCE_EMAIL_USD = 2.00;
const LOW_BALANCE_EMAIL_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 h

// Prevent concurrent auto top-ups for the same user
const _inFlight = new Set();

/**
 * Entry point — called after every USD deduction.
 * Decides whether to trigger a charge or send a low-balance email.
 *
 * @param {string}                  userId
 * @param {Prisma.Decimal | number} newBalance — balance AFTER the deduction
 */
export async function maybeAutoTopUp(userId, newBalance) {
  const balance = Number(newBalance);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      autoTopUpEnabled: true,
      autoTopUpThreshold: true,
      autoTopUpAmount: true,
      stripeCustomerId: true,
      stripeDefaultPaymentMethod: true,
      lastLowBalanceEmailAt: true,
    },
  });

  if (!user) return;

  const threshold = Number(user.autoTopUpThreshold ?? 5);
  const amount = Number(user.autoTopUpAmount ?? 20);

  if (user.autoTopUpEnabled && balance <= threshold) {
    if (!user.stripeCustomerId || !user.stripeDefaultPaymentMethod) {
      logger.warn(`[AutoTopUp] User ${userId} has auto top-up enabled but no saved payment method`);
      await _maybeSendEmail(userId, user.email, user.lastLowBalanceEmailAt, balance, false);
      return;
    }

    if (_inFlight.has(userId)) {
      logger.debug(`[AutoTopUp] Charge already in progress for user ${userId}, skipping`);
      return;
    }

    _inFlight.add(userId);
    try {
      await _charge(userId, user, amount);
    } finally {
      _inFlight.delete(userId);
    }
    return;
  }

  // Auto top-up disabled (or above threshold) — still send email if very low
  if (balance <= LOW_BALANCE_EMAIL_USD) {
    await _maybeSendEmail(userId, user.email, user.lastLowBalanceEmailAt, balance, false);
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function _charge(userId, user, amountUsd) {
  logger.info(`[AutoTopUp] Charging $${amountUsd} for user ${userId}`);
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amountUsd * 100),
      currency: 'usd',
      customer: user.stripeCustomerId,
      payment_method: user.stripeDefaultPaymentMethod,
      confirm: true,
      off_session: true,
      metadata: { userId, type: 'auto_topup', amountUsd: String(amountUsd) },
    });

    if (paymentIntent.status === 'succeeded') {
      // Credit the user's balance directly (no addUsd import to avoid circular dep)
      const amount = new Prisma.Decimal(amountUsd);
      await prisma.$transaction(async (tx) => {
        const u = await tx.user.findUniqueOrThrow({
          where: { id: userId },
          select: { usdBalance: true },
        });
        const balanceBefore = u.usdBalance;
        const balanceAfter = balanceBefore.add(amount);

        await tx.user.update({ where: { id: userId }, data: { usdBalance: balanceAfter } });

        await tx.balanceTransaction.create({
          data: {
            userId,
            type: 'auto_topup',
            amountUsd: amount,
            balanceBefore,
            balanceAfter,
            referenceType: 'payment',
            referenceId: paymentIntent.id,
            metadata: { autoTriggered: true },
          },
        });
      });

      writeAudit(null, {
        userId,
        action: AUDIT_ACTIONS.USD_TOPUP,
        resourceType: RESOURCE_TYPES.BALANCE,
        metadata: { amountUsd, type: 'auto_topup', paymentIntentId: paymentIntent.id },
      });

      logger.info(`[AutoTopUp] Success: +$${amountUsd} added for user ${userId}`);
    } else {
      logger.warn(`[AutoTopUp] PaymentIntent status=${paymentIntent.status} for user ${userId}`);
      await _maybeSendEmail(userId, user.email, user.lastLowBalanceEmailAt, null, true);
    }
  } catch (err) {
    logger.error(`[AutoTopUp] Charge failed for user ${userId}: ${err.message}`);
    await _maybeSendEmail(userId, user.email, user.lastLowBalanceEmailAt, null, true);
  }
}

async function _maybeSendEmail(userId, email, lastSentAt, balance, topUpFailed) {
  try {
    if (lastSentAt && Date.now() - new Date(lastSentAt).getTime() < LOW_BALANCE_EMAIL_COOLDOWN_MS) {
      return; // Already notified recently
    }
    await sendLowBalanceEmail(email, balance, topUpFailed);
    await prisma.user.update({
      where: { id: userId },
      data: { lastLowBalanceEmailAt: new Date() },
    });
  } catch (err) {
    logger.warn(`[AutoTopUp] Failed to send email to ${email}: ${err.message}`);
  }
}
