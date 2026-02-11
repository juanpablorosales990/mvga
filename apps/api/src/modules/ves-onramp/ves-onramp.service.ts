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
import { CreateVesOfferDto, CreateVesOrderDto, MarkPaidDto } from './ves-onramp.dto';
import { VesOfferStatus, VesOrderStatus, VesDirection } from '@prisma/client';
import { Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction } from '@solana/spl-token';

// Escrow constants (shared with P2P module)
const ESCROW_PROGRAM_ID = '6GXdYCDckUVEFBaQSgfQGX95gZSNN7FWN19vRDSyTJ5E';
const DEFAULT_ESCROW_TIMEOUT = 1800; // 30 min for VES orders
const RELEASE_DISCRIMINATOR = Buffer.from([146, 253, 129, 233, 20, 145, 181, 206]);
const REFUND_DISCRIMINATOR = Buffer.from([107, 186, 89, 99, 26, 194, 23, 204]);

type EscrowMode = 'onchain' | 'legacy';

// USDC has 6 decimal places
const USDC_DECIMALS = 6;
const USDC_SCALE = 1_000_000;
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

function toBigInt(n: number): bigint {
  return BigInt(Math.round(n * USDC_SCALE));
}

function toNumber(n: bigint): number {
  return Number(n) / USDC_SCALE;
}

// Raw query result types for SELECT ... FOR UPDATE queries
interface RawOfferRow {
  id: string;
  lpWalletAddress: string;
  lpUserId: string;
  availableUsdc: bigint;
  vesRate: number;
  feePercent: number;
  minOrderUsdc: bigint;
  maxOrderUsdc: bigint;
  status: string;
  direction: VesDirection;
}

interface RawOrderRow {
  id: string;
  offerId: string;
  buyerWalletAddress: string;
  buyerUserId: string;
  lpWalletAddress: string;
  amountUsdc: bigint;
  amountVes: number;
  vesRate: number;
  feePercent: number;
  status: string;
  escrowTx: string | null;
  releaseTx: string | null;
  expiresAt: Date;
  direction: VesDirection;
}

@Injectable()
export class VesOnrampService {
  private readonly logger = new Logger(VesOnrampService.name);
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
    this.escrowMode = (this.config.get<string>('ESCROW_MODE') || 'legacy') as EscrowMode;
    this.escrowAdminPubkey = this.config.get<string>(
      'ESCROW_ADMIN_PUBKEY',
      'C3KbfmtHrUiWunbsVhpeT1G6MqtyU8kK5mmVaByTUXF8'
    );

