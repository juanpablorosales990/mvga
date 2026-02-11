-- Phase 2: Social Payment Requests (Request from @username)
-- Adds requesterId, requesterUsername, requesteeAddress, note, declinedAt to PaymentRequest
-- Adds DECLINED status to PaymentRequestStatus enum
-- Adds payments column to NotificationPreference

-- 1. Add DECLINED to PaymentRequestStatus enum
ALTER TYPE "PaymentRequestStatus" ADD VALUE IF NOT EXISTS 'DECLINED';

-- 2. Add social request columns to PaymentRequest
ALTER TABLE "PaymentRequest" ADD COLUMN IF NOT EXISTS "requesterId" TEXT;
ALTER TABLE "PaymentRequest" ADD COLUMN IF NOT EXISTS "requesterUsername" TEXT;
ALTER TABLE "PaymentRequest" ADD COLUMN IF NOT EXISTS "requesteeAddress" TEXT;
ALTER TABLE "PaymentRequest" ADD COLUMN IF NOT EXISTS "note" TEXT;
ALTER TABLE "PaymentRequest" ADD COLUMN IF NOT EXISTS "declinedAt" TIMESTAMP(3);

-- 3. Add FK constraint for requesterId → User
ALTER TABLE "PaymentRequest"
  ADD CONSTRAINT "PaymentRequest_requesterId_fkey"
  FOREIGN KEY ("requesterId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. Add indexes for social request queries
CREATE INDEX IF NOT EXISTS "PaymentRequest_requesteeAddress_idx" ON "PaymentRequest"("requesteeAddress");
CREATE INDEX IF NOT EXISTS "PaymentRequest_requesterId_idx" ON "PaymentRequest"("requesterId");

-- 5. Add payments column to NotificationPreference
ALTER TABLE "NotificationPreference" ADD COLUMN IF NOT EXISTS "payments" BOOLEAN NOT NULL DEFAULT true;

-- 6. Grant permissions
GRANT SELECT, INSERT, UPDATE ON "PaymentRequest" TO mvga_app;
GRANT SELECT, UPDATE ON "NotificationPreference" TO mvga_app;
