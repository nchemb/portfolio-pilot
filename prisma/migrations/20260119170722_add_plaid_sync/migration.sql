/*
  Warnings:

  - A unique constraint covering the columns `[brokerageAccountId,securityId]` on the table `Holding` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "BrokerageAccount" ADD COLUMN     "needsRelink" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Holding" ADD COLUMN     "securityId" TEXT;

-- CreateTable
CREATE TABLE "Security" (
    "id" TEXT NOT NULL,
    "plaidSecurityId" TEXT NOT NULL,
    "symbol" TEXT,
    "name" TEXT,
    "type" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Security_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Security_plaidSecurityId_key" ON "Security"("plaidSecurityId");

-- CreateIndex
CREATE UNIQUE INDEX "Holding_brokerageAccountId_securityId_key" ON "Holding"("brokerageAccountId", "securityId");

-- AddForeignKey
ALTER TABLE "Holding" ADD CONSTRAINT "Holding_securityId_fkey" FOREIGN KEY ("securityId") REFERENCES "Security"("id") ON DELETE SET NULL ON UPDATE CASCADE;
