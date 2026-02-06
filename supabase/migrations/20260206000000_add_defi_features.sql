-- =============================================================================
-- MVGA Super DeFi Growth Plan - All Missing Schema
-- Includes: Referrals, Treasury, Burns, Fee Sharing, Metrics, Auto-Compound
-- =============================================================================

-- =====================
-- New Enums
-- =====================

CREATE TYPE "DistributionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED');
CREATE TYPE "FeeSource" AS ENUM ('SWAP', 'MOBILE_TOPUP', 'GIFT_CARD', 'YIELD', 'P2P');
CREATE TYPE "BurnSource" AS ENUM ('WEEKLY', 'MANUAL');

-- Add new values to existing TransactionType enum
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'REFERRAL_BONUS';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'BURN';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'FEE_REWARD';

-- =====================
-- Referral Tables
-- =====================

CREATE TABLE "ReferralCode" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReferralCode_walletAddress_key" ON "ReferralCode"("walletAddress");
CREATE UNIQUE INDEX "ReferralCode_code_key" ON "ReferralCode"("code");
CREATE INDEX "ReferralCode_walletAddress_idx" ON "ReferralCode"("walletAddress");
CREATE INDEX "ReferralCode_code_idx" ON "ReferralCode"("code");

CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "referrerAddress" TEXT NOT NULL,
    "refereeAddress" TEXT NOT NULL,
    "codeId" TEXT NOT NULL,
    "bonusPaid" BOOLEAN NOT NULL DEFAULT false,
    "bonusTxReferrer" TEXT,
    "bonusTxReferee" TEXT,
    "amount" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Referral_refereeAddress_key" ON "Referral"("refereeAddress");
CREATE INDEX "Referral_referrerAddress_idx" ON "Referral"("referrerAddress");
CREATE INDEX "Referral_refereeAddress_idx" ON "Referral"("refereeAddress");

ALTER TABLE "Referral" ADD CONSTRAINT "Referral_codeId_fkey" FOREIGN KEY ("codeId") REFERENCES "ReferralCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =====================
-- Treasury Distribution
-- =====================

CREATE TABLE "TreasuryDistribution" (
    "id" TEXT NOT NULL,
    "totalAmount" BIGINT NOT NULL,
    "burnAmount" BIGINT NOT NULL DEFAULT 0,
    "liquidityAmount" BIGINT NOT NULL,
    "stakingAmount" BIGINT NOT NULL,
    "grantsAmount" BIGINT NOT NULL,
    "burnTx" TEXT,
    "liquidityTx" TEXT,
    "stakingTx" TEXT,
    "grantsTx" TEXT,
    "swapFees" BIGINT NOT NULL DEFAULT 0,
    "topupFees" BIGINT NOT NULL DEFAULT 0,
    "giftcardFees" BIGINT NOT NULL DEFAULT 0,
    "yieldEarnings" BIGINT NOT NULL DEFAULT 0,
    "status" "DistributionStatus" NOT NULL DEFAULT 'PENDING',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TreasuryDistribution_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TreasuryDistribution_status_idx" ON "TreasuryDistribution"("status");
CREATE INDEX "TreasuryDistribution_periodEnd_idx" ON "TreasuryDistribution"("periodEnd");

-- =====================
-- Treasury Balance
-- =====================

CREATE TABLE "TreasuryBalance" (
    "id" TEXT NOT NULL,
    "mainWallet" BIGINT NOT NULL DEFAULT 0,
    "liquidityWallet" BIGINT NOT NULL DEFAULT 0,
    "stakingWallet" BIGINT NOT NULL DEFAULT 0,
    "grantsWallet" BIGINT NOT NULL DEFAULT 0,
    "totalRevenue" BIGINT NOT NULL DEFAULT 0,
    "totalDistributed" BIGINT NOT NULL DEFAULT 0,
    "totalToLiquidity" BIGINT NOT NULL DEFAULT 0,
    "totalToStaking" BIGINT NOT NULL DEFAULT 0,
    "totalToGrants" BIGINT NOT NULL DEFAULT 0,
    "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TreasuryBalance_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TreasuryBalance_snapshotAt_idx" ON "TreasuryBalance"("snapshotAt");

-- =====================
-- Fee Collection
-- =====================

CREATE TABLE "FeeCollection" (
    "id" TEXT NOT NULL,
    "source" "FeeSource" NOT NULL,
    "amount" BIGINT NOT NULL,
    "token" TEXT NOT NULL,
    "signature" TEXT,
    "relatedTx" TEXT,
    "relatedType" TEXT,
    "collected" BOOLEAN NOT NULL DEFAULT false,
    "collectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeeCollection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FeeCollection_signature_key" ON "FeeCollection"("signature");
CREATE INDEX "FeeCollection_source_idx" ON "FeeCollection"("source");
CREATE INDEX "FeeCollection_collected_idx" ON "FeeCollection"("collected");
CREATE INDEX "FeeCollection_createdAt_idx" ON "FeeCollection"("createdAt");

-- =====================
-- Token Burns
-- =====================

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

-- =====================
-- Fee Snapshots (Staker Fee Sharing)
-- =====================

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

-- =====================
-- Metrics Snapshots
-- =====================

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

-- =====================
-- Add autoCompound to Stake
-- =====================

ALTER TABLE "Stake" ADD COLUMN "autoCompound" BOOLEAN NOT NULL DEFAULT false;

-- =====================
-- Add createdAt index to TransactionLog (used by metrics)
-- =====================

CREATE INDEX IF NOT EXISTS "TransactionLog_createdAt_idx" ON "TransactionLog"("createdAt");

-- =====================
-- Grant permissions to app user
-- =====================

GRANT ALL PRIVILEGES ON TABLE "ReferralCode" TO mvga_app;
GRANT ALL PRIVILEGES ON TABLE "Referral" TO mvga_app;
GRANT ALL PRIVILEGES ON TABLE "TreasuryDistribution" TO mvga_app;
GRANT ALL PRIVILEGES ON TABLE "TreasuryBalance" TO mvga_app;
GRANT ALL PRIVILEGES ON TABLE "FeeCollection" TO mvga_app;
GRANT ALL PRIVILEGES ON TABLE "TokenBurn" TO mvga_app;
GRANT ALL PRIVILEGES ON TABLE "FeeSnapshot" TO mvga_app;
GRANT ALL PRIVILEGES ON TABLE "MetricsSnapshot" TO mvga_app;
