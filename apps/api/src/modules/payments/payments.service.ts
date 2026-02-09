import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
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

  constructor(private readonly prisma: PrismaService) {
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
    };
  }
}
