-- Make projectId optional on AuditLog so that auth-level events
-- (login, logout, register, token refresh) can be recorded without
-- a project context. Project-scoped events still populate projectId.
ALTER TABLE "AuditLog" ALTER COLUMN "projectId" DROP NOT NULL;
