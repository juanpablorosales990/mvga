-- MoneyGram Ramps (Stellar SEP-24 + Allbridge)
-- Direction enum
DO $$ BEGIN
  CREATE TYPE "MoneygramDirection" AS ENUM ('ONRAMP', 'OFFRAMP');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Status enum
DO $$ BEGIN
  CREATE TYPE "MoneygramStatus" AS ENUM (
    'INITIATED', 'PENDING_KYC', 'CONFIRMED', 'BRIDGING', 'USDC_SENT',
    'PENDING_PICKUP', 'PENDING_DEPOSIT', 'USDC_RECEIVED', 'BRIDGING_BACK',
    'COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- MoneygramTransaction table
CREATE TABLE IF NOT EXISTS "MoneygramTransaction" (
  "id"                   TEXT NOT NULL DEFAULT gen_random_uuid(),
  "walletAddress"        TEXT NOT NULL,
  "direction"            "MoneygramDirection" NOT NULL,
  "amountUsd"            DOUBLE PRECISION NOT NULL,
  "status"               "MoneygramStatus" NOT NULL DEFAULT 'INITIATED',

  -- SEP-24 identifiers
  "stellarTransactionId" TEXT,
  "interactiveUrl"       TEXT,
  "stellarMemo"          TEXT,
  "stellarDestination"   TEXT,

  -- Bridge tracking
  "bridgeTxSolana"       TEXT,
  "bridgeTxStellar"      TEXT,
  "bridgeStatus"         TEXT,

  -- MoneyGram details
  "referenceNumber"      TEXT,
  "pickupLocation"       TEXT,

  -- Fees
  "bridgeFeeUsd"         DOUBLE PRECISION,
  "mgFeeUsd"             DOUBLE PRECISION,
  "netAmountUsd"         DOUBLE PRECISION,

  -- Error handling
  "errorMessage"         TEXT,
  "retryCount"           INTEGER NOT NULL DEFAULT 0,
  "lastPolledAt"         TIMESTAMP(3),

  -- Lifecycle
  "confirmedAt"          TIMESTAMP(3),
  "completedAt"          TIMESTAMP(3),
  "cancelledAt"          TIMESTAMP(3),
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MoneygramTransaction_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on stellarTransactionId
CREATE UNIQUE INDEX IF NOT EXISTS "MoneygramTransaction_stellarTransactionId_key"
  ON "MoneygramTransaction"("stellarTransactionId");

-- Indexes
CREATE INDEX IF NOT EXISTS "MoneygramTransaction_walletAddress_idx"
  ON "MoneygramTransaction"("walletAddress");
CREATE INDEX IF NOT EXISTS "MoneygramTransaction_status_idx"
  ON "MoneygramTransaction"("status");
CREATE INDEX IF NOT EXISTS "MoneygramTransaction_status_lastPolledAt_idx"
  ON "MoneygramTransaction"("status", "lastPolledAt");
