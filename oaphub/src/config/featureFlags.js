/**
 * Feature flag registry.
 *
 * Each flag is read once at startup from the environment.
 * Default values are chosen so that the SaaS (C-end) deployment works
 * out of the box without setting any flags.
 *
 * Enterprise (on-prem) deployments set DEPLOYMENT_MODE=enterprise, which
 * automatically flips the defaults; individual flags can still be overridden.
 *
 * Usage:
 *   import featureFlags from '../config/featureFlags.js'
 *   if (featureFlags.BILLING_ENABLED) { ... }
 */

// Load .env early — this module is statically imported and evaluated before
// the calling module's body runs, so we must load dotenv here as a guard.
import dotenv from 'dotenv';
dotenv.config();

function bool(envVar, defaultValue) {
  const raw = process.env[envVar]
  if (raw === undefined || raw === '') return defaultValue
  return raw === 'true'
}

/** Deployment mode — 'saas' (default) or 'enterprise' */
const DEPLOYMENT_MODE = process.env.DEPLOYMENT_MODE || 'saas'
const isEnterprise = DEPLOYMENT_MODE === 'enterprise'

const featureFlags = {
  /** 'saas' | 'enterprise' — drives default values for all other flags. */
  DEPLOYMENT_MODE,

  /** Enable Stripe billing / payment flows. Defaults to false in enterprise mode. */
  BILLING_ENABLED: bool('BILLING_ENABLED', !isEnterprise),

  /** Allow users to export audit logs as JSON or CSV. */
  AUDIT_EXPORT_ENABLED: bool('AUDIT_EXPORT_ENABLED', true),

  /** Enable SSO (OAuth2 / OIDC) login providers. */
  SSO_ENABLED: bool('SSO_ENABLED', true),

  /** Gate enterprise-only features (RBAC admin panel, org management, etc.). */
  ENTERPRISE_FEATURES_ENABLED: bool('ENTERPRISE_FEATURES_ENABLED', isEnterprise),

  /** Require an invite code at registration. Defaults to true in enterprise mode. */
  INVITE_CODE_ENABLED: bool('INVITE_CODE_ENABLED', isEnterprise),

  /** Enable license-based access control (enterprise on-prem only). */
  LICENSE_ENABLED: bool('LICENSE_ENABLED', isEnterprise),
}

export default featureFlags
