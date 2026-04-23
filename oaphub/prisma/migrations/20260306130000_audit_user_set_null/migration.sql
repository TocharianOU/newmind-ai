-- Change AuditLog.userId to nullable and switch onDelete from CASCADE to SET NULL.
-- This preserves audit records when a user deletes their account.

-- Drop the existing foreign key constraint
ALTER TABLE "AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_userId_fkey";

-- Make userId nullable
ALTER TABLE "AuditLog" ALTER COLUMN "userId" DROP NOT NULL;

-- Re-create the FK with SET NULL
ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
