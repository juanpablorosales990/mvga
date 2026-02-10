-- VES On-Ramp: P2P Pago Móvil → USDC marketplace

-- Enums
CREATE TYPE "VesOfferStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DEPLETED');
CREATE TYPE "VesOrderStatus" AS ENUM ('PENDING', 'ESCROW_LOCKED', 'PAYMENT_SENT', 'COMPLETED', 'DISPUTED', 'CANCELLED', 'REFUNDED', 'EXPIRED');

-- VesOffer (LP liquidity listings)
CREATE TABLE "VesOffer" (
    "id" TEXT NOT NULL,
    "lpWalletAddress" TEXT NOT NULL,
    "lpUserId" TEXT NOT NULL,
    "availableUsdc" BIGINT NOT NULL,
    "vesRate" DOUBLE PRECISION NOT NULL,
    "feePercent" DOUBLE PRECISION NOT NULL,
    "minOrderUsdc" BIGINT NOT NULL,
    "maxOrderUsdc" BIGINT NOT NULL,
    "bankCode" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "ciNumber" TEXT NOT NULL,
    "status" "VesOfferStatus" NOT NULL DEFAULT 'ACTIVE',
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "completedOrders" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VesOffer_pkey" PRIMARY KEY ("id")
);

-- VesOrder (individual buy orders)
CREATE TABLE "VesOrder" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "buyerWalletAddress" TEXT NOT NULL,
    "buyerUserId" TEXT NOT NULL,
    "lpWalletAddress" TEXT NOT NULL,
    "amountUsdc" BIGINT NOT NULL,
    "amountVes" DOUBLE PRECISION NOT NULL,
    "vesRate" DOUBLE PRECISION NOT NULL,
    "feePercent" DOUBLE PRECISION NOT NULL,
    "status" "VesOrderStatus" NOT NULL DEFAULT 'PENDING',
    "escrowTx" TEXT,
    "releaseTx" TEXT,
    "disputeReason" TEXT,
    "disputeResolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VesOrder_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "VesOrder_escrowTx_key" ON "VesOrder"("escrowTx");
CREATE UNIQUE INDEX "VesOrder_releaseTx_key" ON "VesOrder"("releaseTx");

-- Indexes
CREATE INDEX "VesOffer_status_idx" ON "VesOffer"("status");
CREATE INDEX "VesOffer_lpWalletAddress_idx" ON "VesOffer"("lpWalletAddress");
CREATE INDEX "VesOffer_vesRate_idx" ON "VesOffer"("vesRate");
CREATE INDEX "VesOrder_buyerWalletAddress_idx" ON "VesOrder"("buyerWalletAddress");
CREATE INDEX "VesOrder_lpWalletAddress_idx" ON "VesOrder"("lpWalletAddress");
CREATE INDEX "VesOrder_status_idx" ON "VesOrder"("status");
CREATE INDEX "VesOrder_expiresAt_idx" ON "VesOrder"("expiresAt");

-- Foreign keys
ALTER TABLE "VesOffer" ADD CONSTRAINT "VesOffer_lpUserId_fkey" FOREIGN KEY ("lpUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VesOrder" ADD CONSTRAINT "VesOrder_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "VesOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VesOrder" ADD CONSTRAINT "VesOrder_buyerUserId_fkey" FOREIGN KEY ("buyerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Grant access to app role
GRANT ALL ON "VesOffer" TO mvga_app;
GRANT ALL ON "VesOrder" TO mvga_app;
