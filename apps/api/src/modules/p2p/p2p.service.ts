import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../common/prisma.service';
import { TransactionLoggerService } from '../../common/transaction-logger.service';
import { SolanaService } from '../wallet/solana.service';
import { CreateOfferDto, AcceptOfferDto, UpdateTradeStatusDto } from './dto/create-offer.dto';
import { P2POfferType, PaymentMethod, P2POfferStatus, P2PTradeStatus } from '@prisma/client';
import { Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction } from '@solana/spl-token';

// On-chain escrow constants
const ESCROW_PROGRAM_ID = '6GXdYCDckUVEFBaQSgfQGX95gZSNN7FWN19vRDSyTJ5E';
const DEFAULT_ESCROW_TIMEOUT = 7200; // 2 hours

// Anchor instruction discriminators (first 8 bytes of SHA-256("global:<method_name>"))
const RELEASE_DISCRIMINATOR = Buffer.from([146, 253, 129, 233, 20, 145, 181, 206]);
const REFUND_DISCRIMINATOR = Buffer.from([107, 186, 89, 99, 26, 194, 23, 204]);

type EscrowMode = 'onchain' | 'legacy';

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
// Raw query result types for SELECT ... FOR UPDATE queries
interface RawOfferRow {
  id: string;
  sellerId: string;
  sellerAddress: string;
  type: string;
  cryptoAmount: bigint;
  availableAmount: bigint;
  cryptoCurrency: string;
  paymentMethod: string;
  rate: number;
  minAmount: bigint;
  maxAmount: bigint;
  status: string;
}

interface RawTradeRow {
  id: string;
  offerId: string;
  buyerId: string;
  sellerId: string;
  buyerAddress: string;
  sellerAddress: string;
  cryptoCurrency: string;
  cryptoAmount: bigint;
  amount: bigint;
  status: string;
  escrowTx: string | null;
  releaseTx: string | null;
  processingAt: Date | null;
  paidAt: Date | null;
  completedAt: Date | null;
  offerCryptoAmount?: bigint;
  disputeReason?: string | null;
}

