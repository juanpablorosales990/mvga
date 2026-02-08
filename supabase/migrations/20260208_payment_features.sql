-- Payment features: new payment methods + payment requests

-- Add new P2P payment methods
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'PAGO_MOVIL';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'BINANCE_PAY';

-- Payment request status enum
CREATE TYPE "PaymentRequestStatus" AS ENUM ('PENDING', 'PAID', 'EXPIRED', 'CANCELLED');

-- Payment requests table (Charge / Cobrar)
CREATE TABLE "PaymentRequest" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "recipientAddress" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "memo" TEXT,
    "status" "PaymentRequestStatus" NOT NULL DEFAULT 'PENDING',
    "paymentTx" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PaymentRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentRequest_paymentTx_key" ON "PaymentRequest"("paymentTx");
CREATE INDEX "PaymentRequest_recipientAddress_idx" ON "PaymentRequest"("recipientAddress");
CREATE INDEX "PaymentRequest_status_idx" ON "PaymentRequest"("status");
CREATE INDEX "PaymentRequest_expiresAt_idx" ON "PaymentRequest"("expiresAt");
