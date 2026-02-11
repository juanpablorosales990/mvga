import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../common/prisma.service';
import { SocialService } from '../social/social.service';
import { Connection } from '@solana/web3.js';

interface TokenBalance {
  mint?: string;
  owner?: string;
  uiTokenAmount?: { amount?: string; decimals?: number };
}

const TOKEN_DECIMALS: Record<string, number> = {
  USDC: 6,
  USDT: 6,
  MVGA: 9,
};

const TOKEN_MINTS: Record<string, string> = {
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  MVGA: 'DRX65kM2n5CLTpdjJCemZvkUwE98ou4RpHrd8Z3GH5Qh',
};

@Injectable()
export class PaymentsService {
  private readonly connection: Connection;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly socialService: SocialService
  ) {
    this.connection = new Connection(
      process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
      'confirmed'
    );
  }

  async createRequest(walletAddress: string, token: string, amount: number, memo?: string) {
    const decimals = TOKEN_DECIMALS[token];
    if (!decimals) throw new BadRequestException('Unsupported token');

    const amountSmallest = BigInt(Math.round(amount * 10 ** decimals));
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    const request = await this.prisma.paymentRequest.create({
      data: {
        recipientAddress: walletAddress,
        token,
        amount: amountSmallest,
        memo: memo || null,
        expiresAt,
      },
    });

    return {
      id: request.id,
      url: `/pay/${request.id}`,
    };
  }

  async getRequest(id: string) {
    const request = await this.prisma.paymentRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Payment request not found');

    // Auto-expire if past expiry date
    if (request.status === 'PENDING' && request.expiresAt < new Date()) {
      await this.prisma.paymentRequest.update({
        where: { id },
        data: { status: 'EXPIRED' },
      });
      return this.formatRequest({ ...request, status: 'EXPIRED' });
    }

    return this.formatRequest(request);
  }

  async verifyPayment(id: string, signature: string) {
    const request = await this.prisma.paymentRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Payment request not found');
    if (request.status !== 'PENDING' && request.status !== 'EXPIRED') {
      throw new BadRequestException(`Payment request is ${request.status}`);
    }

    // Verify transaction exists on-chain
    const tx = await this.connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });
    if (!tx) throw new BadRequestException('Transaction not found on-chain');
    if (tx.meta?.err) throw new BadRequestException('Transaction failed on-chain');

    const txTime = tx.blockTime ? new Date(tx.blockTime * 1000) : null;
    if (!txTime) throw new BadRequestException('Transaction missing blockTime');

    // Allow a small skew for blockTime precision.
    const earliest = new Date(request.createdAt.getTime() - 2 * 60_000);
    const latest = new Date(request.expiresAt.getTime() + 2 * 60_000);

    if (txTime < earliest) {
      throw new BadRequestException('Transaction is older than payment request');
    }
    if (txTime > latest) {
      throw new BadRequestException('Transaction is after payment request expiry');
    }

    const mint = TOKEN_MINTS[request.token];
    if (!mint) throw new BadRequestException('Unsupported token');

    const received = this.getNetTokenDelta(tx, request.recipientAddress, mint);
    if (received < request.amount) {
      throw new BadRequestException('Transaction does not pay the requested amount');
    }

    // Mark as paid (atomic to prevent double-claim; DB enforces unique paymentTx)
    let updated: { count: number };
    try {
      updated = await this.prisma.paymentRequest.updateMany({
        where: { id, status: { in: ['PENDING', 'EXPIRED'] } },
        data: { status: 'PAID', paymentTx: signature },
      });
    } catch (err: unknown) {
      // Prisma unique constraint (e.g., signature already used on another request)
      if ((err as { code?: string })?.code === 'P2002') {
        throw new BadRequestException('Transaction signature already used');
      }
      throw err;
    }

    if (updated.count === 0) {
      throw new BadRequestException('Payment request already processed');
    }

    // Emit event for push notifications (if social request)
    if (request.requesterId) {
      this.eventEmitter.emit('payment.request.paid', {
        requestId: request.id,
        requesterWallet: request.recipientAddress,
        requesteeAddress: request.requesteeAddress,
        amount: Number(request.amount) / 10 ** (TOKEN_DECIMALS[request.token] ?? 6),
        token: request.token,
        note: request.note,
      });
    }

    // Update split payment progress if this is a split share
    await this.updateSplitProgress(id);

    return { status: 'PAID', signature };
  }

  private getNetTokenDelta(
    tx: Record<string, unknown>,
    ownerAddress: string,
    mintAddress: string
  ): bigint {
    const meta = (
      tx as { meta?: { preTokenBalances?: TokenBalance[]; postTokenBalances?: TokenBalance[] } }
    )?.meta;
    const pre: TokenBalance[] = meta?.preTokenBalances ?? [];
    const post: TokenBalance[] = meta?.postTokenBalances ?? [];

    const sumForOwner = (balances: TokenBalance[]): bigint => {
      let sum = 0n;
      for (const b of balances) {
        if (!b) continue;
        if (b.mint !== mintAddress) continue;
        if (b.owner !== ownerAddress) continue;
        const amt = b.uiTokenAmount?.amount;
        if (typeof amt !== 'string') continue;
        try {
          sum += BigInt(amt);
        } catch {
          // ignore malformed amounts
        }
      }
      return sum;
    };

    return sumForOwner(post) - sumForOwner(pre);
  }

  // ── Social Requests (Phase 2) ────────────────────────────────────────

  async requestFromUser(
    requesterId: string,
    requesterWallet: string,
    dto: { recipientIdentifier: string; token: string; amount: number; note?: string }
  ) {
    const decimals = TOKEN_DECIMALS[dto.token];
    if (!decimals) throw new BadRequestException('Unsupported token');

    // Resolve recipient identifier (@username, #citizen, or raw address)
    let requesteeAddress: string;
    const identifier = dto.recipientIdentifier.trim();

    if (identifier.startsWith('@') || identifier.startsWith('#')) {
      const params: { username?: string; citizen?: string } = {};
      if (identifier.startsWith('@')) {
        params.username = identifier.slice(1);
      } else {
        params.citizen = identifier.slice(1);
      }
      const resolved = await this.socialService.lookupUser(params);
      requesteeAddress = resolved.walletAddress;
    } else {
      requesteeAddress = identifier;
    }

    // Validate not self-request
    if (requesteeAddress === requesterWallet) {
      throw new BadRequestException('Cannot request payment from yourself');
    }

    // Look up requester username for denormalized display
    const requester = await this.prisma.user.findUnique({
      where: { id: requesterId },
      select: { username: true },
    });

    const amountSmallest = BigInt(Math.round(dto.amount * 10 ** decimals));
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72h for social requests

    const request = await this.prisma.paymentRequest.create({
      data: {
        recipientAddress: requesterWallet,
        token: dto.token,
        amount: amountSmallest,
        expiresAt,
        requesterId,
        requesterUsername: requester?.username || null,
        requesteeAddress,
        note: dto.note || null,
      },
    });

    // Emit event for push notification to requestee
    this.eventEmitter.emit('payment.request.received', {
      requestId: request.id,
      requesterWallet,
      requesterUsername: requester?.username,
      requesteeAddress,
      amount: dto.amount,
      token: dto.token,
      note: dto.note,
    });

    return this.formatRequest(request);
  }

  async getMyRequests(walletAddress: string) {
    const requests = await this.prisma.paymentRequest.findMany({
      where: {
        recipientAddress: walletAddress,
        requesterId: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Auto-expire stale ones
    const now = new Date();
    const results = [];
    for (const r of requests) {
      if (r.status === 'PENDING' && r.expiresAt < now) {
        await this.prisma.paymentRequest.update({
          where: { id: r.id },
          data: { status: 'EXPIRED' },
        });
        results.push(this.formatRequest({ ...r, status: 'EXPIRED' }));
      } else {
        results.push(this.formatRequest(r));
      }
    }
    return results;
  }

  async getRequestsForMe(walletAddress: string) {
    const requests = await this.prisma.paymentRequest.findMany({
      where: {
        requesteeAddress: walletAddress,
        status: { notIn: ['CANCELLED'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const now = new Date();
    const results = [];
    for (const r of requests) {
      if (r.status === 'PENDING' && r.expiresAt < now) {
        await this.prisma.paymentRequest.update({
          where: { id: r.id },
          data: { status: 'EXPIRED' },
        });
        results.push(this.formatRequest({ ...r, status: 'EXPIRED' }));
      } else {
        results.push(this.formatRequest(r));
      }
    }
    return results;
  }

  async declineRequest(requestId: string, walletAddress: string) {
    const request = await this.prisma.paymentRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Payment request not found');
    if (request.requesteeAddress !== walletAddress) {
      throw new BadRequestException('Only the requestee can decline this request');
    }
    if (request.status !== 'PENDING') {
      throw new BadRequestException(`Cannot decline a ${request.status} request`);
    }

    await this.prisma.paymentRequest.update({
      where: { id: requestId },
      data: { status: 'DECLINED', declinedAt: new Date() },
    });

    // Emit event for push notification to requester
    this.eventEmitter.emit('payment.request.declined', {
      requestId,
      requesterWallet: request.recipientAddress,
      requesteeAddress: walletAddress,
      amount: Number(request.amount) / 10 ** (TOKEN_DECIMALS[request.token] ?? 6),
      token: request.token,
    });

    return { status: 'DECLINED' };
  }

  // ── Formatting ──────────────────────────────────────────────────────

  private formatRequest(request: {
    id: string;
    recipientAddress: string;
    token: string;
    amount: bigint;
    memo: string | null;
    status: string;
    paymentTx: string | null;
    expiresAt: Date;
    createdAt: Date;
    requesterId?: string | null;
    requesterUsername?: string | null;
    requesteeAddress?: string | null;
    note?: string | null;
    declinedAt?: Date | null;
    splitPaymentId?: string | null;
  }) {
    const decimals = TOKEN_DECIMALS[request.token] ?? 6;
    return {
      id: request.id,
      recipientAddress: request.recipientAddress,
      token: request.token,
      amount: Number(request.amount) / 10 ** decimals,
      amountRaw: request.amount.toString(),
      memo: request.memo,
      status: request.status,
      paymentTx: request.paymentTx,
      expiresAt: request.expiresAt.toISOString(),
      createdAt: request.createdAt.toISOString(),
      // Phase 2 fields
      requesterId: request.requesterId || null,
      requesterUsername: request.requesterUsername || null,
      requesteeAddress: request.requesteeAddress || null,
      note: request.note || null,
      declinedAt: request.declinedAt?.toISOString() || null,
      // Phase 3 fields
      splitPaymentId: request.splitPaymentId || null,
    };
  }

  // ── Split Payments (Phase 3) ──────────────────────────────────────────

  async createSplit(
    creatorId: string,
    creatorWallet: string,
    dto: {
      token: string;
      totalAmount: number;
      description: string;
      participants: Array<{ recipientIdentifier: string; amount: number }>;
    }
  ) {
    const decimals = TOKEN_DECIMALS[dto.token];
    if (!decimals) throw new BadRequestException('Unsupported token');

    // Validate shares sum ≈ total (1 cent tolerance)
    const sharesSum = dto.participants.reduce((sum, p) => sum + p.amount, 0);
    if (Math.abs(sharesSum - dto.totalAmount) > 0.01) {
      throw new BadRequestException(
        `Shares (${sharesSum}) must equal total amount (${dto.totalAmount})`
      );
    }

    // Resolve all participant identifiers
    const resolved = await Promise.all(
      dto.participants.map(async (p) => {
        const identifier = p.recipientIdentifier.trim();
        let requesteeAddress: string;

        if (identifier.startsWith('@') || identifier.startsWith('#')) {
          const params: { username?: string; citizen?: string } = {};
          if (identifier.startsWith('@')) {
            params.username = identifier.slice(1);
          } else {
            params.citizen = identifier.slice(1);
          }
          const user = await this.socialService.lookupUser(params);
          requesteeAddress = user.walletAddress;
        } else {
          requesteeAddress = identifier;
        }

        if (requesteeAddress === creatorWallet) {
          throw new BadRequestException('Cannot split with yourself');
        }

        return { requesteeAddress, amount: p.amount };
      })
    );

    const totalAmountSmallest = BigInt(Math.round(dto.totalAmount * 10 ** decimals));

    // Lookup creator username for denormalized display
    const creator = await this.prisma.user.findUnique({
      where: { id: creatorId },
      select: { username: true },
    });

    // Create split + individual requests atomically
    const result = await this.prisma.$transaction(async (tx) => {
      const splitPayment = await tx.splitPayment.create({
        data: {
          creatorId,
          creatorAddress: creatorWallet,
          totalAmount: totalAmountSmallest,
          token: dto.token,
          description: dto.description,
          participantCount: resolved.length,
        },
      });

      const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
      const requests = await Promise.all(
        resolved.map((p) =>
          tx.paymentRequest.create({
            data: {
              recipientAddress: creatorWallet,
              token: dto.token,
              amount: BigInt(Math.round(p.amount * 10 ** decimals)),
              expiresAt,
              requesterId: creatorId,
              requesterUsername: creator?.username || null,
              requesteeAddress: p.requesteeAddress,
              note: `Split: ${dto.description}`,
              splitPaymentId: splitPayment.id,
            },
          })
        )
      );

      return { splitPayment, requests };
    });

    // Emit notifications to all participants
    for (const req of result.requests) {
      this.eventEmitter.emit('split.request.created', {
        splitId: result.splitPayment.id,
        requestId: req.id,
        creatorWallet,
        creatorUsername: creator?.username || null,
        requesteeAddress: req.requesteeAddress,
        amount: Number(req.amount) / 10 ** decimals,
        token: dto.token,
        description: dto.description,
        totalAmount: dto.totalAmount,
      });
    }

    return this.formatSplit(result.splitPayment, result.requests);
  }

  async getSplit(splitId: string, walletAddress: string) {
    const split = await this.prisma.splitPayment.findUnique({
      where: { id: splitId },
      include: { requests: { orderBy: { createdAt: 'asc' } } },
    });
    if (!split) throw new NotFoundException('Split payment not found');
    if (split.creatorAddress !== walletAddress) {
      throw new BadRequestException('Only the split creator can view this');
    }
    return this.formatSplit(split, split.requests);
  }

  async getMySplits(walletAddress: string) {
    const splits = await this.prisma.splitPayment.findMany({
      where: { creatorAddress: walletAddress },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { requests: { orderBy: { createdAt: 'asc' } } },
    });
    return splits.map((s) => this.formatSplit(s, s.requests));
  }

  async cancelSplit(splitId: string, walletAddress: string) {
    const split = await this.prisma.splitPayment.findUnique({
      where: { id: splitId },
    });
    if (!split) throw new NotFoundException('Split payment not found');
    if (split.creatorAddress !== walletAddress) {
      throw new BadRequestException('Only the split creator can cancel');
    }
    if (split.status === 'COMPLETED') {
      throw new BadRequestException('Cannot cancel a completed split');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.splitPayment.update({
        where: { id: splitId },
        data: { status: 'CANCELLED' },
      });
      await tx.paymentRequest.updateMany({
        where: { splitPaymentId: splitId, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });
    });

    return { status: 'CANCELLED' };
  }

  private async updateSplitProgress(requestId: string) {
    const request = await this.prisma.paymentRequest.findUnique({
      where: { id: requestId },
      select: { splitPaymentId: true, amount: true },
    });
    if (!request?.splitPaymentId) return;

    const split = await this.prisma.splitPayment.findUnique({
      where: { id: request.splitPaymentId },
      include: { requests: { select: { status: true, amount: true } } },
    });
    if (!split) return;

    const paidRequests = split.requests.filter((r) => r.status === 'PAID');
    const paidCount = paidRequests.length;
    const totalCollected = paidRequests.reduce((sum, r) => sum + r.amount, BigInt(0));
    const newStatus =
      paidCount === split.participantCount ? 'COMPLETED' : paidCount > 0 ? 'PARTIAL' : 'PENDING';

    await this.prisma.splitPayment.update({
      where: { id: request.splitPaymentId },
      data: {
        paidCount,
        totalCollected,
        status: newStatus as any,
        completedAt: newStatus === 'COMPLETED' ? new Date() : null,
      },
    });

    if (newStatus === 'COMPLETED') {
      const decimals = TOKEN_DECIMALS[split.token] ?? 6;
      this.eventEmitter.emit('split.completed', {
        splitId: split.id,
        creatorWallet: split.creatorAddress,
        totalAmount: Number(split.totalAmount) / 10 ** decimals,
        token: split.token,
        description: split.description,
      });
    }
  }

  private formatSplit(
    split: {
      id: string;
      creatorAddress: string;
      totalAmount: bigint;
      token: string;
      description: string;
      participantCount: number;
      status: string;
      paidCount: number;
      totalCollected: bigint;
      createdAt: Date;
      completedAt: Date | null;
    },
    requests: Array<{
      id: string;
      requesteeAddress: string | null;
      amount: bigint;
      status: string;
      paymentTx: string | null;
    }>
  ) {
    const decimals = TOKEN_DECIMALS[split.token] ?? 6;
    return {
      id: split.id,
      creatorAddress: split.creatorAddress,
      totalAmount: Number(split.totalAmount) / 10 ** decimals,
      token: split.token,
      description: split.description,
      participantCount: split.participantCount,
      status: split.status,
      paidCount: split.paidCount,
      totalCollected: Number(split.totalCollected) / 10 ** decimals,
      createdAt: split.createdAt.toISOString(),
      completedAt: split.completedAt?.toISOString() || null,
      participants: requests.map((r) => ({
        requestId: r.id,
        requesteeAddress: r.requesteeAddress,
        amount: Number(r.amount) / 10 ** decimals,
        status: r.status,
        paymentTx: r.paymentTx,
      })),
    };
  }
}
