/**
 * Email utility for transactional emails (password reset, etc.)
 *
 * Uses nodemailer with SMTP when SMTP_HOST is configured.
 * Falls back to logging the link to stdout when no SMTP is set —
 * useful for development and enterprise deployments without email.
 *
 * Required env vars (all optional — log-only mode when absent):
 *   SMTP_HOST        e.g. smtp.sendgrid.net
 *   SMTP_PORT        default 587
 *   SMTP_SECURE      "true" for port 465, otherwise false
 *   SMTP_USER        SMTP username / API key
 *   SMTP_PASS        SMTP password
 *   EMAIL_FROM       Sender address, e.g. noreply@example.com
 */

import nodemailer from 'nodemailer';
import logger from './logger.js';

function createTransport() {
  if (!process.env.SMTP_HOST) return null;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

const transport = createTransport();
const FROM = process.env.EMAIL_FROM || 'noreply@oap-platform.local';
const FRONTEND_URL = process.env.HUB_FRONTEND_URL || 'http://localhost:23001';

/**
 * Send a password-reset email.
 * @param {string} to   - Recipient email address
 * @param {string} token - Plain-text reset token (will be embedded in URL)
 */
export async function sendPasswordResetEmail(to, token) {
  const resetUrl = `${FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}`;

  if (!transport) {
    // No SMTP configured — log the link so it can still be tested locally
    logger.warn(`[Email] SMTP not configured. Password reset link for ${to}:`);
    logger.warn(`[Email] ${resetUrl}`);
    return;
  }

  await transport.sendMail({
    from: FROM,
    to,
    subject: 'Reset your password',
    text: `You requested a password reset.\n\nClick the link below to set a new password (valid for 1 hour):\n\n${resetUrl}\n\nIf you did not request this, ignore this email.`,
    html: `
      <p>You requested a password reset.</p>
      <p>Click the button below to set a new password. The link is valid for <strong>1 hour</strong>.</p>
      <p style="margin:24px 0">
        <a href="${resetUrl}" style="background:#6366f1;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
          Reset Password
        </a>
      </p>
      <p style="color:#888;font-size:13px">If you did not request this, you can safely ignore this email.</p>
      <hr/>
      <p style="color:#aaa;font-size:12px">Or copy this link: ${resetUrl}</p>
    `,
  });

  logger.info(`[Email] Password reset email sent to ${to}`);
}
