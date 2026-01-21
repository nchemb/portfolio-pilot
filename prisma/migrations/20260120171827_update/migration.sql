-- DropForeignKey
ALTER TABLE "BrokerageAccount" DROP CONSTRAINT "BrokerageAccount_plaidItemId_fkey";

-- AddForeignKey
ALTER TABLE "BrokerageAccount" ADD CONSTRAINT "BrokerageAccount_plaidItemId_fkey" FOREIGN KEY ("plaidItemId") REFERENCES "PlaidItem"("plaidItemId") ON DELETE SET NULL ON UPDATE CASCADE;
