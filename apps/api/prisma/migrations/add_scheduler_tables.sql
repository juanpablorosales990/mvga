-- Scheduler Module: Recurring Payments, DCA Orders, Scheduled Executions
-- Created: 2026-02-08

-- Enums
DO $$ BEGIN
  CREATE TYPE "RecurringFrequency" AS ENUM ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "RecurringStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ScheduledType" AS ENUM ('PAYMENT', 'DCA');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ExecutionStatus" AS ENUM ('PENDING', 'COMPLETED', 'EXPIRED', 'FAILED', 'SKIPPED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- RecurringPayment
CREATE TABLE IF NOT EXISTS "RecurringPayment" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "walletAddress" TEXT NOT NULL,
  "recipientAddress" TEXT NOT NULL,
  "recipientLabel" TEXT,
  "token" TEXT NOT NULL,
  "amount" BIGINT NOT NULL,
  "frequency" "RecurringFrequency" NOT NULL,
  "status" "RecurringStatus" NOT NULL DEFAULT 'ACTIVE',
  "memo" TEXT,
  "nextExecutionAt" TIMESTAMP(3) NOT NULL,
  "lastExecutedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecurringPayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RecurringPayment_walletAddress_status_idx"
  ON "RecurringPayment"("walletAddress", "status");
CREATE INDEX IF NOT EXISTS "RecurringPayment_status_nextExecutionAt_idx"
  ON "RecurringPayment"("status", "nextExecutionAt");

-- DCAOrder
CREATE TABLE IF NOT EXISTS "DCAOrder" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "walletAddress" TEXT NOT NULL,
  "inputToken" TEXT NOT NULL,
  "outputToken" TEXT NOT NULL,
  "inputAmount" BIGINT NOT NULL,
  "frequency" "RecurringFrequency" NOT NULL,
  "status" "RecurringStatus" NOT NULL DEFAULT 'ACTIVE',
  "slippageBps" INTEGER NOT NULL DEFAULT 50,
  "totalSpent" BIGINT NOT NULL DEFAULT 0,
  "totalReceived" BIGINT NOT NULL DEFAULT 0,
  "executionCount" INTEGER NOT NULL DEFAULT 0,
  "nextExecutionAt" TIMESTAMP(3) NOT NULL,
  "lastExecutedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DCAOrder_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DCAOrder_walletAddress_status_idx"
  ON "DCAOrder"("walletAddress", "status");
CREATE INDEX IF NOT EXISTS "DCAOrder_status_nextExecutionAt_idx"
  ON "DCAOrder"("status", "nextExecutionAt");

-- ScheduledExecution
CREATE TABLE IF NOT EXISTS "ScheduledExecution" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "type" "ScheduledType" NOT NULL,
  "paymentId" TEXT,
  "dcaId" TEXT,
  "status" "ExecutionStatus" NOT NULL DEFAULT 'PENDING',
  "scheduledFor" TIMESTAMP(3) NOT NULL,
  "notifiedAt" TIMESTAMP(3),
  "executedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "signature" TEXT,
  "inputAmount" BIGINT,
  "outputAmount" BIGINT,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScheduledExecution_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on signature
CREATE UNIQUE INDEX IF NOT EXISTS "ScheduledExecution_signature_key"
  ON "ScheduledExecution"("signature");

-- Indexes
CREATE INDEX IF NOT EXISTS "ScheduledExecution_status_expiresAt_idx"
  ON "ScheduledExecution"("status", "expiresAt");
CREATE INDEX IF NOT EXISTS "ScheduledExecution_paymentId_idx"
  ON "ScheduledExecution"("paymentId");
CREATE INDEX IF NOT EXISTS "ScheduledExecution_dcaId_idx"
  ON "ScheduledExecution"("dcaId");

-- Foreign keys
ALTER TABLE "ScheduledExecution"
  DROP CONSTRAINT IF EXISTS "ScheduledExecution_paymentId_fkey";
ALTER TABLE "ScheduledExecution"
  ADD CONSTRAINT "ScheduledExecution_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "RecurringPayment"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScheduledExecution"
  DROP CONSTRAINT IF EXISTS "ScheduledExecution_dcaId_fkey";
ALTER TABLE "ScheduledExecution"
  ADD CONSTRAINT "ScheduledExecution_dcaId_fkey"
  FOREIGN KEY ("dcaId") REFERENCES "DCAOrder"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
