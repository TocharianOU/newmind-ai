-- CreateTable: PasswordReset
-- Stores hashed one-time tokens for the forgot-password flow.
-- Tokens expire after 1 hour and are single-use (used = true after consumption).

CREATE TABLE "PasswordReset" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "token"     VARCHAR(500) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used"      BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordReset_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "PasswordReset_token_key" ON "PasswordReset"("token");
CREATE INDEX "PasswordReset_userId_idx"    ON "PasswordReset"("userId");
CREATE INDEX "PasswordReset_expiresAt_idx" ON "PasswordReset"("expiresAt");

-- Foreign key: cascade-delete reset tokens when user is deleted
ALTER TABLE "PasswordReset"
    ADD CONSTRAINT "PasswordReset_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
