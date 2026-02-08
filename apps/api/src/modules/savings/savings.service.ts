import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as Sentry from '@sentry/node';
import { PublicKey } from '@solana/web3.js';
import { PrismaService } from '../../common/prisma.service';
import { TransactionLoggerService } from '../../common/transaction-logger.service';
import { CronLockService } from '../../common/cron-lock.service';
import { KaminoAdapter, YieldRate } from './kamino.adapter';

@Injectable()
export class SavingsService {
  private readonly logger = new Logger(SavingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly txLogger: TransactionLoggerService,
    private readonly kamino: KaminoAdapter,
    private readonly cronLock: CronLockService
  ) {}

  /** Get current yield rates from all protocols. */
  async getRates(): Promise<YieldRate[]> {
    // Try to serve from latest snapshot (< 2 hours old)
    const recent = await this.prisma.yieldSnapshot.findFirst({
      where: { snapshotAt: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) } },
      orderBy: { snapshotAt: 'desc' },
    });

    if (recent) {
      // Return from DB cache
      const snapshots = await this.prisma.yieldSnapshot.findMany({
        where: { snapshotAt: recent.snapshotAt },
        orderBy: { token: 'asc' },
      });
      return snapshots.map((s) => ({
        protocol: s.protocol,
        token: s.token,
        supplyApy: s.supplyApy,
      }));
    }

    // Fetch live rates
    return this.kamino.getRates();
  }

  /** Get a user's savings positions and earnings. */
  async getPositions(walletAddress: string) {
    const positions = await this.prisma.savingsPosition.findMany({
      where: { walletAddress, status: { notIn: ['CLOSED'] } },
      orderBy: { createdAt: 'desc' },
    });

    // Get latest rates for APY display
    const rates = await this.getRates();
    const rateMap = new Map(rates.map((r) => [`${r.protocol}:${r.token}`, r.supplyApy]));

    return {
      positions: positions.map((p) => ({
        id: p.id,
        protocol: p.protocol,
        token: p.token,
        depositedAmount: Number(p.depositedAmount) / 1e6,
        currentAmount: Number(p.currentAmount) / 1e6,
        earnedYield: Number(p.currentAmount - p.depositedAmount) / 1e6,
        apy: rateMap.get(`${p.protocol}:${p.token}`) ?? 0,
        status: p.status,
        createdAt: p.createdAt,
      })),
      totalDeposited: positions.reduce((sum, p) => sum + Number(p.depositedAmount), 0) / 1e6,
      totalCurrent: positions.reduce((sum, p) => sum + Number(p.currentAmount), 0) / 1e6,
    };
  }

  /** Initiate a deposit — returns vault info for the client to build the tx. */
  async initiateDeposit(walletAddress: string, amount: number, token = 'USDC') {
    if (amount <= 0) throw new BadRequestException('Amount must be positive');

    const rawAmount = BigInt(Math.round(amount * 1e6));

    // Create a pending savings position
    const position = await this.prisma.savingsPosition.create({
      data: {
        walletAddress,
        protocol: 'KAMINO',
        token,
        depositedAmount: rawAmount,
        currentAmount: rawAmount,
        status: 'PENDING',
      },
    });

    // Build the Kamino deposit transaction for the client to sign
    let transaction: string | undefined;
    try {
      const tx = await this.kamino.buildDepositTx(new PublicKey(walletAddress), rawAmount, token);
      if (tx.instructions.length > 0) {
        transaction = tx
          .serialize({ requireAllSignatures: false, verifySignatures: false })
          .toString('base64');
      }
    } catch (err) {
      this.logger.warn(`Failed to build deposit tx, proceeding without: ${err}`);
    }

    return {
      positionId: position.id,
      protocol: 'KAMINO',
      token,
      amount,
      transaction,
    };
  }

  /** Confirm a deposit after the user has signed the transaction. */
  async confirmDeposit(walletAddress: string, signature: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      // Check for signature replay — reject if already used
      const existing = await tx.savingsPosition.findFirst({
        where: { depositTx: signature },
      });
      if (existing) {
        throw new BadRequestException('Transaction signature already used');
      }

      // Find the most recent unconfirmed position for this wallet
      const position = await tx.savingsPosition.findFirst({
        where: { walletAddress, depositTx: null, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
      });

      if (!position) throw new NotFoundException('No pending deposit found');

      // Update with tx signature and activate the position
      await tx.savingsPosition.update({
        where: { id: position.id },
        data: { depositTx: signature, status: 'ACTIVE' },
      });

      return position;
    });

    // Log the transaction (outside tx — non-critical)
    await this.txLogger.log({
      walletAddress,
      type: 'TRANSFER',
      signature,
      amount: Number(result.depositedAmount) / 1e6,
      token: result.token,
    });

    return { success: true, positionId: result.id };
  }

  /** Initiate a withdrawal from a savings position. */
  async initiateWithdraw(walletAddress: string, positionId: string, amount?: number) {
    const position = await this.prisma.savingsPosition.findUnique({
      where: { id: positionId },
    });

    if (!position || position.walletAddress !== walletAddress) {
      throw new NotFoundException('Position not found');
    }
    if (position.status !== 'ACTIVE') {
      throw new BadRequestException('Position is not active');
    }

    const withdrawAmount = amount ? BigInt(Math.round(amount * 1e6)) : position.currentAmount;

    if (withdrawAmount > position.currentAmount) {
      throw new BadRequestException('Insufficient balance');
    }

    // Mark as withdrawing
    await this.prisma.savingsPosition.update({
      where: { id: positionId },
      data: { status: 'WITHDRAWING' },
    });

    // Build the Kamino withdraw transaction for the client to sign
    let transaction: string | undefined;
    try {
      const tx = await this.kamino.buildWithdrawTx(
        new PublicKey(walletAddress),
        withdrawAmount,
        position.token
      );
      if (tx.instructions.length > 0) {
        transaction = tx
          .serialize({ requireAllSignatures: false, verifySignatures: false })
          .toString('base64');
      }
    } catch (err) {
      this.logger.warn(`Failed to build withdraw tx, proceeding without: ${err}`);
    }

    return {
      positionId,
      amount: Number(withdrawAmount) / 1e6,
      token: position.token,
      transaction,
    };
  }

  /** Confirm a withdrawal after the user has signed the transaction. */
  async confirmWithdraw(walletAddress: string, positionId: string, signature: string) {
    const position = await this.prisma.$transaction(async (tx) => {
      // Check for signature replay — reject if already used
      const existingWithdraw = await tx.savingsPosition.findFirst({
        where: { withdrawTx: signature },
      });
      if (existingWithdraw) {
        throw new BadRequestException('Withdraw signature already used');
      }

      const pos = await tx.savingsPosition.findUnique({
        where: { id: positionId },
      });

      if (!pos || pos.walletAddress !== walletAddress) {
        throw new NotFoundException('Position not found');
      }

      if (pos.status !== 'WITHDRAWING') {
        throw new BadRequestException('Position is not in withdrawing state');
      }

      await tx.savingsPosition.update({
        where: { id: positionId },
        data: { status: 'CLOSED', withdrawTx: signature },
      });

      return pos;
    });

    // Log the transaction (outside tx — non-critical)
    await this.txLogger.log({
      walletAddress,
      type: 'TRANSFER',
      signature,
      amount: Number(position.currentAmount) / 1e6,
      token: position.token,
    });

    return { success: true };
  }

  /** Cron: Fetch and store yield rates every hour. */
  @Cron('0 * * * *') // Every hour at :00
  async snapshotYieldRates() {
    const lock = await this.cronLock.acquireLock('snapshot-yield-rates', 300_000);
    if (!lock) return;

    try {
      const rates = await this.kamino.getRates();

      // Get total deposits per protocol/token
      const totals = await this.prisma.savingsPosition.groupBy({
        by: ['protocol', 'token'],
        where: { status: 'ACTIVE' },
        _sum: { currentAmount: true },
      });

      const totalMap = new Map(
        totals.map((t) => [`${t.protocol}:${t.token}`, t._sum.currentAmount ?? 0n])
      );

      for (const rate of rates) {
        await this.prisma.yieldSnapshot.create({
          data: {
            protocol: rate.protocol,
            token: rate.token,
            supplyApy: rate.supplyApy,
            totalDeposits: totalMap.get(`${rate.protocol}:${rate.token}`) ?? 0n,
            totalYield: 0n, // Calculated separately
          },
        });
      }

      this.logger.log(
        `Yield snapshot: ${rates.map((r) => `${r.token}=${r.supplyApy.toFixed(2)}%`).join(', ')}`
      );
    } catch (err) {
      this.logger.error('Yield snapshot failed', err);
      Sentry.captureException(err, { tags: { job: 'yield-snapshot' } });
    } finally {
      await this.cronLock.releaseLock(lock);
    }
  }

  /** Cron: Clean up stale PENDING deposits older than 30 minutes. */
  @Cron('*/10 * * * *') // Every 10 minutes
  async cleanupStalePending() {
    const lock = await this.cronLock.acquireLock('cleanup-stale-pending', 60_000);
    if (!lock) return;

    try {
      const cutoff = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago

      const { count } = await this.prisma.savingsPosition.deleteMany({
        where: {
          status: 'PENDING',
          depositTx: null,
          createdAt: { lt: cutoff },
        },
      });

      if (count > 0) {
        this.logger.log(`Cleaned up ${count} stale PENDING deposit(s)`);
      }
    } catch (err) {
      this.logger.error('Stale PENDING cleanup failed', err);
      Sentry.captureException(err, { tags: { job: 'cleanup-stale-pending' } });
    } finally {
      await this.cronLock.releaseLock(lock);
    }
  }
}
