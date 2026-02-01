-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'CANCELLED');

-- AlterTable
ALTER TABLE "McpServer" ADD COLUMN     "descriptionI18n" JSONB,
ADD COLUMN     "documentI18n" JSONB,
ADD COLUMN     "downloadUrl" VARCHAR(1000),
ADD COLUMN     "version" VARCHAR(50);

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "stripePriceId" TEXT,
ADD COLUMN     "stripeSubscriptionId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "tokenBalance" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "password" DROP NOT NULL;

-- CreateTable
CREATE TABLE "AuthIdentity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "email" TEXT,
    "displayName" TEXT,
    "profilePicture" VARCHAR(500),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenPurchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripePaymentId" TEXT NOT NULL,
    "stripeSessionId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "amountInEur" DOUBLE PRECISION,
    "tokensAmount" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "TokenPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPayment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "stripePaymentId" TEXT NOT NULL,
    "stripeInvoiceId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "amountInEur" DOUBLE PRECISION,
    "period" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuthIdentity_userId_idx" ON "AuthIdentity"("userId");

-- CreateIndex
CREATE INDEX "AuthIdentity_provider_idx" ON "AuthIdentity"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "AuthIdentity_provider_providerUserId_key" ON "AuthIdentity"("provider", "providerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "TokenPurchase_stripePaymentId_key" ON "TokenPurchase"("stripePaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "TokenPurchase_stripeSessionId_key" ON "TokenPurchase"("stripeSessionId");

-- CreateIndex
CREATE INDEX "TokenPurchase_userId_createdAt_idx" ON "TokenPurchase"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "TokenPurchase_status_idx" ON "TokenPurchase"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPayment_stripePaymentId_key" ON "SubscriptionPayment"("stripePaymentId");

-- CreateIndex
CREATE INDEX "SubscriptionPayment_userId_createdAt_idx" ON "SubscriptionPayment"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "AuthIdentity" ADD CONSTRAINT "AuthIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenPurchase" ADD CONSTRAINT "TokenPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
