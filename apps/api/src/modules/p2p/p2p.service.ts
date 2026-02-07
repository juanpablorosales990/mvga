import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma.service';
import { TransactionLoggerService } from '../../common/transaction-logger.service';
import { SolanaService } from '../wallet/solana.service';
import { CreateOfferDto, AcceptOfferDto, UpdateTradeStatusDto } from './dto/create-offer.dto';
import { P2POfferType, PaymentMethod, P2POfferStatus, P2PTradeStatus } from '@prisma/client';
import { Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction } from '@solana/spl-token';

// Scale factor for storing decimal amounts as BigInt (6 decimal places)
const AMOUNT_SCALE = 1_000_000;

function toBigInt(n: number): bigint {
  return BigInt(Math.round(n * AMOUNT_SCALE));
}

function toNumber(n: bigint): number {
  return Number(n) / AMOUNT_SCALE;
}

// Token decimals for escrow
const TOKEN_DECIMALS: Record<string, number> = {
  USDC: 6,
  MVGA: 9,
};

const TOKEN_MINTS: Record<string, string> = {
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  MVGA: 'DRX65kM2n5CLTpdjJCemZvkUwE98ou4RpHrd8Z3GH5Qh',
};

@Injectable()
export class P2PService {
  private readonly logger = new Logger(P2PService.name);
  private escrowKeypair: Keypair | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly txLogger: TransactionLoggerService,
    private readonly solana: SolanaService,
    private readonly config: ConfigService
  ) {
    // Load escrow wallet keypair from env
    const keypairStr = this.config.get<string>('ESCROW_WALLET_KEYPAIR');
    if (keypairStr) {
      try {
        const decoded = Buffer.from(keypairStr, 'base64');
        this.escrowKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(decoded.toString())));
        this.logger.log('Escrow wallet keypair loaded');
      } catch (e) {
        throw new Error(`ESCROW_WALLET_KEYPAIR is set but invalid: ${(e as Error).message}`);
      }
    } else {
      this.logger.warn('ESCROW_WALLET_KEYPAIR not set — escrow release/refund will be unavailable');
    }
  }

  private async findOrCreateUser(walletAddress: string) {
    return this.prisma.user.upsert({
      where: { walletAddress },
      update: {},
      create: { walletAddress },
    });
  }

  // ============ OFFERS ============

  async createOffer(dto: CreateOfferDto) {
    if (dto.minAmount > dto.maxAmount) {
      throw new BadRequestException('Min amount cannot be greater than max amount');
    }

    const user = await this.findOrCreateUser(dto.sellerAddress);

    const offer = await this.prisma.p2POffer.create({
      data: {
        sellerId: user.id,
        type: dto.type as P2POfferType,
        cryptoAmount: toBigInt(dto.cryptoAmount),
        availableAmount: toBigInt(dto.cryptoAmount),
        cryptoCurrency: dto.cryptoCurrency,
        paymentMethod: dto.paymentMethod as PaymentMethod,
        paymentInstructions: dto.paymentInstructions,
        rate: dto.rate,
        minAmount: toBigInt(dto.minAmount),
        maxAmount: toBigInt(dto.maxAmount),
      },
      include: { seller: true },
    });

    return this.formatOffer(offer);
  }

  async getOffers(filters?: {
    type?: 'BUY' | 'SELL';
    cryptoCurrency?: string;
    paymentMethod?: string;
    status?: string;
  }) {
    const where: Record<string, unknown> = {};

    if (filters?.type) where.type = filters.type;
    if (filters?.cryptoCurrency) where.cryptoCurrency = filters.cryptoCurrency;
    if (filters?.paymentMethod) where.paymentMethod = filters.paymentMethod;
    where.status = (filters?.status as P2POfferStatus) || 'ACTIVE';

    const offers = await this.prisma.p2POffer.findMany({
      where,
      include: { seller: true },
      orderBy: { rate: 'desc' },
    });

    return offers.map((o) => this.formatOffer(o));
  }

  async getOffer(id: string) {
    const offer = await this.prisma.p2POffer.findUnique({
      where: { id },
      include: { seller: true },
    });
    if (!offer) throw new NotFoundException('Offer not found');
    return this.formatOffer(offer);
  }

  async cancelOffer(id: string, walletAddress: string) {
    const offer = await this.prisma.p2POffer.findUnique({
      where: { id },
      include: { seller: true },
    });
    if (!offer) throw new NotFoundException('Offer not found');
    if (offer.seller.walletAddress !== walletAddress) {
      throw new BadRequestException('Only the seller can cancel this offer');
    }

    await this.prisma.p2POffer.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  // ============ TRADES ============

  async acceptOffer(offerId: string, dto: AcceptOfferDto) {
    const buyer = await this.findOrCreateUser(dto.buyerAddress);

    // Atomic transaction with row-level lock to prevent over-selling
    const trade = await this.prisma.$transaction(
      async (tx) => {
        // Lock the offer row to prevent concurrent acceptance
        const [offer] = await tx.$queryRaw<any[]>`
        SELECT o.*, u."walletAddress" as "sellerAddress"
        FROM "P2POffer" o
        JOIN "User" u ON o."sellerId" = u."id"
        WHERE o."id" = ${offerId}
        FOR UPDATE
      `;
        if (!offer) throw new NotFoundException('Offer not found');
        if (offer.status !== 'ACTIVE') {
          throw new BadRequestException('Offer is not active');
        }

        const minAmount = Number(offer.minAmount) / AMOUNT_SCALE;
        const maxAmount = Number(offer.maxAmount) / AMOUNT_SCALE;

        if (dto.amount < minAmount || dto.amount > maxAmount) {
          throw new BadRequestException(`Amount must be between ${minAmount} and ${maxAmount}`);
        }

        const cryptoAmount = dto.amount * offer.rate;
        const availableAmount = Number(offer.availableAmount) / AMOUNT_SCALE;
        if (cryptoAmount > availableAmount) {
          throw new BadRequestException('Not enough available in offer');
        }

        const newAvailable = availableAmount - cryptoAmount;
        const newStatus: P2POfferStatus = newAvailable <= 0 ? 'COMPLETED' : 'ACTIVE';

        await tx.p2POffer.update({
          where: { id: offerId },
          data: {
            availableAmount: toBigInt(Math.max(0, newAvailable)),
            status: newStatus,
          },
        });

        return tx.p2PTrade.create({
          data: {
            offerId,
            buyerId: buyer.id,
            sellerId: offer.sellerId,
            amount: toBigInt(dto.amount),
            cryptoAmount: toBigInt(cryptoAmount),
            status: 'PENDING',
          },
          include: { buyer: true, seller: true, offer: true },
        });
      },
      { maxWait: 5000, timeout: 15000 }
    );

    return this.formatTrade(trade);
  }

  async getTrade(id: string) {
    const trade = await this.prisma.p2PTrade.findUnique({
      where: { id },
      include: { buyer: true, seller: true, offer: true },
    });
    if (!trade) throw new NotFoundException('Trade not found');
    return this.formatTrade(trade);
  }

  async getUserTrades(walletAddress: string) {
    const user = await this.prisma.user.findUnique({
      where: { walletAddress },
    });
    if (!user) return [];

    const trades = await this.prisma.p2PTrade.findMany({
      where: {
        OR: [{ buyerId: user.id }, { sellerId: user.id }],
      },
      include: { buyer: true, seller: true, offer: true },
      orderBy: { createdAt: 'desc' },
    });

    return trades.map((t) => this.formatTrade(t));
  }

  // Valid status transitions to prevent illegal state changes
  private static readonly VALID_TRANSITIONS: Record<string, string[]> = {
    PENDING: ['ESCROW_LOCKED', 'CANCELLED'],
    ESCROW_LOCKED: ['PAID', 'CANCELLED', 'DISPUTED'],
    PAID: ['COMPLETED', 'DISPUTED', 'CANCELLED'],
    DISPUTED: ['COMPLETED', 'REFUNDED'],
  };

  async updateTradeStatus(tradeId: string, walletAddress: string, dto: UpdateTradeStatusDto) {
    // Lock the trade row FIRST to prevent concurrent status transitions
    const [trade] = await this.prisma.$queryRaw<any[]>`
      SELECT t.*, b."walletAddress" as "buyerAddress", s."walletAddress" as "sellerAddress"
      FROM "P2PTrade" t
      JOIN "User" b ON t."buyerId" = b."id"
      JOIN "User" s ON t."sellerId" = s."id"
      WHERE t."id" = ${tradeId}
      FOR UPDATE
    `;
    if (!trade) throw new NotFoundException('Trade not found');

    if (dto.status === 'PAID' && trade.buyerAddress !== walletAddress) {
      throw new BadRequestException('Only buyer can mark as paid');
    }
    if (dto.status === 'CONFIRMED' && trade.sellerAddress !== walletAddress) {
      throw new BadRequestException('Only seller can confirm receipt');
    }

    const requestedStatus = dto.status === 'CONFIRMED' ? 'COMPLETED' : dto.status;
    const allowedTransitions = P2PService.VALID_TRANSITIONS[trade.status] || [];
    if (!allowedTransitions.includes(requestedStatus)) {
      throw new BadRequestException(`Cannot transition from ${trade.status} to ${requestedStatus}`);
    }

    // Escrow operations: delegate to releaseEscrow/refundEscrow which have their own
    // row-level locking and idempotency. The FOR UPDATE above prevents two concurrent
    // callers from both passing the status guard; the escrow methods provide a second
    // layer of protection via their own SELECT ... FOR UPDATE.
    if (dto.status === 'CONFIRMED' && trade.escrowTx) {
      await this.releaseEscrow(tradeId);
      const updated = await this.prisma.p2PTrade.findUnique({
        where: { id: tradeId },
        include: { buyer: true, seller: true, offer: true },
      });
      return this.formatTrade(updated!);
    }

    if (dto.status === 'CANCELLED' && trade.escrowTx && trade.status === 'ESCROW_LOCKED') {
      await this.refundEscrow(tradeId);
      const updated = await this.prisma.p2PTrade.findUnique({
        where: { id: tradeId },
        include: { buyer: true, seller: true, offer: true },
      });
      return this.formatTrade(updated!);
    }

    // Non-escrow status updates
    const newStatus: P2PTradeStatus = requestedStatus as P2PTradeStatus;
    const updateData: Record<string, unknown> = { status: newStatus };
    if (dto.status === 'PAID') updateData.paidAt = new Date();
    if (dto.status === 'CONFIRMED') updateData.completedAt = new Date();
    if (dto.status === 'DISPUTED') updateData.disputeReason = dto.notes;

    const updated = await this.prisma.p2PTrade.update({
      where: { id: tradeId },
      data: updateData,
      include: { buyer: true, seller: true, offer: true },
    });

    // No escrow, just update reputations on completion
    if (dto.status === 'CONFIRMED') {
      await this.updateReputation(trade.buyerAddress, true);
      await this.updateReputation(trade.sellerAddress, true);
    }

    return this.formatTrade(updated);
  }

  // ============ REPUTATION ============

  async getReputation(walletAddress: string) {
    const user = await this.prisma.user.findUnique({
      where: { walletAddress },
      include: { reputation: true },
    });

    if (!user?.reputation) {
      return {
        walletAddress,
        totalTrades: 0,
        completedTrades: 0,
        disputesLost: 0,
        rating: 5.0,
        avgResponseTime: 0,
      };
    }

    return {
      walletAddress,
      totalTrades: user.reputation.totalTrades,
      completedTrades: user.reputation.completedTrades,
      disputesLost: user.reputation.disputesLost,
      rating: user.reputation.rating,
      avgResponseTime: user.reputation.avgResponseTime,
    };
  }

  private async updateReputation(walletAddress: string, successful: boolean) {
    const user = await this.findOrCreateUser(walletAddress);

    const reputation = await this.prisma.userReputation.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        totalTrades: 1,
        completedTrades: successful ? 1 : 0,
        disputesLost: successful ? 0 : 1,
        rating: 5.0,
      },
      update: {
        totalTrades: { increment: 1 },
        ...(successful
          ? { completedTrades: { increment: 1 } }
          : { disputesLost: { increment: 1 } }),
      },
    });

    // Recalculate rating
    const newRating = Math.max(
      1,
      5 - reputation.disputesLost * 0.5 + (reputation.completedTrades > 10 ? 0.5 : 0)
    );

    await this.prisma.userReputation.update({
      where: { userId: user.id },
      data: { rating: newRating },
    });
  }

  // ============ ESCROW ============

  /**
   * Returns the escrow (treasury) wallet address for the seller to build a transfer tx.
   * Frontend builds the SPL transfer, user signs it, then calls confirmEscrowLock.
   */
  async lockEscrow(tradeId: string) {
    const trade = await this.prisma.p2PTrade.findUnique({
      where: { id: tradeId },
      include: { offer: true, seller: true },
    });
    if (!trade) throw new NotFoundException('Trade not found');
    if (trade.status !== 'PENDING') {
      throw new BadRequestException('Trade is not in PENDING status');
    }

    const escrowWallet = this.config.get(
      'TREASURY_WALLET',
      'H9j1W4u5LEiw8AZdui6c8AmN6t4tKkPQCAULPW8eMiTE'
    );

    const currency = trade.offer.cryptoCurrency;
    const mintAddress = TOKEN_MINTS[currency];
    const decimals = TOKEN_DECIMALS[currency] || 9;
    const amount = toNumber(trade.cryptoAmount);

    return {
      escrowWallet,
      mintAddress,
      amount,
      decimals,
      tradeId,
    };
  }

  /**
   * Seller confirms escrow lock by providing the tx signature.
   * Server verifies on-chain, updates trade status.
   */
  async confirmEscrowLock(tradeId: string, signature: string) {
    return this.prisma.$transaction(
      async (tx) => {
        // Lock the trade row to prevent concurrent confirmations
        const [trade] = await tx.$queryRaw<any[]>`
          SELECT t.*, o."cryptoCurrency", o."cryptoAmount" as "offerCryptoAmount",
                 s."walletAddress" as "sellerAddress"
          FROM "P2PTrade" t
          JOIN "P2POffer" o ON t."offerId" = o."id"
          JOIN "User" s ON t."sellerId" = s."id"
          WHERE t."id" = ${tradeId}
          FOR UPDATE
        `;
        if (!trade) throw new NotFoundException('Trade not found');

        if (trade.status !== 'PENDING') {
          // Idempotent: if already locked with this signature, return success
          if (trade.escrowTx === signature) {
            return { success: true, tradeId, signature };
          }
          throw new BadRequestException(
            `Trade is not in PENDING status (current: ${trade.status})`
          );
        }

        // Check if this signature is already used for another trade
        const existingTrade = await tx.p2PTrade.findFirst({
          where: { escrowTx: signature },
        });
        if (existingTrade && existingTrade.id !== tradeId) {
          throw new BadRequestException(
            'This transaction signature is already used for another trade'
          );
        }

        // Verify on-chain
        const connection = this.solana.getConnection();
        const parsedTx = await connection.getParsedTransaction(signature, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0,
        });

        if (!parsedTx || parsedTx.meta?.err) {
          throw new BadRequestException('Transaction not found or failed');
        }

        // Verify signer matches the seller
        const signers = parsedTx.transaction.message.accountKeys
          .filter((k: any) => k.signer)
          .map((k: any) => k.pubkey.toBase58());

        if (!signers.includes(trade.sellerAddress)) {
          throw new BadRequestException('Transaction was not signed by the seller');
        }

        // Verify on-chain transfer amount matches expected escrow amount
        const currency = trade.cryptoCurrency;
        const expectedMint = TOKEN_MINTS[currency];
        const decimals = TOKEN_DECIMALS[currency] || 9;
        const expectedAmount = Number(trade.cryptoAmount) / AMOUNT_SCALE;
        const expectedRaw = Math.round(expectedAmount * 10 ** decimals);

        // Check parsed inner instructions for SPL token transfers
        const innerInstructions = parsedTx.meta?.innerInstructions ?? [];
        const allInstructions = [
          ...parsedTx.transaction.message.instructions,
          ...innerInstructions.flatMap((ix: any) => ix.instructions),
        ];

        let transferFound = false;
        for (const ix of allInstructions) {
          const parsed = (ix as any).parsed;
          if (!parsed) continue;
          if ((parsed.type === 'transfer' || parsed.type === 'transferChecked') && parsed.info) {
            const transferAmount = Number(
              parsed.info.amount || parsed.info.tokenAmount?.amount || 0
            );
            // Allow 1% tolerance for rounding
            if (Math.abs(transferAmount - expectedRaw) / expectedRaw < 0.01) {
              transferFound = true;
              break;
            }
          }
        }

        if (!transferFound) {
          throw new BadRequestException(
            'On-chain transfer amount does not match expected escrow amount'
          );
        }

        await tx.p2PTrade.update({
          where: { id: tradeId },
          data: { status: 'ESCROW_LOCKED', escrowTx: signature },
        });

        // Log the escrow lock (non-blocking, outside critical path)
        this.txLogger
          .log({
            walletAddress: trade.sellerAddress,
            type: 'P2P_ESCROW_LOCK',
            signature,
            amount: expectedAmount,
            token: currency,
          })
          .then(() => this.txLogger.confirm(signature))
          .catch((e) => this.logger.error('Failed to log escrow lock:', e));

        return { success: true, tradeId, signature };
      },
      { maxWait: 5000, timeout: 30000 }
    );
  }

  /**
   * Release escrow: server signs transfer from treasury → buyer.
   * Called when seller confirms payment received.
   */
  async releaseEscrow(tradeId: string): Promise<string> {
    return this.prisma.$transaction(
      async (tx) => {
        // Lock the trade row to prevent concurrent release/refund
        const [trade] = await tx.$queryRaw<any[]>`
        SELECT t.*, o."cryptoCurrency",
               b."walletAddress" as "buyerAddress",
               s."walletAddress" as "sellerAddress"
        FROM "P2PTrade" t
        JOIN "P2POffer" o ON t."offerId" = o."id"
        JOIN "User" b ON t."buyerId" = b."id"
        JOIN "User" s ON t."sellerId" = s."id"
        WHERE t."id" = ${tradeId}
        FOR UPDATE
      `;
        if (!trade) throw new NotFoundException('Trade not found');

        // Idempotent: if already released, return existing signature
        if (trade.releaseTx) {
          return trade.releaseTx;
        }

        // Must be in ESCROW_LOCKED or PAID status to release
        if (trade.status !== 'ESCROW_LOCKED' && trade.status !== 'PAID') {
          throw new BadRequestException(
            `Cannot release escrow: trade is in ${trade.status} status`
          );
        }

        if (!this.escrowKeypair) {
          throw new BadRequestException('Escrow wallet not configured. Contact support.');
        }

        // Mark as processing
        await tx.p2PTrade.update({
          where: { id: tradeId },
          data: { processingAt: new Date() },
        });

        const currency = trade.cryptoCurrency;
        const mintPubkey = new PublicKey(TOKEN_MINTS[currency]);
        const decimals = TOKEN_DECIMALS[currency] || 9;
        const rawAmount = BigInt(
          Math.round((Number(trade.cryptoAmount) / AMOUNT_SCALE) * 10 ** decimals)
        );

        const buyerPubkey = new PublicKey(trade.buyerAddress);
        const connection = this.solana.getConnection();

        const escrowAta = await getAssociatedTokenAddress(mintPubkey, this.escrowKeypair.publicKey);
        const buyerAta = await getAssociatedTokenAddress(mintPubkey, buyerPubkey);

        const solanaTx = new Transaction().add(
          createTransferInstruction(escrowAta, buyerAta, this.escrowKeypair.publicKey, rawAmount)
        );

        const sig = await sendAndConfirmTransaction(connection, solanaTx, [this.escrowKeypair]);

        await tx.p2PTrade.update({
          where: { id: tradeId },
          data: {
            releaseTx: sig,
            status: 'COMPLETED',
            completedAt: new Date(),
            processingAt: null,
          },
        });

        // Log the release (outside the lock is fine — non-critical)
        this.txLogger
          .log({
            walletAddress: trade.buyerAddress,
            type: 'P2P_ESCROW_RELEASE',
            signature: sig,
            amount: Number(trade.cryptoAmount) / AMOUNT_SCALE,
            token: currency,
          })
          .then(() => this.txLogger.confirm(sig))
          .catch((e) => this.logger.error('Failed to log release:', e));

        // Update reputations (non-blocking)
        this.updateReputation(trade.buyerAddress, true).catch((e) =>
          this.logger.error('Reputation update failed:', e)
        );
        this.updateReputation(trade.sellerAddress, true).catch((e) =>
          this.logger.error('Reputation update failed:', e)
        );

        return sig;
      },
      { maxWait: 10000, timeout: 60000 }
    );
  }

  /**
   * Refund escrow: server signs transfer from treasury → seller.
   * Called when trade is cancelled after escrow lock.
   */
  async refundEscrow(tradeId: string): Promise<string> {
    return this.prisma.$transaction(
      async (tx) => {
        // Lock the trade row to prevent concurrent release/refund
        const [trade] = await tx.$queryRaw<any[]>`
        SELECT t.*, o."cryptoCurrency",
               s."walletAddress" as "sellerAddress"
        FROM "P2PTrade" t
        JOIN "P2POffer" o ON t."offerId" = o."id"
        JOIN "User" s ON t."sellerId" = s."id"
        WHERE t."id" = ${tradeId}
        FOR UPDATE
      `;
        if (!trade) throw new NotFoundException('Trade not found');

        // Idempotent: if already has a releaseTx and is REFUNDED, return it
        if (trade.releaseTx && trade.status === 'REFUNDED') {
          return trade.releaseTx;
        }

        // Must be in ESCROW_LOCKED or DISPUTED to refund
        if (trade.status !== 'ESCROW_LOCKED' && trade.status !== 'DISPUTED') {
          throw new BadRequestException(`Cannot refund escrow: trade is in ${trade.status} status`);
        }

        if (!this.escrowKeypair) {
          throw new BadRequestException('Escrow wallet not configured. Contact support.');
        }

        // Mark as processing
        await tx.p2PTrade.update({
          where: { id: tradeId },
          data: { processingAt: new Date() },
        });

        const currency = trade.cryptoCurrency;
        const mintPubkey = new PublicKey(TOKEN_MINTS[currency]);
        const decimals = TOKEN_DECIMALS[currency] || 9;
        const rawAmount = BigInt(
          Math.round((Number(trade.cryptoAmount) / AMOUNT_SCALE) * 10 ** decimals)
        );

        const sellerPubkey = new PublicKey(trade.sellerAddress);
        const connection = this.solana.getConnection();

        const escrowAta = await getAssociatedTokenAddress(mintPubkey, this.escrowKeypair.publicKey);
        const sellerAta = await getAssociatedTokenAddress(mintPubkey, sellerPubkey);

        const solanaTx = new Transaction().add(
          createTransferInstruction(escrowAta, sellerAta, this.escrowKeypair.publicKey, rawAmount)
        );

        const sig = await sendAndConfirmTransaction(connection, solanaTx, [this.escrowKeypair]);

        await tx.p2PTrade.update({
          where: { id: tradeId },
          data: { releaseTx: sig, status: 'REFUNDED', processingAt: null },
        });

        // Log the refund (non-blocking)
        this.txLogger
          .log({
            walletAddress: trade.sellerAddress,
            type: 'P2P_ESCROW_REFUND',
            signature: sig,
            amount: Number(trade.cryptoAmount) / AMOUNT_SCALE,
            token: currency,
          })
          .then(() => this.txLogger.confirm(sig))
          .catch((e) => this.logger.error('Failed to log refund:', e));

        return sig;
      },
      { maxWait: 10000, timeout: 60000 }
    );
  }

  /**
   * Resolve a dispute: release to buyer OR refund to seller.
   * Called by admin/moderator after reviewing dispute evidence.
   */
  async resolveDispute(
    tradeId: string,
    resolution: 'RELEASE_TO_BUYER' | 'REFUND_TO_SELLER',
    adminAddress: string,
    resolutionNotes: string
  ) {
    const trade = await this.prisma.p2PTrade.findUnique({
      where: { id: tradeId },
      include: { offer: true, buyer: true, seller: true },
    });

    if (!trade) {
      throw new NotFoundException('Trade not found');
    }

    if (trade.status !== 'DISPUTED') {
      throw new BadRequestException('Trade is not in disputed status');
    }

    let signature: string;
    let finalStatus: P2PTradeStatus;
    let winnerAddress: string;
    let loserAddress: string;

    if (resolution === 'RELEASE_TO_BUYER') {
      // Buyer wins - release escrow to buyer
      signature = await this.releaseEscrow(tradeId);
      finalStatus = 'COMPLETED';
      winnerAddress = trade.buyer.walletAddress;
      loserAddress = trade.seller.walletAddress;
    } else {
      // Seller wins - refund escrow to seller
      signature = await this.refundEscrow(tradeId);
      finalStatus = 'REFUNDED';
      winnerAddress = trade.seller.walletAddress;
      loserAddress = trade.buyer.walletAddress;
    }

    // Update trade with resolution details
    await this.prisma.p2PTrade.update({
      where: { id: tradeId },
      data: {
        status: finalStatus,
        disputeResolution: resolutionNotes,
        completedAt: new Date(),
      },
    });

    // Update reputations - winner gets positive, loser gets negative
    await this.updateReputation(winnerAddress, true);
    await this.updateReputation(loserAddress, false);

    this.logger.log(
      `Dispute resolved for trade ${tradeId}: ${resolution} by ${adminAddress}. Signature: ${signature}`
    );

    return {
      tradeId,
      resolution,
      signature,
      status: finalStatus,
      resolutionNotes,
    };
  }

  // ============ FORMAT HELPERS ============
  // Convert Prisma BigInt fields → plain numbers for JSON serialization

  private formatOffer(offer: any) {
    return {
      id: offer.id,
      sellerAddress: offer.seller?.walletAddress ?? offer.sellerId,
      type: offer.type,
      cryptoAmount: toNumber(offer.cryptoAmount),
      cryptoCurrency: offer.cryptoCurrency,
      paymentMethod: offer.paymentMethod,
      rate: offer.rate,
      minAmount: toNumber(offer.minAmount),
      maxAmount: toNumber(offer.maxAmount),
      paymentInstructions: offer.paymentInstructions,
      status: offer.status,
      createdAt: offer.createdAt,
      availableAmount: toNumber(offer.availableAmount),
    };
  }

  private formatTrade(trade: any) {
    return {
      id: trade.id,
      offerId: trade.offerId,
      buyerAddress: trade.buyer?.walletAddress ?? trade.buyerId,
      sellerAddress: trade.seller?.walletAddress ?? trade.sellerId,
      amount: toNumber(trade.amount),
      cryptoAmount: toNumber(trade.cryptoAmount),
      cryptoCurrency: trade.offer?.cryptoCurrency ?? '',
      paymentMethod: trade.offer?.paymentMethod ?? '',
      status: trade.status,
      escrowTx: trade.escrowTx,
      createdAt: trade.createdAt,
      paidAt: trade.paidAt,
      completedAt: trade.completedAt,
    };
  }
}