    if (this.escrowMode === 'legacy') {
      const keypairStr = this.config.get<string>('ESCROW_WALLET_KEYPAIR');
      if (keypairStr) {
        try {
          const decoded = Buffer.from(keypairStr, 'base64');
          this.escrowKeypair = Keypair.fromSecretKey(
            new Uint8Array(JSON.parse(decoded.toString()))
          );
        } catch (e) {
          throw new Error(`ESCROW_WALLET_KEYPAIR is set but invalid: ${(e as Error).message}`);
        }
      }
    }
  }

  // ============ DIRECTION HELPERS ============
  // ON_RAMP: LP locks USDC, buyer sends VES, LP receives VES, buyer gets USDC
  // OFF_RAMP: User/seller locks USDC, LP sends VES, user receives VES, LP gets USDC

  /** Who locks USDC into escrow */
  private getEscrowLocker(order: {
    direction: VesDirection;
    buyerWalletAddress: string;
    lpWalletAddress: string;
  }): string {
    return order.direction === 'OFF_RAMP' ? order.buyerWalletAddress : order.lpWalletAddress;
  }

  /** Who receives USDC when escrow is released */
  private getEscrowRecipient(order: {
    direction: VesDirection;
    buyerWalletAddress: string;
    lpWalletAddress: string;
  }): string {
    return order.direction === 'OFF_RAMP' ? order.lpWalletAddress : order.buyerWalletAddress;
  }

  /** Who sends VES via Pago Movil */
  private getVesSender(order: {
    direction: VesDirection;
    buyerWalletAddress: string;
    lpWalletAddress: string;
  }): string {
    return order.direction === 'OFF_RAMP' ? order.lpWalletAddress : order.buyerWalletAddress;
  }

  /** Who receives VES via Pago Movil */
  private getVesReceiver(order: {
    direction: VesDirection;
    buyerWalletAddress: string;
    lpWalletAddress: string;
  }): string {
    return order.direction === 'OFF_RAMP' ? order.buyerWalletAddress : order.lpWalletAddress;
  }

  // ============ OFFERS ============

  async createOffer(dto: CreateVesOfferDto, walletAddress: string) {
    if (dto.minOrderUsdc > dto.maxOrderUsdc) {
      throw new BadRequestException('Min order cannot be greater than max order');
    }
    if (dto.availableUsdc < dto.minOrderUsdc) {
      throw new BadRequestException('Available USDC must be at least the minimum order size');
    }

    const user = await this.prisma.user.findUnique({ where: { walletAddress } });
    if (!user) throw new NotFoundException('User not found');

    const direction: VesDirection = (dto.direction as VesDirection) || 'ON_RAMP';

    const offer = await this.prisma.vesOffer.create({
      data: {
        lpWalletAddress: walletAddress,
        lpUserId: user.id,
        availableUsdc: toBigInt(dto.availableUsdc),
        vesRate: dto.vesRate,
        feePercent: dto.feePercent,
        minOrderUsdc: toBigInt(dto.minOrderUsdc),
        maxOrderUsdc: toBigInt(dto.maxOrderUsdc),
        bankCode: dto.bankCode,
        bankName: dto.bankName,
        phoneNumber: dto.phoneNumber,
        ciNumber: dto.ciNumber,
        direction,
      },
      include: { lpUser: true },
    });

    return this.formatOffer(offer);
  }

  async getOffers(direction?: VesDirection) {
    const where: Record<string, unknown> = { status: 'ACTIVE' };
    if (direction) where.direction = direction;

    const offers = await this.prisma.vesOffer.findMany({
      where,
      include: {
        lpUser: { include: { reputation: true } },
      },
      // ON_RAMP: lowest rate first (best buy price)
      // OFF_RAMP: highest rate first (best sell price)
      orderBy: { vesRate: direction === 'OFF_RAMP' ? 'desc' : 'asc' },
    });

    return offers.map((o) => this.formatOffer(o));
  }

  async getOffer(id: string) {
    const offer = await this.prisma.vesOffer.findUnique({
      where: { id },
      include: { lpUser: { include: { reputation: true } } },
    });
    if (!offer) throw new NotFoundException('Offer not found');
    return this.formatOffer(offer);
  }

  async deactivateOffer(id: string, walletAddress: string) {
    const offer = await this.prisma.vesOffer.findUnique({ where: { id } });
    if (!offer) throw new NotFoundException('Offer not found');
    if (offer.lpWalletAddress !== walletAddress) {
      throw new ForbiddenException('Only the LP can deactivate this offer');
    }

    const { count } = await this.prisma.vesOffer.updateMany({
      where: { id, status: 'ACTIVE' },
      data: { status: 'PAUSED' },
    });
    if (count === 0) {
      throw new BadRequestException('Offer is not active');
    }
    return { success: true };
  }

  // ============ ORDERS ============

  async createOrder(offerId: string, dto: CreateVesOrderDto, walletAddress: string) {
    const buyer = await this.prisma.user.findUnique({ where: { walletAddress } });
    if (!buyer) throw new NotFoundException('User not found');

    const order = await this.prisma.$transaction(
      async (tx) => {
        // Lock the offer row to prevent over-selling
        const [offer] = await tx.$queryRaw<RawOfferRow[]>`
          SELECT * FROM "VesOffer"
          WHERE "id" = ${offerId}
          FOR UPDATE
        `;
        if (!offer) throw new NotFoundException('Offer not found');
        if (offer.status !== 'ACTIVE') {
          throw new BadRequestException('Offer is not active');
        }
        if (offer.lpWalletAddress === walletAddress) {
          throw new BadRequestException('Cannot buy from your own offer');
        }

        const direction = offer.direction;

        // For OFF_RAMP: seller (buyer field) must provide their Pago Movil details
        if (direction === 'OFF_RAMP') {
          if (!dto.bankCode || !dto.bankName || !dto.phoneNumber || !dto.ciNumber) {
            throw new BadRequestException(
              'Seller Pago Movil details (bankCode, bankName, phoneNumber, ciNumber) are required for off-ramp orders'
            );
          }
        }

        // Calculate USDC from VES amount
        const effectiveRate = offer.vesRate * (1 + offer.feePercent / 100);
        const amountUsdc = dto.amountVes / effectiveRate;

        if (!Number.isFinite(amountUsdc) || amountUsdc <= 0) {
          throw new BadRequestException('Invalid VES amount');
        }

        const minUsdc = toNumber(offer.minOrderUsdc);
        const maxUsdc = toNumber(offer.maxOrderUsdc);
        if (amountUsdc < minUsdc || amountUsdc > maxUsdc) {
          throw new BadRequestException(
            `USDC amount must be between ${minUsdc} and ${maxUsdc} (got ${amountUsdc.toFixed(2)})`
          );
        }

        const availableUsdc = toNumber(offer.availableUsdc);
        if (amountUsdc > availableUsdc) {
          throw new BadRequestException('Not enough USDC available in this offer');
        }

        // Decrement offer availability
        const newAvailable = availableUsdc - amountUsdc;
        const newStatus: VesOfferStatus = newAvailable < minUsdc ? 'DEPLETED' : 'ACTIVE';

        await tx.vesOffer.update({
          where: { id: offerId },
          data: {
            availableUsdc: toBigInt(Math.max(0, newAvailable)),
            status: newStatus,
            totalOrders: { increment: 1 },
          },
        });

        return tx.vesOrder.create({
          data: {
            offerId,
            buyerWalletAddress: walletAddress,
            buyerUserId: buyer.id,
            lpWalletAddress: offer.lpWalletAddress,
            amountUsdc: toBigInt(amountUsdc),
            amountVes: dto.amountVes,
            vesRate: offer.vesRate,
            feePercent: offer.feePercent,
            direction,
            expiresAt: new Date(Date.now() + DEFAULT_ESCROW_TIMEOUT * 1000),
            // Seller bank details for OFF_RAMP orders
            ...(direction === 'OFF_RAMP' && {
              sellerBankCode: dto.bankCode,
              sellerBankName: dto.bankName,
              sellerPhoneNumber: dto.phoneNumber,
              sellerCiNumber: dto.ciNumber,
            }),
          },
          include: { offer: true },
        });
      },
      { maxWait: 5000, timeout: 15000 }
    );

    this.eventEmitter.emit('ves-onramp.order.created', {
      orderId: order.id,
      buyerWallet: walletAddress,
      lpWallet: order.lpWalletAddress,
      direction: order.direction,
    });

    return this.formatOrder(order);
  }

  async getOrderDetails(orderId: string, walletAddress: string) {
    const order = await this.prisma.vesOrder.findUnique({
      where: { id: orderId },
      include: { offer: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.buyerWalletAddress !== walletAddress && order.lpWalletAddress !== walletAddress) {
      throw new ForbiddenException('Access denied');
    }
    return this.formatOrder(order);
  }

  async getUserOrders(walletAddress: string) {
    const orders = await this.prisma.vesOrder.findMany({
      where: {
        OR: [{ buyerWalletAddress: walletAddress }, { lpWalletAddress: walletAddress }],
      },
      include: { offer: true },
      orderBy: { createdAt: 'desc' },
    });
    return orders.map((o) => this.formatOrder(o));
  }

  // ============ ESCROW LOCK ============

  async getEscrowLockParams(orderId: string, walletAddress: string) {
    const order = await this.prisma.vesOrder.findUnique({
      where: { id: orderId },
      include: { offer: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    const locker = this.getEscrowLocker(order);
    if (locker !== walletAddress) {
      throw new ForbiddenException(
        order.direction === 'OFF_RAMP'
          ? 'Only the seller can lock escrow for off-ramp orders'
          : 'Only the LP can lock escrow'
      );
    }
    if (order.status !== 'PENDING') {
      throw new BadRequestException('Order is not in PENDING status');
    }

    const amount = toNumber(order.amountUsdc);

    if (this.escrowMode === 'onchain') {
      // For on-chain escrow, buyer/seller roles in the program are direction-dependent
      const escrowBuyer = this.getEscrowRecipient(order);
      const escrowSeller = this.getEscrowLocker(order);
      return {
        mode: 'onchain' as const,
        programId: ESCROW_PROGRAM_ID,
        adminPubkey: this.escrowAdminPubkey,
        buyerAddress: escrowBuyer,
        sellerAddress: escrowSeller,
        mintAddress: USDC_MINT,
        amount,
        decimals: USDC_DECIMALS,
        timeoutSeconds: DEFAULT_ESCROW_TIMEOUT,
        orderId,
      };
    }

    const escrowWallet = this.config.get(
      'TREASURY_WALLET',
      'H9j1W4u5LEiw8AZdui6c8AmN6t4tKkPQCAULPW8eMiTE'
    );

    return {
      mode: 'legacy' as const,
      escrowWallet,
      mintAddress: USDC_MINT,
      amount,
      decimals: USDC_DECIMALS,
      orderId,
    };
  }

  async confirmEscrowLock(orderId: string, signature: string, walletAddress: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const [order] = await tx.$queryRaw<RawOrderRow[]>`
          SELECT * FROM "VesOrder"
          WHERE "id" = ${orderId}
          FOR UPDATE
        `;
        if (!order) throw new NotFoundException('Order not found');
        const locker = this.getEscrowLocker(order);
        if (locker !== walletAddress) {
          throw new ForbiddenException(
            order.direction === 'OFF_RAMP'
              ? 'Only the seller can confirm escrow lock for off-ramp orders'
              : 'Only the LP can confirm escrow lock'
          );
        }
        if (order.status !== 'PENDING') {
          if (order.escrowTx === signature) return { success: true, orderId, signature };
          throw new BadRequestException(
            `Order is not in PENDING status (current: ${order.status})`
          );
        }

        // Verify signature isn't reused
        const existing = await tx.vesOrder.findFirst({ where: { escrowTx: signature } });
        if (existing && existing.id !== orderId) {
          throw new BadRequestException('This signature is already used for another order');
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

        // Verify signer is the escrow locker (LP for ON_RAMP, seller for OFF_RAMP)
        const signers = parsedTx.transaction.message.accountKeys
          .filter((k: { signer: boolean }) => k.signer)
          .map((k: { pubkey: { toBase58(): string } }) => k.pubkey.toBase58());

        if (!signers.includes(locker)) {
          throw new BadRequestException('Transaction was not signed by the escrow locker');
        }

        // Verify correct amount transferred
        const expectedRaw = Math.round(toNumber(order.amountUsdc) * 10 ** USDC_DECIMALS);
        const innerIxs = parsedTx.meta?.innerInstructions ?? [];
        const allIxs = [
          ...parsedTx.transaction.message.instructions,
          ...innerIxs.flatMap((ix: { instructions: unknown[] }) => ix.instructions),
        ];

        let transferFound = false;
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
              transferFound = true;
              break;
            }
          }
        }

        if (!transferFound) {
          throw new BadRequestException('On-chain transfer amount does not match expected amount');
        }

        if (this.escrowMode === 'onchain') {
          const programInvoked = parsedTx.transaction.message.accountKeys.some(
            (k: { pubkey: { toBase58(): string } }) => k.pubkey.toBase58() === ESCROW_PROGRAM_ID
          );
          if (!programInvoked) {
            throw new BadRequestException('Transaction did not invoke the escrow program');
          }
        }

        await tx.vesOrder.update({
          where: { id: orderId },
          data: { status: 'ESCROW_LOCKED', escrowTx: signature },
        });

        this.txLogger
          .log({
            walletAddress: locker,
            type: 'VES_ESCROW_LOCK',
            signature,
            amount: toNumber(order.amountUsdc),
            token: 'USDC',
          })
          .then(() => this.txLogger.confirm(signature))
          .catch((e) => this.logger.error('Failed to log VES escrow lock:', e));

        this.eventEmitter.emit('ves-onramp.escrow.locked', {
          orderId,
          buyerWallet: order.buyerWalletAddress,
          lpWallet: order.lpWalletAddress,
          amountUsdc: toNumber(order.amountUsdc),
          direction: order.direction,
        });

        return { success: true, orderId, signature };
      },
      { maxWait: 5000, timeout: 30000 }
    );
  }

  // ============ PAYMENT FLOW ============

  async markPaid(orderId: string, walletAddress: string, dto?: MarkPaidDto) {
    const [order] = await this.prisma.$queryRaw<RawOrderRow[]>`
      SELECT * FROM "VesOrder"
      WHERE "id" = ${orderId}
      FOR UPDATE
    `;
    if (!order) throw new NotFoundException('Order not found');

    const vesSender = this.getVesSender(order);
    if (vesSender !== walletAddress) {
      throw new ForbiddenException(
        order.direction === 'OFF_RAMP'
          ? 'Only the LP can mark VES as sent for off-ramp orders'
          : 'Only the buyer can mark as paid'
      );
    }
    if (order.status !== 'ESCROW_LOCKED') {
      throw new BadRequestException(`Cannot mark as paid: order is ${order.status}`);
    }

    // Validate receipt if provided
    if (dto?.receipt) {
      const estimatedBytes = (dto.receipt.length * 3) / 4;
      if (estimatedBytes > 250_000) {
        throw new BadRequestException('Receipt image too large. Must be under 200KB compressed.');
      }
      if (!dto.receipt.match(/^data:image\/(jpeg|jpg|png|webp);base64,/)) {
        throw new BadRequestException('Receipt must be a base64-encoded image');
      }
    }

    await this.prisma.vesOrder.update({
      where: { id: orderId },
      data: {
        status: 'PAYMENT_SENT',
        paidAt: new Date(),
        paymentReference: dto?.reference,
        paymentReceipt: dto?.receipt,
        receiptUploadedAt: dto?.receipt ? new Date() : undefined,
      },
    });

    this.eventEmitter.emit('ves-onramp.payment.sent', {
      orderId,
      buyerWallet: order.buyerWalletAddress,
      lpWallet: order.lpWalletAddress,
      amountVes: order.amountVes,
      direction: order.direction,
      hasReceipt: !!dto?.receipt,
    });

    return { success: true };
  }

  async confirmReceipt(orderId: string, walletAddress: string) {
    if (this.escrowMode === 'onchain') {
      throw new BadRequestException(
        'On-chain escrow: use POST /ves-onramp/orders/:id/confirm-release with the release tx signature'
      );
    }

    // Legacy mode — server signs release
    return this.releaseEscrow(orderId, walletAddress);
  }

  async confirmOnChainRelease(orderId: string, signature: string, walletAddress: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const [order] = await tx.$queryRaw<RawOrderRow[]>`
          SELECT * FROM "VesOrder"
          WHERE "id" = ${orderId}
          FOR UPDATE
        `;
        if (!order) throw new NotFoundException('Order not found');
        const vesReceiver = this.getVesReceiver(order);
        if (vesReceiver !== walletAddress) {
          throw new ForbiddenException(
            order.direction === 'OFF_RAMP'
              ? 'Only the seller can confirm release for off-ramp orders'
              : 'Only the LP can confirm release'
          );
        }
        if (order.releaseTx === signature) {
          return { success: true, orderId, signature };
        }
        if (order.status !== 'PAYMENT_SENT' && order.status !== 'ESCROW_LOCKED') {
          throw new BadRequestException(`Cannot release: order is ${order.status}`);
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

        const programInvoked = parsedTx.transaction.message.accountKeys.some(
          (k: { pubkey: { toBase58(): string } }) => k.pubkey.toBase58() === ESCROW_PROGRAM_ID
        );
        if (!programInvoked) {
          throw new BadRequestException('Transaction did not invoke the escrow program');
        }

        // Verify release instruction discriminator
        let releaseFound = false;
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
                if (decoded.length >= 8 && decoded.subarray(0, 8).equals(RELEASE_DISCRIMINATOR)) {
                  releaseFound = true;
                  break;
                }
              }
            }
          }
        }

        if (!releaseFound) {
          throw new BadRequestException('Transaction does not contain release_escrow instruction');
        }

        await tx.vesOrder.update({
          where: { id: orderId },
          data: {
            releaseTx: signature,
            status: 'COMPLETED',
            confirmedAt: new Date(),
            completedAt: new Date(),
          },
        });

        // Update LP stats
        await tx.vesOffer.update({
          where: { id: order.offerId },
          data: { completedOrders: { increment: 1 } },
        });

        const recipient = this.getEscrowRecipient(order);
        this.txLogger
          .log({
            walletAddress: recipient,
            type: 'VES_ESCROW_RELEASE',
            signature,
            amount: toNumber(order.amountUsdc),
            token: 'USDC',
          })
          .then(() => this.txLogger.confirm(signature))
          .catch((e) => this.logger.error('Failed to log VES escrow release:', e));

        this.eventEmitter.emit('ves-onramp.order.completed', {
          orderId,
          buyerWallet: order.buyerWalletAddress,
          lpWallet: order.lpWalletAddress,
          amountUsdc: toNumber(order.amountUsdc),
          amountVes: order.amountVes,
          direction: order.direction,
        });

        return { success: true, orderId, signature };
      },
      { maxWait: 10000, timeout: 30000 }
    );
  }

  // ============ DISPUTES ============

  async openDispute(orderId: string, walletAddress: string, reason: string) {
    const [order] = await this.prisma.$queryRaw<RawOrderRow[]>`
      SELECT * FROM "VesOrder"
      WHERE "id" = ${orderId}
      FOR UPDATE
    `;
    if (!order) throw new NotFoundException('Order not found');
    if (order.buyerWalletAddress !== walletAddress && order.lpWalletAddress !== walletAddress) {
      throw new ForbiddenException('Only order participants can dispute');
    }
    if (order.status !== 'PAYMENT_SENT' && order.status !== 'ESCROW_LOCKED') {
      throw new BadRequestException(`Cannot dispute: order is ${order.status}`);
    }

    await this.prisma.vesOrder.update({
      where: { id: orderId },
      data: { status: 'DISPUTED', disputeReason: reason },
    });

    this.eventEmitter.emit('ves-onramp.order.disputed', {
      orderId,
      buyerWallet: order.buyerWalletAddress,
      lpWallet: order.lpWalletAddress,
      reason,
    });

    return { success: true };
  }

  async resolveDispute(
    orderId: string,
    resolution: 'RELEASE_TO_RECIPIENT' | 'REFUND_TO_LOCKER',
    adminAddress: string,
    notes: string
  ) {
    const order = await this.prisma.vesOrder.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== 'DISPUTED') {
      throw new BadRequestException(`Order is not disputed (current: ${order.status})`);
    }

    if (resolution === 'RELEASE_TO_RECIPIENT') {
      if (this.escrowMode === 'onchain') {
        throw new BadRequestException(
          'On-chain: admin must call confirm-release with the release tx signature'
        );
      }
      await this.releaseEscrow(orderId, undefined);
    } else {
      if (this.escrowMode === 'onchain') {
        throw new BadRequestException(
          'On-chain: admin must call confirm-refund with the refund tx signature'
        );
      }
      await this.refundEscrow(orderId);
    }

    await this.prisma.vesOrder.update({
      where: { id: orderId },
      data: { disputeResolution: notes },
    });

    this.logger.log(`VES dispute resolved for order ${orderId}: ${resolution} by ${adminAddress}`);

    return { success: true, orderId, resolution, notes };
  }

  // ============ ESCROW RELEASE (LEGACY) ============

  private async releaseEscrow(orderId: string, walletAddress?: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const [order] = await tx.$queryRaw<RawOrderRow[]>`
          SELECT * FROM "VesOrder"
          WHERE "id" = ${orderId}
          FOR UPDATE
        `;
        if (!order) throw new NotFoundException('Order not found');
        if (walletAddress) {
          const vesReceiver = this.getVesReceiver(order);
          if (vesReceiver !== walletAddress) {
            throw new ForbiddenException(
              order.direction === 'OFF_RAMP'
                ? 'Only the seller can confirm receipt for off-ramp orders'
                : 'Only the LP can confirm receipt'
            );
          }
        }
        if (order.releaseTx) return { success: true, orderId, signature: order.releaseTx };
        if (
          order.status !== 'PAYMENT_SENT' &&
          order.status !== 'ESCROW_LOCKED' &&
          order.status !== 'DISPUTED'
        ) {
          throw new BadRequestException(`Cannot release: order is ${order.status}`);
        }
        if (!this.escrowKeypair) {
          throw new BadRequestException('Escrow wallet not configured');
        }

        const rawAmount = BigInt(Math.round(toNumber(order.amountUsdc) * 10 ** USDC_DECIMALS));
        const mintPubkey = new PublicKey(USDC_MINT);
        const recipientAddress = this.getEscrowRecipient(order);
        const recipientPubkey = new PublicKey(recipientAddress);
        const connection = this.solana.getConnection();

        const escrowAta = await getAssociatedTokenAddress(mintPubkey, this.escrowKeypair.publicKey);
        const recipientAta = await getAssociatedTokenAddress(mintPubkey, recipientPubkey);

        const solanaTx = new Transaction().add(
          createTransferInstruction(
            escrowAta,
            recipientAta,
            this.escrowKeypair.publicKey,
            rawAmount
          )
        );

        const sig = await sendAndConfirmTransaction(connection, solanaTx, [this.escrowKeypair]);

        await tx.vesOrder.update({
          where: { id: orderId },
          data: {
            releaseTx: sig,
            status: 'COMPLETED',
            confirmedAt: new Date(),
            completedAt: new Date(),
          },
        });

        await tx.vesOffer.update({
          where: { id: order.offerId },
          data: { completedOrders: { increment: 1 } },
        });

        this.txLogger
          .log({
            walletAddress: recipientAddress,
            type: 'VES_ESCROW_RELEASE',
            signature: sig,
            amount: toNumber(order.amountUsdc),
            token: 'USDC',
          })
          .then(() => this.txLogger.confirm(sig))
          .catch((e) => this.logger.error('Failed to log VES release:', e));

        this.eventEmitter.emit('ves-onramp.order.completed', {
          orderId,
          buyerWallet: order.buyerWalletAddress,
          lpWallet: order.lpWalletAddress,
          amountUsdc: toNumber(order.amountUsdc),
          amountVes: order.amountVes,
          direction: order.direction,
        });

        return { success: true, orderId, signature: sig };
      },
      { maxWait: 10000, timeout: 60000 }
    );
  }

  // ============ ESCROW REFUND (LEGACY) ============

  async refundEscrow(orderId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const [order] = await tx.$queryRaw<RawOrderRow[]>`
          SELECT * FROM "VesOrder"
          WHERE "id" = ${orderId}
          FOR UPDATE
        `;
        if (!order) throw new NotFoundException('Order not found');
        if (order.releaseTx && order.status === 'REFUNDED') {
          return { success: true, orderId, signature: order.releaseTx };
        }

        const refundableStatuses: VesOrderStatus[] = [
          'ESCROW_LOCKED',
          'PAYMENT_SENT',
          'DISPUTED',
          'EXPIRED',
        ];
        if (!refundableStatuses.includes(order.status as VesOrderStatus)) {
          throw new BadRequestException(`Cannot refund: order is ${order.status}`);
        }

        if (!this.escrowKeypair) {
          throw new BadRequestException('Escrow wallet not configured');
        }

        const rawAmount = BigInt(Math.round(toNumber(order.amountUsdc) * 10 ** USDC_DECIMALS));
        const mintPubkey = new PublicKey(USDC_MINT);
        const refundAddress = this.getEscrowLocker(order);
        const refundPubkey = new PublicKey(refundAddress);
        const connection = this.solana.getConnection();

        const escrowAta = await getAssociatedTokenAddress(mintPubkey, this.escrowKeypair.publicKey);
        const refundAta = await getAssociatedTokenAddress(mintPubkey, refundPubkey);

        const solanaTx = new Transaction().add(
          createTransferInstruction(escrowAta, refundAta, this.escrowKeypair.publicKey, rawAmount)
        );

        const sig = await sendAndConfirmTransaction(connection, solanaTx, [this.escrowKeypair]);

        await tx.vesOrder.update({
          where: { id: orderId },
          data: { releaseTx: sig, status: 'REFUNDED' },
        });

        // Restore offer availability
        await tx.vesOffer.update({
          where: { id: order.offerId },
          data: {
            availableUsdc: { increment: order.amountUsdc },
            status: 'ACTIVE',
          },
        });

        this.txLogger
          .log({
            walletAddress: refundAddress,
            type: 'VES_ESCROW_REFUND',
            signature: sig,
            amount: toNumber(order.amountUsdc),
            token: 'USDC',
          })
          .then(() => this.txLogger.confirm(sig))
          .catch((e) => this.logger.error('Failed to log VES refund:', e));

        return { success: true, orderId, signature: sig };
      },
      { maxWait: 10000, timeout: 60000 }
    );
  }

  // ============ FORMAT HELPERS ============

  private formatOffer(offer: {
    id: string;
    lpWalletAddress: string;
    lpUser?: {
      walletAddress: string;
      reputation?: { rating: number; completedTrades: number } | null;
    };
    availableUsdc: bigint;
    vesRate: number;
    feePercent: number;
    minOrderUsdc: bigint;
    maxOrderUsdc: bigint;
    bankCode: string;
    bankName: string;
    phoneNumber: string;
    ciNumber: string;
    status: string;
    totalOrders: number;
    completedOrders: number;
    direction: VesDirection;
    createdAt: Date;
  }) {
    const effectiveRate = offer.vesRate * (1 + offer.feePercent / 100);
    return {
      id: offer.id,
      lpWalletAddress: offer.lpWalletAddress,
      availableUsdc: toNumber(offer.availableUsdc),
      vesRate: offer.vesRate,
      feePercent: offer.feePercent,
      effectiveRate,
      minOrderUsdc: toNumber(offer.minOrderUsdc),
      maxOrderUsdc: toNumber(offer.maxOrderUsdc),
      bankCode: offer.bankCode,
      bankName: offer.bankName,
      phoneNumber: offer.phoneNumber,
      ciNumber: offer.ciNumber,
      status: offer.status,
      totalOrders: offer.totalOrders,
      completedOrders: offer.completedOrders,
      direction: offer.direction,
      lpRating: offer.lpUser?.reputation?.rating ?? 5.0,
      lpCompletedTrades: offer.lpUser?.reputation?.completedTrades ?? 0,
      createdAt: offer.createdAt,
    };
  }

  private formatOrder(order: {
    id: string;
    offerId: string;
    buyerWalletAddress: string;
    lpWalletAddress: string;
    amountUsdc: bigint;
    amountVes: number;
    vesRate: number;
    feePercent: number;
    status: string;
    escrowTx: string | null;
    releaseTx: string | null;
    disputeReason: string | null;
    direction: VesDirection;
    sellerBankCode?: string | null;
    sellerBankName?: string | null;
    sellerPhoneNumber?: string | null;
    sellerCiNumber?: string | null;
    paymentReceipt?: string | null;
    paymentReference?: string | null;
    receiptUploadedAt?: Date | null;
    createdAt: Date;
    paidAt: Date | null;
    confirmedAt: Date | null;
    completedAt: Date | null;
    expiresAt: Date;
    offer?: {
      bankCode: string;
      bankName: string;
      phoneNumber: string;
      ciNumber: string;
    };
  }) {
    // ON_RAMP: LP's Pago Movil from offer (buyer sends VES to LP)
    // OFF_RAMP: Seller's Pago Movil from order (LP sends VES to seller)
    const pagoMovil =
      order.direction === 'OFF_RAMP'
        ? order.sellerBankCode
          ? {
              bankCode: order.sellerBankCode,
              bankName: order.sellerBankName || '',
              phoneNumber: order.sellerPhoneNumber || '',
              ciNumber: order.sellerCiNumber || '',
            }
          : undefined
        : order.offer
          ? {
              bankCode: order.offer.bankCode,
              bankName: order.offer.bankName,
              phoneNumber: order.offer.phoneNumber,
              ciNumber: order.offer.ciNumber,
            }
          : undefined;

    return {
      id: order.id,
      offerId: order.offerId,
      buyerWalletAddress: order.buyerWalletAddress,
      lpWalletAddress: order.lpWalletAddress,
      amountUsdc: toNumber(order.amountUsdc),
      amountVes: order.amountVes,
      vesRate: order.vesRate,
      feePercent: order.feePercent,
      status: order.status,
      escrowTx: order.escrowTx,
      releaseTx: order.releaseTx,
      disputeReason: order.disputeReason,
      direction: order.direction,
      pagoMovil,
      paymentReceipt: order.paymentReceipt,
      paymentReference: order.paymentReference,
      receiptUploadedAt: order.receiptUploadedAt,
      createdAt: order.createdAt,
      paidAt: order.paidAt,
      confirmedAt: order.confirmedAt,
      completedAt: order.completedAt,
      expiresAt: order.expiresAt,
    };
  }
}
