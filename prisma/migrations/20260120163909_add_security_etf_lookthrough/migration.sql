/*
  Warnings:

  - You are about to drop the column `needsRelink` on the `BrokerageAccount` table. All the data in the column will be lost.
  - You are about to drop the column `plaidAccessToken` on the `BrokerageAccount` table. All the data in the column will be lost.
  - You are about to drop the column `plaidInstitutionId` on the `BrokerageAccount` table. All the data in the column will be lost.
  - You are about to drop the column `plaidSecurityId` on the `Security` table. All the data in the column will be lost.
  - You are about to drop the column `symbol` on the `Security` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Security` table. All the data in the column will be lost.
  - Made the column `name` on table `Security` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "Holding_brokerageAccountId_securityId_key";

-- DropIndex
DROP INDEX "Security_plaidSecurityId_key";

-- AlterTable
ALTER TABLE "BrokerageAccount" DROP COLUMN "needsRelink",
DROP COLUMN "plaidAccessToken",
DROP COLUMN "plaidInstitutionId";

-- AlterTable
ALTER TABLE "Security" DROP COLUMN "plaidSecurityId",
DROP COLUMN "symbol",
DROP COLUMN "type",
ADD COLUMN     "assetClass" TEXT,
ADD COLUMN     "currency" TEXT,
ADD COLUMN     "cusip" TEXT,
ADD COLUMN     "dataProvider" TEXT,
ADD COLUMN     "geography" TEXT,
ADD COLUMN     "isin" TEXT,
ADD COLUMN     "primaryExchange" TEXT,
ADD COLUMN     "sector" TEXT,
ADD COLUMN     "securityType" TEXT,
ADD COLUMN     "style" TEXT,
ADD COLUMN     "ticker" TEXT,
ALTER COLUMN "name" SET NOT NULL;

-- CreateTable
CREATE TABLE "PlaidItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plaidItemId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "institutionId" TEXT,
    "institutionName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlaidItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EtfConstituent" (
    "id" TEXT NOT NULL,
    "etfSecurityId" TEXT NOT NULL,
    "constituentSecurityId" TEXT NOT NULL,
    "weight" DECIMAL(10,6) NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL,
    "source" TEXT,
    "sourceSymbol" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EtfConstituent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityPriceDaily" (
    "id" TEXT NOT NULL,
    "securityId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "open" DECIMAL(24,8),
    "high" DECIMAL(24,8),
    "low" DECIMAL(24,8),
    "close" DECIMAL(24,8),
    "adjClose" DECIMAL(24,8),
    "volume" BIGINT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityPriceDaily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlaidItem_plaidItemId_key" ON "PlaidItem"("plaidItemId");

-- CreateIndex
CREATE INDEX "PlaidItem_userId_idx" ON "PlaidItem"("userId");

-- CreateIndex
CREATE INDEX "EtfConstituent_etfSecurityId_idx" ON "EtfConstituent"("etfSecurityId");

-- CreateIndex
CREATE INDEX "EtfConstituent_constituentSecurityId_idx" ON "EtfConstituent"("constituentSecurityId");

-- CreateIndex
CREATE UNIQUE INDEX "EtfConstituent_etfSecurityId_constituentSecurityId_asOf_key" ON "EtfConstituent"("etfSecurityId", "constituentSecurityId", "asOf");

-- CreateIndex
CREATE INDEX "SecurityPriceDaily_date_idx" ON "SecurityPriceDaily"("date");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityPriceDaily_securityId_date_key" ON "SecurityPriceDaily"("securityId", "date");

-- CreateIndex
CREATE INDEX "Holding_brokerageAccountId_idx" ON "Holding"("brokerageAccountId");

-- CreateIndex
CREATE INDEX "Holding_securityId_idx" ON "Holding"("securityId");

-- CreateIndex
CREATE INDEX "Security_ticker_idx" ON "Security"("ticker");

-- CreateIndex
CREATE INDEX "Security_isin_idx" ON "Security"("isin");

-- CreateIndex
CREATE INDEX "Security_cusip_idx" ON "Security"("cusip");

-- AddForeignKey
ALTER TABLE "BrokerageAccount" ADD CONSTRAINT "BrokerageAccount_plaidItemId_fkey" FOREIGN KEY ("plaidItemId") REFERENCES "PlaidItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaidItem" ADD CONSTRAINT "PlaidItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EtfConstituent" ADD CONSTRAINT "EtfConstituent_etfSecurityId_fkey" FOREIGN KEY ("etfSecurityId") REFERENCES "Security"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EtfConstituent" ADD CONSTRAINT "EtfConstituent_constituentSecurityId_fkey" FOREIGN KEY ("constituentSecurityId") REFERENCES "Security"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityPriceDaily" ADD CONSTRAINT "SecurityPriceDaily_securityId_fkey" FOREIGN KEY ("securityId") REFERENCES "Security"("id") ON DELETE CASCADE ON UPDATE CASCADE;
