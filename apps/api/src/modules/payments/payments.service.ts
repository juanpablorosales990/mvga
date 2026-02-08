import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Connection } from '@solana/web3.js';

const TOKEN_DECIMALS: Record<string, number> = {
  USDC: 6,
  USDT: 6,
  MVGA: 9,
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
    if (request.status !== 'PENDING') {
      throw new BadRequestException(`Payment request is ${request.status}`);
    }
    if (request.expiresAt < new Date()) {
      await this.prisma.paymentRequest.update({
        where: { id },
        data: { status: 'EXPIRED' },
      });
      throw new BadRequestException('Payment request has expired');
    }

    // Verify transaction exists on-chain
    const tx = await this.connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });
    if (!tx) throw new BadRequestException('Transaction not found on-chain');
    if (tx.meta?.err) throw new BadRequestException('Transaction failed on-chain');

    // Mark as paid (atomic to prevent double-claim)
    const updated = await this.prisma.paymentRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'PAID', paymentTx: signature },
    });

    if (updated.count === 0) {
      throw new BadRequestException('Payment request already processed');
    }

    return { status: 'PAID', signature };
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
