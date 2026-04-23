-- AlterTable: add logo and configSchema columns to McpServer
ALTER TABLE "McpServer" ADD COLUMN IF NOT EXISTS "logo" VARCHAR(500);
ALTER TABLE "McpServer" ADD COLUMN IF NOT EXISTS "configSchema" JSONB;
