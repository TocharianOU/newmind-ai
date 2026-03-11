-- CreateEnum
CREATE TYPE "LicenseStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'INVALID', 'NOT_ACTIVATED');

-- CreateTable
CREATE TABLE "License" (
    "id"           TEXT        NOT NULL,
    "customerId"   TEXT        NOT NULL,
    "customerName" TEXT        NOT NULL,
    "maxSeats"     INTEGER     NOT NULL DEFAULT 50,
    "maxTokens"    BIGINT      NOT NULL DEFAULT -1,
    "features"     TEXT[]      NOT NULL DEFAULT ARRAY[]::TEXT[],
    "issuedAt"     TIMESTAMP(3) NOT NULL,
    "expiresAt"    TIMESTAMP(3) NOT NULL,
    "signature"    TEXT        NOT NULL,
    "active"       BOOLEAN     NOT NULL DEFAULT true,
    "activatedBy"  TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "License_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "License_customerId_key" ON "License"("customerId");

-- CreateIndex
CREATE INDEX "License_active_idx" ON "License"("active");

-- CreateIndex
CREATE INDEX "License_expiresAt_idx" ON "License"("expiresAt");
