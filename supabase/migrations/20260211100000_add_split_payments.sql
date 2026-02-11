-- Split Payments Feature — Group expense sharing
-- Creator pays a bill, then splits cost by creating individual payment requests

-- 1. Create SplitPaymentStatus enum
DO $$ BEGIN
  CREATE TYPE "SplitPaymentStatus" AS ENUM ('PENDING', 'PARTIAL', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Create SplitPayment table
CREATE TABLE IF NOT EXISTS "SplitPayment" (
  "id"               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "creatorId"        TEXT NOT NULL,
  "creatorAddress"   TEXT NOT NULL,
  "totalAmount"      BIGINT NOT NULL,
  "token"            TEXT NOT NULL,
  "description"      TEXT NOT NULL,
  "participantCount" INTEGER NOT NULL,
  "status"           "SplitPaymentStatus" NOT NULL DEFAULT 'PENDING',
  "paidCount"        INTEGER NOT NULL DEFAULT 0,
  "totalCollected"   BIGINT NOT NULL DEFAULT 0,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt"      TIMESTAMP(3)
);

-- 3. Add FK constraint for creatorId → User
ALTER TABLE "SplitPayment"
  ADD CONSTRAINT "SplitPayment_creatorId_fkey"
  FOREIGN KEY ("creatorId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. Add splitPaymentId column to PaymentRequest
ALTER TABLE "PaymentRequest" ADD COLUMN IF NOT EXISTS "splitPaymentId" TEXT;

-- 5. Add FK constraint for splitPaymentId → SplitPayment
ALTER TABLE "PaymentRequest"
  ADD CONSTRAINT "PaymentRequest_splitPaymentId_fkey"
  FOREIGN KEY ("splitPaymentId") REFERENCES "SplitPayment"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 6. Create indexes
CREATE INDEX IF NOT EXISTS "SplitPayment_creatorId_idx" ON "SplitPayment"("creatorId");
CREATE INDEX IF NOT EXISTS "SplitPayment_status_idx" ON "SplitPayment"("status");
CREATE INDEX IF NOT EXISTS "SplitPayment_createdAt_idx" ON "SplitPayment"("createdAt");
CREATE INDEX IF NOT EXISTS "PaymentRequest_splitPaymentId_idx" ON "PaymentRequest"("splitPaymentId");
