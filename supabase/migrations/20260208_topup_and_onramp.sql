-- Mobile Top-Ups (Reloadly)
CREATE TYPE "TopUpStatus" AS ENUM ('PENDING', 'SUCCESSFUL', 'FAILED', 'REFUNDED');

CREATE TABLE "TopUp" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "userId" TEXT NOT NULL,
  "recipientPhone" TEXT NOT NULL,
  "countryCode" TEXT NOT NULL,
  "operatorId" INTEGER NOT NULL,
  "operatorName" TEXT NOT NULL,
  "amountUsd" DOUBLE PRECISION NOT NULL,
  "deliveredAmount" DOUBLE PRECISION,
  "deliveredCurrency" TEXT,
  "status" "TopUpStatus" NOT NULL DEFAULT 'PENDING',
  "reloadlyTxId" TEXT,
  "customIdentifier" TEXT NOT NULL,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TopUp_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TopUp_reloadlyTxId_key" ON "TopUp"("reloadlyTxId");
CREATE UNIQUE INDEX "TopUp_customIdentifier_key" ON "TopUp"("customIdentifier");
CREATE INDEX "TopUp_userId_idx" ON "TopUp"("userId");
CREATE INDEX "TopUp_status_idx" ON "TopUp"("status");
