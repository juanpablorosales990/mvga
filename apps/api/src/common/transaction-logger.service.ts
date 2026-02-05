import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { TransactionType, TransactionLogStatus } from '@prisma/client';

@Injectable()
export class TransactionLoggerService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    walletAddress: string;
    type: TransactionType;
    signature: string;
    amount?: number;
    token?: string;
  }) {
    return this.prisma.transactionLog.create({
      data: {
        walletAddress: params.walletAddress,
        type: params.type,
        signature: params.signature,
        amount: params.amount ? BigInt(Math.round(params.amount * 1e6)) : null,
        token: params.token,
        status: 'PENDING',
      },
    });
  }

  async confirm(signature: string) {
    return this.prisma.transactionLog.update({
      where: { signature },
      data: {
        status: 'CONFIRMED',
        confirmedAt: new Date(),
      },
    });
  }

  async fail(signature: string, error: string) {
    return this.prisma.transactionLog.update({
      where: { signature },
      data: {
        status: 'FAILED',
        error,
      },
    });
  }

  async getByWallet(walletAddress: string, limit = 50) {
    const logs = await this.prisma.transactionLog.findMany({
      where: { walletAddress },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return logs.map((log) => ({
      id: log.id,
      type: log.type,
      signature: log.signature,
      amount: log.amount ? Number(log.amount) / 1e6 : null,
      token: log.token,
      status: log.status,
      createdAt: log.createdAt,
      confirmedAt: log.confirmedAt,
      error: log.error,
    }));
  }
}
