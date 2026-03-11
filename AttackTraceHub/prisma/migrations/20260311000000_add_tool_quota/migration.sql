-- CreateEnum
CREATE TYPE "ToolTier" AS ENUM ('A', 'B', 'C');

-- CreateEnum
CREATE TYPE "KeyMode" AS ENUM ('hub', 'byok');

-- CreateTable
CREATE TABLE "ToolUsageRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "tier" "ToolTier" NOT NULL,
    "keyMode" "KeyMode" NOT NULL DEFAULT 'hub',
    "endpoint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToolUsageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToolQuota" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tier" "ToolTier" NOT NULL,
    "monthlyLimit" INTEGER NOT NULL DEFAULT 0,
    "usedThisMonth" INTEGER NOT NULL DEFAULT 0,
    "periodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ToolQuota_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ToolUsageRecord_userId_createdAt_idx" ON "ToolUsageRecord"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ToolUsageRecord_tier_createdAt_idx" ON "ToolUsageRecord"("tier", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ToolQuota_userId_tier_key" ON "ToolQuota"("userId", "tier");

-- CreateIndex
CREATE INDEX "ToolQuota_userId_idx" ON "ToolQuota"("userId");

-- AddForeignKey
ALTER TABLE "ToolUsageRecord" ADD CONSTRAINT "ToolUsageRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolQuota" ADD CONSTRAINT "ToolQuota_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
