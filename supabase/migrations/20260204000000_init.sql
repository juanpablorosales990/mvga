-- CreateEnum
CREATE TYPE "StakeStatus" AS ENUM ('ACTIVE', 'UNSTAKING', 'UNSTAKED');

-- CreateEnum
CREATE TYPE "P2POfferType" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('ZELLE', 'VENMO', 'PAYPAL', 'BANK_TRANSFER');

-- CreateEnum
CREATE TYPE "P2POfferStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "P2PTradeStatus" AS ENUM ('PENDING', 'ESCROW_LOCKED', 'PAID', 'COMPLETED', 'DISPUTED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "GrantStatus" AS ENUM ('VOTING', 'APPROVED', 'REJECTED', 'FUNDED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "VoteDirection" AS ENUM ('FOR', 'AGAINST');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('STAKE', 'UNSTAKE', 'P2P_ESCROW_LOCK', 'P2P_ESCROW_RELEASE', 'P2P_ESCROW_REFUND', 'GRANT_FUNDING', 'SWAP', 'TRANSFER');

-- CreateEnum
CREATE TYPE "TransactionLogStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserReputation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalTrades" INTEGER NOT NULL DEFAULT 0,
    "completedTrades" INTEGER NOT NULL DEFAULT 0,
    "disputesWon" INTEGER NOT NULL DEFAULT 0,
    "disputesLost" INTEGER NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "avgResponseTime" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserReputation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stake" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "lockPeriod" INTEGER NOT NULL,
    "lockedUntil" TIMESTAMP(3),
    "stakeTx" TEXT,
    "unstakeTx" TEXT,
    "status" "StakeStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "unstakedAt" TIMESTAMP(3),

    CONSTRAINT "Stake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "P2POffer" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "type" "P2POfferType" NOT NULL,
    "cryptoAmount" BIGINT NOT NULL,
    "availableAmount" BIGINT NOT NULL,
    "cryptoCurrency" TEXT NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "paymentInstructions" TEXT,
    "rate" DOUBLE PRECISION NOT NULL,
    "minAmount" BIGINT NOT NULL,
    "maxAmount" BIGINT NOT NULL,
    "status" "P2POfferStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "P2POffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "P2PTrade" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "cryptoAmount" BIGINT NOT NULL,
    "status" "P2PTradeStatus" NOT NULL DEFAULT 'PENDING',
    "escrowTx" TEXT,
    "releaseTx" TEXT,
    "disputeReason" TEXT,
    "disputeEvidence" TEXT,
    "disputeResolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "P2PTrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrantProposal" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "businessLocation" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "requestedAmount" BIGINT NOT NULL,
    "videoUrl" TEXT,
    "applicantAddress" TEXT NOT NULL,
    "status" "GrantStatus" NOT NULL DEFAULT 'VOTING',
    "votesFor" INTEGER NOT NULL DEFAULT 0,
    "votesAgainst" INTEGER NOT NULL DEFAULT 0,
    "votingStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "votingEndsAt" TIMESTAMP(3) NOT NULL,
    "fundedAt" TIMESTAMP(3),
    "fundingTx" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GrantProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "weight" BIGINT NOT NULL,
    "direction" "VoteDirection" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrantUpdate" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GrantUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionLog" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "signature" TEXT NOT NULL,
    "amount" BIGINT,
    "token" TEXT,
    "status" "TransactionLogStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "TransactionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_walletAddress_key" ON "User"("walletAddress");

-- CreateIndex
CREATE INDEX "User_walletAddress_idx" ON "User"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "UserReputation_userId_key" ON "UserReputation"("userId");

-- CreateIndex
CREATE INDEX "Stake_userId_idx" ON "Stake"("userId");

-- CreateIndex
CREATE INDEX "Stake_status_idx" ON "Stake"("status");

-- CreateIndex
CREATE INDEX "P2POffer_sellerId_idx" ON "P2POffer"("sellerId");

-- CreateIndex
CREATE INDEX "P2POffer_status_idx" ON "P2POffer"("status");

-- CreateIndex
CREATE INDEX "P2POffer_cryptoCurrency_idx" ON "P2POffer"("cryptoCurrency");

-- CreateIndex
CREATE INDEX "P2POffer_paymentMethod_idx" ON "P2POffer"("paymentMethod");

-- CreateIndex
CREATE INDEX "P2PTrade_offerId_idx" ON "P2PTrade"("offerId");

-- CreateIndex
CREATE INDEX "P2PTrade_buyerId_idx" ON "P2PTrade"("buyerId");

-- CreateIndex
CREATE INDEX "P2PTrade_sellerId_idx" ON "P2PTrade"("sellerId");

-- CreateIndex
CREATE INDEX "P2PTrade_status_idx" ON "P2PTrade"("status");

-- CreateIndex
CREATE INDEX "GrantProposal_status_idx" ON "GrantProposal"("status");

-- CreateIndex
CREATE INDEX "GrantProposal_applicantAddress_idx" ON "GrantProposal"("applicantAddress");

-- CreateIndex
CREATE INDEX "Vote_proposalId_idx" ON "Vote"("proposalId");

-- CreateIndex
CREATE INDEX "Vote_voterId_idx" ON "Vote"("voterId");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_proposalId_voterId_key" ON "Vote"("proposalId", "voterId");

-- CreateIndex
CREATE INDEX "GrantUpdate_proposalId_idx" ON "GrantUpdate"("proposalId");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionLog_signature_key" ON "TransactionLog"("signature");

-- CreateIndex
CREATE INDEX "TransactionLog_walletAddress_idx" ON "TransactionLog"("walletAddress");

-- CreateIndex
CREATE INDEX "TransactionLog_type_idx" ON "TransactionLog"("type");

-- CreateIndex
CREATE INDEX "TransactionLog_signature_idx" ON "TransactionLog"("signature");

-- AddForeignKey
ALTER TABLE "UserReputation" ADD CONSTRAINT "UserReputation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stake" ADD CONSTRAINT "Stake_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "P2POffer" ADD CONSTRAINT "P2POffer_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "P2PTrade" ADD CONSTRAINT "P2PTrade_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "P2POffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "P2PTrade" ADD CONSTRAINT "P2PTrade_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "P2PTrade" ADD CONSTRAINT "P2PTrade_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "GrantProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrantUpdate" ADD CONSTRAINT "GrantUpdate_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "GrantProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

