/*
  Warnings:

  - You are about to drop the `UserMcpConfig` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[name]` on the table `McpServer` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "UserMcpConfig" DROP CONSTRAINT "UserMcpConfig_mcpServerId_fkey";

-- DropForeignKey
ALTER TABLE "UserMcpConfig" DROP CONSTRAINT "UserMcpConfig_projectId_fkey";

-- DropForeignKey
ALTER TABLE "UserMcpConfig" DROP CONSTRAINT "UserMcpConfig_userId_fkey";

-- DropTable
DROP TABLE "UserMcpConfig";

-- CreateIndex
CREATE UNIQUE INDEX "McpServer_name_key" ON "McpServer"("name");
