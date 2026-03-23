-- Add usdBalance column to User (used for credit-based billing)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "usdBalance" DECIMAL(12,4) NOT NULL DEFAULT 0;
