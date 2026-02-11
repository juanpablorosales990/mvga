-- Price alert enums
CREATE TYPE "PriceAlertType" AS ENUM ('TOKEN_PRICE', 'VES_RATE');
CREATE TYPE "VesRateType" AS ENUM ('BCV_OFFICIAL', 'PARALLEL_MARKET');
CREATE TYPE "AlertCondition" AS ENUM ('ABOVE', 'BELOW');
CREATE TYPE "AlertStatus" AS ENUM ('ACTIVE', 'TRIGGERED', 'DISABLED');

-- Price alert table
CREATE TABLE IF NOT EXISTS "PriceAlert" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "walletAddress" TEXT NOT NULL,
  "alertType" "PriceAlertType" NOT NULL DEFAULT 'TOKEN_PRICE',
  "token" TEXT,
  "vesRateType" "VesRateType",
  "condition" "AlertCondition" NOT NULL,
  "targetPrice" DOUBLE PRECISION NOT NULL,
  "status" "AlertStatus" NOT NULL DEFAULT 'ACTIVE',
  "cooldownUntil" TIMESTAMPTZ,
  "lastTriggered" TIMESTAMPTZ,
  "triggerCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "PriceAlert_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PriceAlert_walletAddress_status_idx" ON "PriceAlert"("walletAddress", "status");
CREATE INDEX IF NOT EXISTS "PriceAlert_status_cooldownUntil_idx" ON "PriceAlert"("status", "cooldownUntil");

-- Add priceAlerts preference to NotificationPreference
ALTER TABLE "NotificationPreference" ADD COLUMN IF NOT EXISTS "priceAlerts" BOOLEAN NOT NULL DEFAULT true;
