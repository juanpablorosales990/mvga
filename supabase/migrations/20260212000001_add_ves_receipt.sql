-- Add receipt fields to VesOrder for payment proof
ALTER TABLE "VesOrder" ADD COLUMN IF NOT EXISTS "paymentReceipt" TEXT;
ALTER TABLE "VesOrder" ADD COLUMN IF NOT EXISTS "paymentReference" TEXT;
ALTER TABLE "VesOrder" ADD COLUMN IF NOT EXISTS "receiptUploadedAt" TIMESTAMPTZ;