@Injectable()
export class P2PService {
  private readonly logger = new Logger(P2PService.name);
  private escrowKeypair: Keypair | null = null;
  private readonly escrowMode: EscrowMode;
  private readonly escrowAdminPubkey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly txLogger: TransactionLoggerService,
    private readonly solana: SolanaService,
    private readonly config: ConfigService,
    private readonly eventEmitter: EventEmitter2
  ) {
    // Determine escrow mode (defaults to legacy if ESCROW_MODE not set)
    this.escrowMode = (this.config.get<string>('ESCROW_MODE') || 'legacy') as EscrowMode;
    this.escrowAdminPubkey = this.config.get<string>(
      'ESCROW_ADMIN_PUBKEY',
      'H9j1W4u5LEiw8AZdui6c8AmN6t4tKkPQCAULPW8eMiTE'
    );
    this.logger.log(`Escrow mode: ${this.escrowMode}`);

    if (this.escrowMode === 'legacy') {
      // Load escrow wallet keypair for legacy mode
      const keypairStr = this.config.get<string>('ESCROW_WALLET_KEYPAIR');
      if (keypairStr) {
        try {
          const decoded = Buffer.from(keypairStr, 'base64');
          this.escrowKeypair = Keypair.fromSecretKey(
            new Uint8Array(JSON.parse(decoded.toString()))
          );
          this.logger.log('Escrow wallet keypair loaded (legacy mode)');
        } catch (e) {
          throw new Error(`ESCROW_WALLET_KEYPAIR is set but invalid: ${(e as Error).message}`);
        }
      } else {
        this.logger.warn(
          'ESCROW_WALLET_KEYPAIR not set — legacy escrow release/refund unavailable'
        );
      }
    } else {
      this.logger.log(`On-chain escrow program: ${ESCROW_PROGRAM_ID}`);
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
        const [offer] = await tx.$queryRaw<RawOfferRow[]>`
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
        if (offer.sellerAddress === dto.buyerAddress) {
          throw new BadRequestException('Cannot accept your own offer');
        }

        const minAmount = Number(offer.minAmount) / AMOUNT_SCALE;
        const maxAmount = Number(offer.maxAmount) / AMOUNT_SCALE;

        if (dto.amount < minAmount || dto.amount > maxAmount) {
          throw new BadRequestException(`Amount must be between ${minAmount} and ${maxAmount}`);
        }

        const cryptoAmount = dto.amount * offer.rate;
        if (
          !Number.isFinite(cryptoAmount) ||
          cryptoAmount > Number.MAX_SAFE_INTEGER / AMOUNT_SCALE
        ) {
          throw new BadRequestException('Calculated amount exceeds safe limits');
        }
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

  async getTrade(id: string, walletAddress?: string) {
    const trade = await this.prisma.p2PTrade.findUnique({
      where: { id },
      include: { buyer: true, seller: true, offer: true },
    });
    if (!trade) throw new NotFoundException('Trade not found');
    if (
      walletAddress &&
      trade.buyer.walletAddress !== walletAddress &&
      trade.seller.walletAddress !== walletAddress
    ) {
      throw new ForbiddenException('Access denied');
    }
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
    const [trade] = await this.prisma.$queryRaw<RawTradeRow[]>`
      SELECT t.*, b."walletAddress" as "buyerAddress", s."walletAddress" as "sellerAddress"
      FROM "P2PTrade" t
      JOIN "User" b ON t."buyerId" = b."id"
      JOIN "User" s ON t."sellerId" = s."id"
      WHERE t."id" = ${tradeId}
      FOR UPDATE
    `;
    if (!trade) throw new NotFoundException('Trade not found');

    // All status transitions require the caller to be a trade participant
    if (trade.buyerAddress !== walletAddress && trade.sellerAddress !== walletAddress) {
      throw new ForbiddenException('Only trade participants can update trade status');
    }

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

    // Escrow operations differ by mode:
    // On-chain: client signs release/refund ix, then calls confirmOnChainAction
    // Legacy: server signs the transfer from treasury wallet
    if (dto.status === 'CONFIRMED' && trade.escrowTx) {
      if (this.escrowMode === 'onchain') {
        // On-chain mode: client must call confirm-release endpoint separately
        // Just update status to allow the release
        throw new BadRequestException(
          'On-chain escrow: use POST /p2p/trades/:id/confirm-release with the release tx signature'
        );
      }
      await this.releaseEscrow(tradeId);
      const updated = await this.prisma.p2PTrade.findUnique({
        where: { id: tradeId },
        include: { buyer: true, seller: true, offer: true },
      });
      return this.formatTrade(updated!);
    }

    if (dto.status === 'CANCELLED' && trade.escrowTx && trade.status === 'ESCROW_LOCKED') {
      if (this.escrowMode === 'onchain') {
        throw new BadRequestException(
          'On-chain escrow: use POST /p2p/trades/:id/confirm-refund with the refund tx signature'
        );
      }
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

    // Restore offer availability when a trade is cancelled
    if (requestedStatus === 'CANCELLED' && updated.offer) {
      const restoredAmount =
        Number(updated.offer.availableAmount) / AMOUNT_SCALE +
        Number(updated.cryptoAmount) / AMOUNT_SCALE;
      await this.prisma.p2POffer.update({
        where: { id: updated.offerId },
        data: {
          availableAmount: toBigInt(restoredAmount),
          status: 'ACTIVE',
        },
      });
    }

    // No escrow, just update reputations on completion
    if (dto.status === 'CONFIRMED') {
      await this.updateReputation(trade.buyerAddress, true);
      await this.updateReputation(trade.sellerAddress, true);
    }

    // Push notification events
    if (dto.status === 'PAID') {
      this.eventEmitter.emit('p2p.payment.marked', {
        tradeId,
        buyerWallet: trade.buyerAddress,
        sellerWallet: trade.sellerAddress,
      });
    } else if (dto.status === 'DISPUTED') {
      this.eventEmitter.emit('p2p.trade.disputed', {
        tradeId,
        buyerWallet: trade.buyerAddress,
        sellerWallet: trade.sellerAddress,
        reason: dto.notes,
      });
    } else if (dto.status === 'CANCELLED') {
      this.eventEmitter.emit('p2p.trade.cancelled', {
        tradeId,
        buyerWallet: trade.buyerAddress,
        sellerWallet: trade.sellerAddress,
      });
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
   * Returns escrow info for the client to build the lock transaction.
   * Legacy mode: returns treasury wallet address for SPL transfer.
   * On-chain mode: returns program ID, admin, buyer, mint info for initialize_escrow ix.
   */
  async lockEscrow(tradeId: string) {
    const trade = await this.prisma.p2PTrade.findUnique({
      where: { id: tradeId },
      include: { offer: true, seller: true, buyer: true },
    });
    if (!trade) throw new NotFoundException('Trade not found');
    if (trade.status !== 'PENDING') {
      throw new BadRequestException('Trade is not in PENDING status');
    }

    const currency = trade.offer.cryptoCurrency;
    const mintAddress = TOKEN_MINTS[currency];
    const decimals = TOKEN_DECIMALS[currency] || 9;
    const amount = toNumber(trade.cryptoAmount);

    if (this.escrowMode === 'onchain') {
      return {
        mode: 'onchain' as const,
        programId: ESCROW_PROGRAM_ID,
        adminPubkey: this.escrowAdminPubkey,
        buyerAddress: trade.buyer.walletAddress,
        sellerAddress: trade.seller.walletAddress,
        mintAddress,
        amount,
        decimals,
        timeoutSeconds: DEFAULT_ESCROW_TIMEOUT,
        tradeId,
      };
    }

    // Legacy mode
    const escrowWallet = this.config.get(
      'TREASURY_WALLET',
      'H9j1W4u5LEiw8AZdui6c8AmN6t4tKkPQCAULPW8eMiTE'
    );

    return {
      mode: 'legacy' as const,
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
   * On-chain mode: verifies the escrow PDA account exists and has correct state.
   * Legacy mode: verifies SPL transfer to treasury wallet.
   */
  async confirmEscrowLock(tradeId: string, signature: string) {
    return this.prisma.$transaction(
      async (tx) => {
        // Lock the trade row to prevent concurrent confirmations
        const [trade] = await tx.$queryRaw<RawTradeRow[]>`
          SELECT t.*, o."cryptoCurrency", o."cryptoAmount" as "offerCryptoAmount",
                 s."walletAddress" as "sellerAddress",
                 b."walletAddress" as "buyerAddress"
          FROM "P2PTrade" t
          JOIN "P2POffer" o ON t."offerId" = o."id"
          JOIN "User" s ON t."sellerId" = s."id"
          JOIN "User" b ON t."buyerId" = b."id"
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
          .filter((k: { signer: boolean }) => k.signer)
          .map((k: { pubkey: { toBase58(): string } }) => k.pubkey.toBase58());

        if (!signers.includes(trade.sellerAddress)) {
          throw new BadRequestException('Transaction was not signed by the seller');
        }

        if (this.escrowMode === 'onchain') {
          // On-chain mode: verify the escrow program was invoked in this tx
          const programInvoked = parsedTx.transaction.message.accountKeys.some(
            (k: { pubkey: { toBase58(): string } }) => k.pubkey.toBase58() === ESCROW_PROGRAM_ID
          );
          if (!programInvoked) {
            throw new BadRequestException('Transaction did not invoke the escrow program');
          }

          // Also verify SPL transfer amount in on-chain mode (defense in depth)
          const currency = trade.cryptoCurrency;
          const decimals = TOKEN_DECIMALS[currency] || 9;
          const expectedAmount = Number(trade.cryptoAmount) / AMOUNT_SCALE;
          const expectedRaw = Math.round(expectedAmount * 10 ** decimals);

          const innerIxs = parsedTx.meta?.innerInstructions ?? [];
          const allIxs = [
            ...parsedTx.transaction.message.instructions,
            ...innerIxs.flatMap((ix: { instructions: unknown[] }) => ix.instructions),
          ];

          let onchainTransferFound = false;
          for (const ix of allIxs) {
            const parsed = (ix as Record<string, unknown>).parsed as
              | Record<string, unknown>
              | undefined;
            if (!parsed) continue;
            if ((parsed.type === 'transfer' || parsed.type === 'transferChecked') && parsed.info) {
              const info = parsed.info as Record<string, unknown>;
              const tokenAmount = info.tokenAmount as Record<string, unknown> | undefined;
              const transferAmount = Number(info.amount || tokenAmount?.amount || 0);
              if (Math.abs(transferAmount - expectedRaw) / expectedRaw < 0.01) {
                onchainTransferFound = true;
                break;
              }
            }
          }

          if (!onchainTransferFound) {
            throw new BadRequestException(
              'On-chain escrow transfer amount does not match expected trade amount'
            );
          }
        } else {
          // Legacy mode: verify SPL transfer amount
          const currency = trade.cryptoCurrency;
          const decimals = TOKEN_DECIMALS[currency] || 9;
          const expectedAmount = Number(trade.cryptoAmount) / AMOUNT_SCALE;
          const expectedRaw = Math.round(expectedAmount * 10 ** decimals);

          const innerInstructions = parsedTx.meta?.innerInstructions ?? [];
          const allInstructions = [
            ...parsedTx.transaction.message.instructions,
            ...innerInstructions.flatMap((ix: { instructions: unknown[] }) => ix.instructions),
          ];

          let transferFound = false;
          for (const ix of allInstructions) {
            const parsed = (ix as Record<string, unknown>).parsed as
              | Record<string, unknown>
              | undefined;
            if (!parsed) continue;
            if ((parsed.type === 'transfer' || parsed.type === 'transferChecked') && parsed.info) {
              const info = parsed.info as Record<string, unknown>;
              const tokenAmount = info.tokenAmount as Record<string, unknown> | undefined;
              const transferAmount = Number(info.amount || tokenAmount?.amount || 0);
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
        }

        const currency = trade.cryptoCurrency;
        const expectedAmount = Number(trade.cryptoAmount) / AMOUNT_SCALE;

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

        this.eventEmitter.emit('p2p.escrow.locked', {
          tradeId,
          buyerWallet: trade.buyerAddress,
          sellerWallet: trade.sellerAddress,
          amount: expectedAmount,
          token: currency,
        });

        return { success: true, tradeId, signature };
      },
      { maxWait: 5000, timeout: 30000 }
    );
  }

  /**
   * Confirm on-chain release/refund — client already signed the program instruction,
   * server just verifies the on-chain tx and updates DB state.
   */
  async confirmOnChainAction(
    tradeId: string,
    signature: string,
    expectedStatus: 'COMPLETED' | 'REFUNDED'
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const [trade] = await tx.$queryRaw<RawTradeRow[]>`
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

        // Idempotent
        if (trade.releaseTx === signature) {
          return { success: true, tradeId, signature };
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

        // Verify escrow program was invoked
        const programInvoked = parsedTx.transaction.message.accountKeys.some(
          (k: { pubkey: { toBase58(): string } }) => k.pubkey.toBase58() === ESCROW_PROGRAM_ID
        );
        if (!programInvoked) {
          throw new BadRequestException('Transaction did not invoke the escrow program');
        }

        // Verify the correct instruction was called (release vs refund)
        const expectedDiscriminator =
          expectedStatus === 'COMPLETED' ? RELEASE_DISCRIMINATOR : REFUND_DISCRIMINATOR;
        let correctInstructionFound = false;

        for (const ix of parsedTx.transaction.message.instructions) {
          const programIdIndex = (ix as Record<string, unknown>).programIdIndex as
            | number
            | undefined;
          if (programIdIndex !== undefined) {
            const programKey = parsedTx.transaction.message.accountKeys[programIdIndex];
            if (programKey?.pubkey?.toBase58() === ESCROW_PROGRAM_ID) {
              const data = (ix as Record<string, unknown>).data as string | undefined;
              if (data) {
                const decoded = Buffer.from(data, 'base64');
                if (decoded.length >= 8 && decoded.subarray(0, 8).equals(expectedDiscriminator)) {
                  correctInstructionFound = true;
                  break;
                }
              }
            }
          }
        }

        if (!correctInstructionFound) {
          const expectedName = expectedStatus === 'COMPLETED' ? 'release_escrow' : 'refund_escrow';
          throw new BadRequestException(
            `Transaction does not contain the expected ${expectedName} instruction`
          );
        }

        await tx.p2PTrade.update({
          where: { id: tradeId },
          data: {
            releaseTx: signature,
            status: expectedStatus,
            completedAt: new Date(),
          },
        });

        const logType = expectedStatus === 'COMPLETED' ? 'P2P_ESCROW_RELEASE' : 'P2P_ESCROW_REFUND';
        this.txLogger
          .log({
            walletAddress:
              expectedStatus === 'COMPLETED' ? trade.buyerAddress : trade.sellerAddress,
            type: logType,
            signature,
            amount: Number(trade.cryptoAmount) / AMOUNT_SCALE,
            token: trade.cryptoCurrency,
          })
          .then(() => this.txLogger.confirm(signature))
          .catch((e) => this.logger.error(`Failed to log ${logType}:`, e));

        if (expectedStatus === 'COMPLETED') {
          this.updateReputation(trade.buyerAddress, true).catch(() => {});
          this.updateReputation(trade.sellerAddress, true).catch(() => {});
          this.eventEmitter.emit('p2p.funds.released', {
            tradeId,
            buyerWallet: trade.buyerAddress,
            sellerWallet: trade.sellerAddress,
            amount: Number(trade.cryptoAmount) / AMOUNT_SCALE,
            token: trade.cryptoCurrency,
          });
        }

        return { success: true, tradeId, signature };
      },
      { maxWait: 10000, timeout: 30000 }
    );
  }

  /**
   * Release escrow: server signs transfer from treasury → buyer.
   * Called when seller confirms payment received (legacy mode only).
   */
  async releaseEscrow(tradeId: string): Promise<string> {
    return this.prisma.$transaction(
      async (tx) => {
        // Lock the trade row to prevent concurrent release/refund
        const [trade] = await tx.$queryRaw<RawTradeRow[]>`
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

        this.eventEmitter.emit('p2p.funds.released', {
          tradeId,
          buyerWallet: trade.buyerAddress,
          sellerWallet: trade.sellerAddress,
          amount: Number(trade.cryptoAmount) / AMOUNT_SCALE,
          token: currency,
        });

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
        const [trade] = await tx.$queryRaw<RawTradeRow[]>`
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
    // Lock the trade row FIRST to prevent concurrent dispute resolution
    const [trade] = await this.prisma.$queryRaw<
      Array<{
        id: string;
        status: string;
        buyerAddress: string;
        sellerAddress: string;
        escrowTx: string | null;
        cryptoAmount: bigint;
        cryptoCurrency: string;
      }>
    >`
      SELECT t.*, b."walletAddress" as "buyerAddress", s."walletAddress" as "sellerAddress"
      FROM "P2PTrade" t
      JOIN "User" b ON t."buyerId" = b."id"
      JOIN "User" s ON t."sellerId" = s."id"
      WHERE t."id" = ${tradeId}
      FOR UPDATE
    `;

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
      signature = await this.releaseEscrow(tradeId);
      finalStatus = 'COMPLETED';
      winnerAddress = trade.buyerAddress;
      loserAddress = trade.sellerAddress;
    } else {
      signature = await this.refundEscrow(tradeId);
      finalStatus = 'REFUNDED';
      winnerAddress = trade.sellerAddress;
      loserAddress = trade.buyerAddress;
    }

    // Atomically update only if still DISPUTED — prevents concurrent resolution
    const claimed = await this.prisma.p2PTrade.updateMany({
      where: { id: tradeId, status: 'DISPUTED' },
      data: {
        status: finalStatus,
        disputeResolution: resolutionNotes,
        completedAt: new Date(),
      },
    });

    if (claimed.count === 0) {
      throw new BadRequestException('Trade was already resolved by another admin');
    }

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

  private formatOffer(offer: {
    id: string;
    seller?: { walletAddress: string };
    sellerId: string;
    type: string;
    cryptoAmount: bigint;
    cryptoCurrency: string;
    paymentMethod: string;
    rate: number;
    minAmount: bigint;
    maxAmount: bigint;
    paymentInstructions: string | null;
    status: string;
    createdAt: Date;
    availableAmount: bigint;
  }) {
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

  private formatTrade(trade: {
    id: string;
    offerId: string;
    buyer?: { walletAddress: string };
    buyerId: string;
    seller?: { walletAddress: string };
    sellerId: string;
    amount: bigint;
    cryptoAmount: bigint;
    offer?: { cryptoCurrency: string; paymentMethod: string };
    status: string;
    escrowTx: string | null;
    createdAt: Date;
    paidAt: Date | null;
    completedAt: Date | null;
  }) {
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
