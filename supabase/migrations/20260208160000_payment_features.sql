-- Payment features: new payment methods + payment requests
-- NOTE: Keep this migration idempotent-ish for safety during urgent launches.

-- Add new P2P payment methods
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'PAGO_MOVIL';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'BINANCE_PAY';

-- Payment request status enum
DO $$
BEGIN
  CREATE TYPE "PaymentRequestStatus" AS ENUM ('PENDING', 'PAID', 'EXPIRED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- Payment requests table (Charge / Cobrar)
CREATE TABLE IF NOT EXISTS "PaymentRequest" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid()::text),
    "recipientAddress" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "memo" TEXT,
    "status" "PaymentRequestStatus" NOT NULL DEFAULT 'PENDING',
    "paymentTx" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentRequest_paymentTx_key" ON "PaymentRequest"("paymentTx");
CREATE INDEX IF NOT EXISTS "PaymentRequest_recipientAddress_idx" ON "PaymentRequest"("recipientAddress");
CREATE INDEX IF NOT EXISTS "PaymentRequest_status_idx" ON "PaymentRequest"("status");
CREATE INDEX IF NOT EXISTS "PaymentRequest_expiresAt_idx" ON "PaymentRequest"("expiresAt");

-- Allow app role to access the new table/type (the API connects as mvga_app).
GRANT USAGE ON TYPE "PaymentRequestStatus" TO mvga_app;
GRANT ALL PRIVILEGES ON TABLE "PaymentRequest" TO mvga_app;

