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
    const offer = await this.prisma.p2POffer.findUnique({
      where: { id: offerId },
      include: { seller: true },
    });
    if (!offer) throw new NotFoundException('Offer not found');
    if (offer.status !== 'ACTIVE') {
      throw new BadRequestException('Offer is not active');
    }

    const minAmount = toNumber(offer.minAmount);
    const maxAmount = toNumber(offer.maxAmount);

    if (dto.amount < minAmount || dto.amount > maxAmount) {
      throw new BadRequestException(`Amount must be between ${minAmount} and ${maxAmount}`);
    }

    const cryptoAmount = dto.amount * offer.rate;
    const availableAmount = toNumber(offer.availableAmount);
    if (cryptoAmount > availableAmount) {
      throw new BadRequestException('Not enough available in offer');
    }

    const buyer = await this.findOrCreateUser(dto.buyerAddress);

    // Atomic transaction: create trade + update offer availability
    const trade = await this.prisma.$transaction(async (tx) => {
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
    });

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

  async updateTradeStatus(tradeId: string, walletAddress: string, dto: UpdateTradeStatusDto) {
    const trade = await this.prisma.p2PTrade.findUnique({
      where: { id: tradeId },
      include: { buyer: true, seller: true, offer: true },
    });
    if (!trade) throw new NotFoundException('Trade not found');

    if (dto.status === 'PAID' && trade.buyer.walletAddress !== walletAddress) {
      throw new BadRequestException('Only buyer can mark as paid');
    }
    if (dto.status === 'CONFIRMED' && trade.seller.walletAddress !== walletAddress) {
      throw new BadRequestException('Only seller can confirm receipt');
    }

    const newStatus: P2PTradeStatus =
      dto.status === 'CONFIRMED' ? 'COMPLETED' : (dto.status as P2PTradeStatus);

    const updateData: Record<string, unknown> = { status: newStatus };
    if (dto.status === 'PAID') updateData.paidAt = new Date();
    if (dto.status === 'CONFIRMED') updateData.completedAt = new Date();
    if (dto.status === 'DISPUTED') updateData.disputeReason = dto.notes;

    const updated = await this.prisma.p2PTrade.update({
      where: { id: tradeId },
      data: updateData,
      include: { buyer: true, seller: true, offer: true },
    });

    // On trade completion, release escrow if it was locked
    if (dto.status === 'CONFIRMED' && trade.escrowTx) {
      try {
        await this.releaseEscrow(tradeId);
      } catch (e) {
        this.logger.error('Failed to release escrow:', e);
        // Escrow release failed, but trade status already updated
      }
    } else if (dto.status === 'CONFIRMED') {
      // No escrow, just update reputations
      await this.updateReputation(trade.buyer.walletAddress, true);
      await this.updateReputation(trade.seller.walletAddress, true);
    }

    // On cancellation after escrow lock, refund
    if (dto.status === 'CANCELLED' && trade.escrowTx && trade.status === 'ESCROW_LOCKED') {
      try {
        await this.refundEscrow(tradeId);
      } catch (e) {
        this.logger.error('Failed to refund escrow:', e);
      }
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
    const trade = await this.prisma.p2PTrade.findUnique({
      where: { id: tradeId },
      include: { offer: true, seller: true },
    });
    if (!trade) throw new NotFoundException('Trade not found');

    // Verify on-chain
    const connection = this.solana.getConnection();
    const tx = await connection.getParsedTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });

    if (!tx || tx.meta?.err) {
      throw new BadRequestException('Transaction not found or failed');
    }

    await this.prisma.p2PTrade.update({
      where: { id: tradeId },
      data: { status: 'ESCROW_LOCKED', escrowTx: signature },
    });

    // Log the escrow lock
    await this.txLogger.log({
      walletAddress: trade.seller.walletAddress,
      type: 'P2P_ESCROW_LOCK',
      signature,
      amount: toNumber(trade.cryptoAmount),
      token: trade.offer.cryptoCurrency,
    });
    await this.txLogger.confirm(signature);

    return { success: true, tradeId, signature };
  }

  /**
   * Release escrow: server signs transfer from treasury → buyer.
   * Called when seller confirms payment received.
   */
  async releaseEscrow(tradeId: string): Promise<string> {
    const trade = await this.prisma.p2PTrade.findUnique({
      where: { id: tradeId },
      include: { offer: true, buyer: true, seller: true },
    });
    if (!trade) throw new NotFoundException('Trade not found');

    if (!this.escrowKeypair) {
      throw new BadRequestException('Escrow wallet not configured. Contact support.');
    }

    const currency = trade.offer.cryptoCurrency;
    const mintPubkey = new PublicKey(TOKEN_MINTS[currency]);
    const decimals = TOKEN_DECIMALS[currency] || 9;
    const rawAmount = BigInt(Math.round(toNumber(trade.cryptoAmount) * 10 ** decimals));

    const buyerPubkey = new PublicKey(trade.buyer.walletAddress);
    const connection = this.solana.getConnection();

    const escrowAta = await getAssociatedTokenAddress(mintPubkey, this.escrowKeypair.publicKey);
    const buyerAta = await getAssociatedTokenAddress(mintPubkey, buyerPubkey);

    const tx = new Transaction().add(
      createTransferInstruction(escrowAta, buyerAta, this.escrowKeypair.publicKey, rawAmount)
    );

    const sig = await sendAndConfirmTransaction(connection, tx, [this.escrowKeypair]);

    await this.prisma.p2PTrade.update({
      where: { id: tradeId },
      data: { releaseTx: sig, status: 'COMPLETED', completedAt: new Date() },
    });

    // Log the release
    await this.txLogger.log({
      walletAddress: trade.buyer.walletAddress,
      type: 'P2P_ESCROW_RELEASE',
      signature: sig,
      amount: toNumber(trade.cryptoAmount),
      token: currency,
    });
    await this.txLogger.confirm(sig);

    // Update reputations
    await this.updateReputation(trade.buyer.walletAddress, true);
    await this.updateReputation(trade.seller.walletAddress, true);

    return sig;
  }

  /**
   * Refund escrow: server signs transfer from treasury → seller.
   * Called when trade is cancelled after escrow lock.
   */
  async refundEscrow(tradeId: string): Promise<string> {
    const trade = await this.prisma.p2PTrade.findUnique({
      where: { id: tradeId },
      include: { offer: true, seller: true },
    });
    if (!trade) throw new NotFoundException('Trade not found');

    if (!this.escrowKeypair) {
      throw new BadRequestException('Escrow wallet not configured. Contact support.');
    }

    const currency = trade.offer.cryptoCurrency;
    const mintPubkey = new PublicKey(TOKEN_MINTS[currency]);
    const decimals = TOKEN_DECIMALS[currency] || 9;
    const rawAmount = BigInt(Math.round(toNumber(trade.cryptoAmount) * 10 ** decimals));

    const sellerPubkey = new PublicKey(trade.seller.walletAddress);
    const connection = this.solana.getConnection();

    const escrowAta = await getAssociatedTokenAddress(mintPubkey, this.escrowKeypair.publicKey);
    const sellerAta = await getAssociatedTokenAddress(mintPubkey, sellerPubkey);

    const tx = new Transaction().add(
      createTransferInstruction(escrowAta, sellerAta, this.escrowKeypair.publicKey, rawAmount)
    );

    const sig = await sendAndConfirmTransaction(connection, tx, [this.escrowKeypair]);

    await this.prisma.p2PTrade.update({
      where: { id: tradeId },
      data: { releaseTx: sig, status: 'REFUNDED' },
    });

    // Log the refund
    await this.txLogger.log({
      walletAddress: trade.seller.walletAddress,
      type: 'P2P_ESCROW_REFUND',
      signature: sig,
      amount: toNumber(trade.cryptoAmount),
      token: currency,
    });
    await this.txLogger.confirm(sig);

    return sig;
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
