-- Add computedAt column to DailySnapshot
ALTER TABLE "DailySnapshot" ADD COLUMN "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
