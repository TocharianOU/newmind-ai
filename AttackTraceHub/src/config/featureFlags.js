/**
 * Feature flag registry.
 *
 * Each flag is read once at startup from the environment.
 * Default values are chosen so that the SaaS (C-end) deployment works
 * out of the box without setting any flags.
 *
 * Enterprise (on-prem) deployments can override flags via environment variables.
 *
 * Usage:
 *   import featureFlags from '../config/featureFlags.js'
 *   if (featureFlags.BILLING_ENABLED) { ... }
 */

function bool(envVar, defaultValue) {
  const raw = process.env[envVar]
  if (raw === undefined || raw === '') return defaultValue
  return raw === 'true'
}

const featureFlags = {
  /** Enable Stripe billing / payment flows. Set to false for enterprise on-prem. */
  BILLING_ENABLED: bool('BILLING_ENABLED', true),

  /** Allow users to export audit logs as JSON or CSV. */
  AUDIT_EXPORT_ENABLED: bool('AUDIT_EXPORT_ENABLED', true),

  /** Enable SSO (OAuth2 / OIDC) login providers. */
  SSO_ENABLED: bool('SSO_ENABLED', true),

  /** Gate enterprise-only features (RBAC admin panel, org management, etc.). */
  ENTERPRISE_FEATURES_ENABLED: bool('ENTERPRISE_FEATURES_ENABLED', false),

  /** Require an invite code at registration. */
  INVITE_CODE_ENABLED: bool('INVITE_CODE_ENABLED', false),
}

export default featureFlags
