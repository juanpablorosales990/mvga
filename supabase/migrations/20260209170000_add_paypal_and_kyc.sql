-- Add PayPal fields to PaymentRequest
ALTER TABLE "PaymentRequest"
ADD COLUMN IF NOT EXISTS "paypalOrderId" TEXT,
ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentRequest_paypalOrderId_key"
ON "PaymentRequest"("paypalOrderId");

-- Create KYC enum and table
DO $$ BEGIN
  CREATE TYPE "KycStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "UserKyc" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL,
  "status" "KycStatus" NOT NULL DEFAULT 'UNVERIFIED',
  "provider" TEXT NOT NULL DEFAULT 'PERSONA',
  "externalId" TEXT,
  "tier" INTEGER NOT NULL DEFAULT 0,
  "rejectionReason" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserKyc_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserKyc_userId_key" ON "UserKyc"("userId");
CREATE INDEX IF NOT EXISTS "UserKyc_status_idx" ON "UserKyc"("status");

DO $$ BEGIN
  ALTER TABLE "UserKyc" ADD CONSTRAINT "UserKyc_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Grant permissions to app user
GRANT ALL ON "UserKyc" TO mvga_app;
GRANT USAGE ON TYPE "KycStatus" TO mvga_app;
