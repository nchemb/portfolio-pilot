-- CreateTable
CREATE TABLE "UserSecurityOverride" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tickerNormalized" TEXT NOT NULL,
    "assetClass" TEXT NOT NULL,
    "geography" TEXT,
    "style" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSecurityOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserSecurityOverride_userId_idx" ON "UserSecurityOverride"("userId");

-- CreateIndex
CREATE INDEX "UserSecurityOverride_tickerNormalized_idx" ON "UserSecurityOverride"("tickerNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "UserSecurityOverride_userId_tickerNormalized_key" ON "UserSecurityOverride"("userId", "tickerNormalized");

-- AddForeignKey
ALTER TABLE "UserSecurityOverride" ADD CONSTRAINT "UserSecurityOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
