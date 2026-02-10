-- Gift Card (Bitrefill) model
CREATE TYPE "GiftCardStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED', 'CANCELLED');

CREATE TABLE "GiftCard" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "category" TEXT,
    "amountUsd" DOUBLE PRECISION NOT NULL,
    "code" TEXT,
    "pin" TEXT,
    "status" "GiftCardStatus" NOT NULL DEFAULT 'PENDING',
    "bitrefillOrderId" TEXT,
    "customIdentifier" TEXT NOT NULL,
    "paymentSignature" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GiftCard_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GiftCard_bitrefillOrderId_key" ON "GiftCard"("bitrefillOrderId");
CREATE UNIQUE INDEX "GiftCard_customIdentifier_key" ON "GiftCard"("customIdentifier");
CREATE INDEX "GiftCard_walletAddress_idx" ON "GiftCard"("walletAddress");
CREATE INDEX "GiftCard_status_idx" ON "GiftCard"("status");
