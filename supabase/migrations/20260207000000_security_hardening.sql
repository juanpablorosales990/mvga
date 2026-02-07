-- =============================================================================
-- Security Hardening Migration
-- Auth nonces, claim history, cron locks, distribution steps, vault reconciliation
-- =============================================================================

-- =====================
-- Auth Nonces (replace in-memory Map for multi-instance support)
-- =====================
CREATE TABLE "AuthNonce" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "walletAddress" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthNonce_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuthNonce_walletAddress_key" ON "AuthNonce"("walletAddress");
CREATE INDEX "AuthNonce_expiresAt_idx" ON "AuthNonce"("expiresAt");

-- =====================
-- Staking Claim History (idempotency + audit trail)
-- =====================
CREATE TABLE "StakingClaim" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "feeRewards" BIGINT NOT NULL DEFAULT 0,
    "signature" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StakingClaim_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StakingClaim_signature_key" ON "StakingClaim"("signature");
CREATE INDEX "StakingClaim_userId_idx" ON "StakingClaim"("userId");
CREATE INDEX "StakingClaim_claimedAt_idx" ON "StakingClaim"("claimedAt");

ALTER TABLE "StakingClaim" ADD CONSTRAINT "StakingClaim_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =====================
-- Cron Lock Table (PgBouncer-compatible distributed locking)
-- Uses partial unique index: only one active (non-completed, non-expired) lock per job
-- =====================
CREATE TABLE "CronLock" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "jobName" TEXT NOT NULL,
    "lockedBy" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "CronLock_pkey" PRIMARY KEY ("id")
);

-- Partial unique index: only one non-completed lock per job allowed
CREATE UNIQUE INDEX "CronLock_jobName_active_idx" ON "CronLock"("jobName")
    WHERE "completedAt" IS NULL;
CREATE INDEX "CronLock_expiresAt_idx" ON "CronLock"("expiresAt");

-- =====================
-- Treasury Distribution Steps (resumable state machine)
-- =====================
CREATE TABLE "DistributionStep" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "distributionId" TEXT NOT NULL,
    "stepName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "signature" TEXT,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DistributionStep_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DistributionStep_distributionId_idx" ON "DistributionStep"("distributionId");
CREATE UNIQUE INDEX "DistributionStep_dist_step_key" ON "DistributionStep"("distributionId", "stepName");

ALTER TABLE "DistributionStep" ADD CONSTRAINT "DistributionStep_distributionId_fkey"
    FOREIGN KEY ("distributionId") REFERENCES "TreasuryDistribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =====================
-- Vault Reconciliation Log
-- =====================
CREATE TABLE "VaultReconciliation" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "vaultType" TEXT NOT NULL DEFAULT 'STAKING',
    "onChainBalance" BIGINT NOT NULL,
    "dbSum" BIGINT NOT NULL,
    "discrepancy" BIGINT NOT NULL,
    "discrepancyPercent" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OK',
    "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VaultReconciliation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VaultReconciliation_snapshotAt_idx" ON "VaultReconciliation"("snapshotAt");
CREATE INDEX "VaultReconciliation_status_idx" ON "VaultReconciliation"("status");

-- =====================
-- Add processingAt column to P2PTrade for optimistic locking
-- =====================
ALTER TABLE "P2PTrade" ADD COLUMN "processingAt" TIMESTAMP(3);

-- =====================
-- Add lastClaimedAt to Stake for accurate reward calculation
-- =====================
ALTER TABLE "Stake" ADD COLUMN "lastClaimedAt" TIMESTAMP(3);

-- =====================
-- Grant permissions to app user
-- =====================
GRANT ALL PRIVILEGES ON TABLE "AuthNonce" TO mvga_app;
GRANT ALL PRIVILEGES ON TABLE "StakingClaim" TO mvga_app;
GRANT ALL PRIVILEGES ON TABLE "CronLock" TO mvga_app;
GRANT ALL PRIVILEGES ON TABLE "DistributionStep" TO mvga_app;
GRANT ALL PRIVILEGES ON TABLE "VaultReconciliation" TO mvga_app;
