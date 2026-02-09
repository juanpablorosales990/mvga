-- Payout table for Airtm Off-Ramp
-- Created: 2026-02-08

DO $$ BEGIN
  CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'COMMITTED', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "Payout" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "walletAddress" TEXT NOT NULL,
  "recipientEmail" TEXT NOT NULL,
  "amountUsd" DOUBLE PRECISION NOT NULL,
  "description" TEXT,
  "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
  "airtmPayoutId" TEXT,
  "airtmCode" TEXT,
  "errorMessage" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Payout_airtmPayoutId_key"
  ON "Payout"("airtmPayoutId");
CREATE INDEX IF NOT EXISTS "Payout_walletAddress_idx"
  ON "Payout"("walletAddress");
CREATE INDEX IF NOT EXISTS "Payout_status_idx"
  ON "Payout"("status");
