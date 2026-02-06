-- =============================================================================
-- MVGA Super DeFi Growth Plan - Schema Additions
-- Token Burns, Fee Sharing, Metrics, Auto-Compound
-- =============================================================================

-- Burn Source enum
CREATE TYPE "BurnSource" AS ENUM ('WEEKLY', 'MANUAL');

-- Token Burn table
CREATE TABLE "TokenBurn" (
    "id" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "signature" TEXT NOT NULL,
    "source" "BurnSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenBurn_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TokenBurn_signature_key" ON "TokenBurn"("signature");
CREATE INDEX "TokenBurn_createdAt_idx" ON "TokenBurn"("createdAt");

-- Add BURN and FEE_REWARD to TransactionType
ALTER TYPE "TransactionType" ADD VALUE 'BURN';
ALTER TYPE "TransactionType" ADD VALUE 'FEE_REWARD';

-- Add burn columns to TreasuryDistribution
ALTER TABLE "TreasuryDistribution" ADD COLUMN "burnAmount" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "TreasuryDistribution" ADD COLUMN "burnTx" TEXT;

-- Fee Snapshot table (for staker fee sharing)
CREATE TABLE "FeeSnapshot" (
    "id" TEXT NOT NULL,
    "totalFees" BIGINT NOT NULL,
    "totalWeight" BIGINT NOT NULL,
    "feePerWeight" DOUBLE PRECISION NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeeSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FeeSnapshot_periodEnd_idx" ON "FeeSnapshot"("periodEnd");

-- Metrics Snapshot table
CREATE TABLE "MetricsSnapshot" (
    "id" TEXT NOT NULL,
    "tvl" BIGINT NOT NULL,
    "volume24h" BIGINT NOT NULL,
    "revenue24h" BIGINT NOT NULL,
    "totalUsers" INTEGER NOT NULL,
    "activeUsers" INTEGER NOT NULL,
    "totalStakers" INTEGER NOT NULL,
    "totalBurned" BIGINT NOT NULL DEFAULT 0,
    "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetricsSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MetricsSnapshot_snapshotAt_idx" ON "MetricsSnapshot"("snapshotAt");

-- Add autoCompound to Stake table
ALTER TABLE "Stake" ADD COLUMN "autoCompound" BOOLEAN NOT NULL DEFAULT false;

-- Grant permissions to app user
GRANT ALL PRIVILEGES ON TABLE "TokenBurn" TO mvga_app;
GRANT ALL PRIVILEGES ON TABLE "FeeSnapshot" TO mvga_app;
GRANT ALL PRIVILEGES ON TABLE "MetricsSnapshot" TO mvga_app;
