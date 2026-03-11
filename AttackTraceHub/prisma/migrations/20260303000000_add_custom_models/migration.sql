-- CreateTable
CREATE TABLE "CustomModel" (
    "id"        TEXT         NOT NULL,
    "name"      TEXT         NOT NULL,
    "modelId"   TEXT         NOT NULL,
    "provider"  TEXT         NOT NULL DEFAULT 'openai_compatible',
    "baseURL"   TEXT         NOT NULL,
    "apiKey"    TEXT         NOT NULL DEFAULT '',
    "active"    BOOLEAN      NOT NULL DEFAULT true,
    "notes"     TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomModel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomModel_modelId_key" ON "CustomModel"("modelId");

-- CreateIndex
CREATE INDEX "CustomModel_active_idx" ON "CustomModel"("active");
