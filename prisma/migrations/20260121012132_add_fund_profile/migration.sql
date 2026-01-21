-- CreateTable
CREATE TABLE "FundProfile" (
    "id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "name" TEXT,
    "assetClass" TEXT NOT NULL,
    "geography" TEXT,
    "style" TEXT,
    "marketCapBias" TEXT,
    "source" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FundProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FundProfile_ticker_key" ON "FundProfile"("ticker");

-- CreateIndex
CREATE INDEX "FundProfile_assetClass_idx" ON "FundProfile"("assetClass");

-- CreateIndex
CREATE INDEX "FundProfile_geography_idx" ON "FundProfile"("geography");
