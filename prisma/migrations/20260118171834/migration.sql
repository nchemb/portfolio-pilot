/*
  Warnings:

  - A unique constraint covering the columns `[plaidAccountId]` on the table `BrokerageAccount` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "BrokerageAccount" ADD COLUMN     "plaidAccessToken" TEXT,
ADD COLUMN     "plaidAccountId" TEXT,
ADD COLUMN     "plaidInstitutionId" TEXT,
ADD COLUMN     "plaidItemId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "BrokerageAccount_plaidAccountId_key" ON "BrokerageAccount"("plaidAccountId");
