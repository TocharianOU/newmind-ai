-- Add UserRole enum and role column to User
-- Default all existing users to 'USER'; promote via ADMIN_EMAILS env or direct DB update.

DO $$ BEGIN
  CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "role" "UserRole" NOT NULL DEFAULT 'USER';

CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");
