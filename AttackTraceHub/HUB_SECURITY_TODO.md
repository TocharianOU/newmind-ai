# Hub Security And Compliance TODO

## Top 10

- [x] 1. Unified API input validation
  Add `zod` or `joi` schemas for `auth`, `projects`, `audit`, `payment`, `sync`, and `user` routes. Replace scattered manual `if (!field)` checks with centralized validation.

- [x] 2. Minimal RBAC
  Remove hardcoded admin-email checks and introduce at least two roles: `USER` and `ADMIN`.

- [x] 3. Audit config changes
  Add audit events for MCP config changes, tool instance create/update/delete, system prompt changes, and admin actions.

- [x] 4. Audit export permission control
  Restrict audit export by role, project scope, and edition/feature flag where applicable.

- [x] 5. Environment and secrets normalization
  Add a complete `.env.example` and document required variables such as `JWT_SECRET`, `DATABASE_URL`, `INVITE_CODES`, `ALLOWED_ORIGINS`, Stripe keys, and SSO provider settings.

- [x] 6. Refresh token migration strategy
  Decide and implement rollout behavior for the new hashed refresh-token storage: one-time invalidation, compatibility fallback, or explicit forced re-login notice.

- [x] 7. Route-level rate limiting
  Add stricter per-route rate limits for `auth`, `payment`, and `sync` endpoints instead of relying only on the global limiter.

- [x] 8. Feature flags foundation
  Introduce flags such as `BILLING_ENABLED`, `AUDIT_EXPORT_ENABLED`, `SSO_ENABLED`, and `ENTERPRISE_FEATURES_ENABLED` for future SaaS / Enterprise split.

- [x] 9. Deployment hardening
  Standardize reverse proxy requirements, HTTPS assumptions, health checks, Docker startup, logging, and backup/restore guidance.

- [x] 10. Privacy and data governance
  Document where chats are stored, what gets synced, what enters audit logs, how deletion works, and how tokens/secrets are protected.

## Suggested First 3

- [x] Unified API input validation
- [x] Minimal RBAC
- [x] Audit config changes

## Notes

- Current goal: make `AttackTraceHub` feel like a production-ready backend before adding more product surface.
- Prioritize safety, auditability, and maintainability over new features.
