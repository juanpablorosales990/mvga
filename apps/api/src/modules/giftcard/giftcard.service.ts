import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma.service';
import { SolanaService } from '../wallet/solana.service';
import { BitrefillAdapter } from './bitrefill.adapter';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';

@Injectable()
export class GiftCardService {
  private readonly logger = new Logger(GiftCardService.name);
  private readonly USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
  private readonly USDC_DECIMALS = 6;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly solana: SolanaService,
    private readonly adapter: BitrefillAdapter
  ) {}

  get isEnabled(): boolean {
    const treasuryWallet = this.config.get('TREASURY_WALLET');
    return Boolean(treasuryWallet);
  }

  getStatus() {
    const treasuryWallet = this.config.get<string>('TREASURY_WALLET');
    return {
      enabled: this.isEnabled,
      usdcMint: this.USDC_MINT.toBase58(),
      treasuryWallet: this.isEnabled ? treasuryWallet : undefined,
      categories: ['shopping', 'entertainment', 'gaming', 'food'],
    };
  }

  async getProducts(category?: string) {
    return this.adapter.getProducts(category);
  }

  private amountToRaw(amount: number): bigint {
    const factor = 10 ** this.USDC_DECIMALS;
    return BigInt(Math.round(amount * factor));
  }

  private async verifyTreasuryPayment(params: {
    signature: string;
    fromWallet: string;
    toTreasuryWallet: string;
    minAmountUsd: number;
  }) {
    const { signature, fromWallet, toTreasuryWallet, minAmountUsd } = params;

    const fromOwner = new PublicKey(fromWallet);
    const toOwner = new PublicKey(toTreasuryWallet);
    const expectedSource = await getAssociatedTokenAddress(this.USDC_MINT, fromOwner);
    const expectedDest = await getAssociatedTokenAddress(this.USDC_MINT, toOwner);
    const minRaw = this.amountToRaw(minAmountUsd);

    const conn = this.solana.getConnection();
    const tx = await conn.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });
    if (!tx) {
      throw new BadRequestException('Payment transaction not found');
    }
    if (tx.meta?.err) {
      throw new BadRequestException('Payment transaction failed');
    }

    const instructions = tx.transaction.message.instructions as Array<any>;
    let paidRaw = 0n;

    for (const ix of instructions) {
      if (ix?.program !== 'spl-token') continue;
      const parsed = ix?.parsed;
      const info = parsed?.info;
      if (!info) continue;

      const source = String(info.source || '');
      const destination = String(info.destination || '');
      const authority = info.authority ? String(info.authority) : '';
      const mint = info.mint ? String(info.mint) : '';

      if (source !== expectedSource.toBase58()) continue;
      if (destination !== expectedDest.toBase58()) continue;
      if (authority && authority !== fromOwner.toBase58()) continue;
      if (mint && mint !== this.USDC_MINT.toBase58()) continue;

      const rawStr =
        typeof info.amount === 'string'
          ? info.amount
          : typeof info?.tokenAmount?.amount === 'string'
            ? info.tokenAmount.amount
            : null;
      if (!rawStr) continue;

      try {
        paidRaw += BigInt(rawStr);
      } catch {
        // ignore malformed
      }
    }

    if (paidRaw < minRaw) {
      throw new BadRequestException('Insufficient payment amount');
    }

    return { paidRaw };
  }

  async purchase(
    walletAddress: string,
    productId: string,
    amountUsd: number,
    paymentSignature: string
  ) {
    if (!this.isEnabled) {
      throw new BadRequestException('Gift cards are not available');
    }

    const treasuryWallet = this.config.get<string>('TREASURY_WALLET');
    if (!treasuryWallet) {
      throw new BadRequestException('Treasury wallet not configured');
    }

    // Idempotency check
    const customIdentifier = `mvga-gc-${paymentSignature}`;
    const existing = await this.prisma.giftCard.findFirst({
      where: { customIdentifier },
    });
    if (existing) {
      return {
        id: existing.id,
        status: existing.status,
        productName: existing.productName,
        amountUsd: existing.amountUsd,
        code: existing.code,
      };
    }

    // Verify on-chain payment
    await this.verifyTreasuryPayment({
      signature: paymentSignature,
      fromWallet: walletAddress,
      toTreasuryWallet: treasuryWallet,
      minAmountUsd: amountUsd,
    });

    // Look up product name from adapter
    const products = await this.adapter.getProducts();
    const product = products.find((p) => p.id === productId);
    const productName = product ? `${product.name} $${amountUsd}` : productId;
    const category = product?.category || null;

    // Create DB record
    const giftCard = await this.prisma.giftCard.create({
      data: {
        walletAddress,
        productId,
        productName,
        category,
        amountUsd,
        customIdentifier,
        paymentSignature,
      },
    });

    try {
      const result = await this.adapter.purchaseGiftCard(productId, amountUsd, customIdentifier);

      await this.prisma.giftCard.update({
        where: { id: giftCard.id },
        data: {
          status: result.status === 'SUCCESS' ? 'DELIVERED' : 'PENDING',
          bitrefillOrderId: result.orderId,
          code: result.code,
          pin: result.pin,
        },
      });

      this.logger.log(`Gift card purchased: ${productName} $${amountUsd} → ${result.status}`);

      return {
        id: giftCard.id,
        status: result.status === 'SUCCESS' ? 'DELIVERED' : 'PENDING',
        productName,
        amountUsd,
        code: result.code,
        pin: result.pin,
      };
    } catch (error) {
      await this.prisma.giftCard.update({
        where: { id: giftCard.id },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      throw error;
    }
  }

  async getOrder(walletAddress: string, orderId: string) {
    const order = await this.prisma.giftCard.findUnique({ where: { id: orderId } });
    if (!order || order.walletAddress !== walletAddress) {
      throw new BadRequestException('Order not found');
    }
    return order;
  }

  async getHistory(walletAddress: string) {
    return this.prisma.giftCard.findMany({
      where: { walletAddress },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }
}
