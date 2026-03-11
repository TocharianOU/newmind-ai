-- Add extraCalls column to ToolQuota
ALTER TABLE "ToolQuota" ADD COLUMN "extraCalls" INTEGER NOT NULL DEFAULT 0;

-- CreateTable ToolQuotaPurchase
CREATE TABLE "ToolQuotaPurchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tier" "ToolTier" NOT NULL,
    "callsAmount" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "stripeSessionId" TEXT,
    "stripePaymentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToolQuotaPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ToolQuotaPurchase_stripeSessionId_key" ON "ToolQuotaPurchase"("stripeSessionId");

-- CreateIndex
CREATE INDEX "ToolQuotaPurchase_userId_tier_idx" ON "ToolQuotaPurchase"("userId", "tier");

-- CreateIndex
CREATE INDEX "ToolQuotaPurchase_stripeSessionId_idx" ON "ToolQuotaPurchase"("stripeSessionId");

-- AddForeignKey
ALTER TABLE "ToolQuotaPurchase" ADD CONSTRAINT "ToolQuotaPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
