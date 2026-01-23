-- CreateTable
CREATE TABLE "CashAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "institution" TEXT,
    "name" TEXT,
    "mask" TEXT,
    "type" TEXT,
    "currency" TEXT,
    "balance" DECIMAL(24,8) NOT NULL DEFAULT 0,
    "lastSyncedAt" TIMESTAMP(3),
    "plaidAccountId" TEXT,
    "plaidItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CashAccount_plaidAccountId_key" ON "CashAccount"("plaidAccountId");

-- CreateIndex
CREATE INDEX "CashAccount_userId_idx" ON "CashAccount"("userId");

-- AddForeignKey
ALTER TABLE "CashAccount" ADD CONSTRAINT "CashAccount_plaidItemId_fkey" FOREIGN KEY ("plaidItemId") REFERENCES "PlaidItem"("plaidItemId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashAccount" ADD CONSTRAINT "CashAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
