import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma.service';
import { CronLockService } from '../../common/cron-lock.service';
import { P2PService } from './p2p.service';

@Injectable()
export class P2PTimeoutService {
  private readonly logger = new Logger(P2PTimeoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cronLockService: CronLockService,
    private readonly p2pService: P2PService
  ) {}

  @Cron('*/5 * * * *')
  async handleTradeTimeouts() {
    const lockId = await this.cronLockService.acquireLock('p2p-timeout', 300_000);
    if (!lockId) {
      this.logger.debug('P2P timeout: another instance holds the lock, skipping');
      return;
    }

    try {
      await this.runTimeoutSweep();
    } finally {
      await this.cronLockService.releaseLock(lockId);
    }
  }

  private async runTimeoutSweep() {
    const now = new Date();

    // 1. Auto-cancel PENDING trades older than 30 minutes
    const stalePending = await this.prisma.p2PTrade.findMany({
      where: {
        status: 'PENDING',
        createdAt: { lt: new Date(now.getTime() - 30 * 60 * 1000) },
      },
    });

    for (const trade of stalePending) {
      try {
        await this.prisma.p2PTrade.update({
          where: { id: trade.id },
          data: { status: 'CANCELLED' },
        });
        this.logger.log(`Auto-cancelled stale PENDING trade ${trade.id}`);
      } catch (e) {
        this.logger.error(`Failed to cancel trade ${trade.id}: ${(e as Error).message}`);
      }
    }

    // 2. Auto-cancel + refund ESCROW_LOCKED trades with no payment for 2 hours
    const staleEscrow = await this.prisma.p2PTrade.findMany({
      where: {
        status: 'ESCROW_LOCKED',
        createdAt: { lt: new Date(now.getTime() - 2 * 60 * 60 * 1000) },
      },
      include: { offer: true },
    });

    for (const trade of staleEscrow) {
      try {
        // Attempt automatic escrow refund
        if (trade.escrowTx) {
          try {
            await this.p2pService.refundEscrow(trade.id);
            await this.prisma.p2PTrade.update({
              where: { id: trade.id },
              data: { status: 'REFUNDED' },
            });
            this.logger.log(`Auto-refunded stale ESCROW_LOCKED trade ${trade.id}`);
            continue;
          } catch (refundErr) {
            this.logger.error(
              `Auto-refund failed for trade ${trade.id}: ${(refundErr as Error).message}`
            );
          }
        }
        // Fallback: cancel without refund (needs manual review)
        await this.prisma.p2PTrade.update({
          where: { id: trade.id },
          data: { status: 'CANCELLED' },
        });
        this.logger.log(
          `Auto-cancelled stale ESCROW_LOCKED trade ${trade.id} (refund failed, needs manual review)`
        );
      } catch (e) {
        this.logger.error(`Failed to process escrow trade ${trade.id}: ${(e as Error).message}`);
      }
    }

    // 3. Auto-dispute PAID trades where seller hasn't confirmed for 24 hours
    const stalePaid = await this.prisma.p2PTrade.findMany({
      where: {
        status: 'PAID',
        updatedAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
      },
    });

    for (const trade of stalePaid) {
      try {
        await this.prisma.p2PTrade.update({
          where: { id: trade.id },
          data: {
            status: 'DISPUTED',
            disputeReason: 'Auto-disputed: seller did not confirm payment within 24 hours',
          },
        });
        this.logger.log(`Auto-disputed stale PAID trade ${trade.id}`);
      } catch (e) {
        this.logger.error(`Failed to dispute trade ${trade.id}: ${(e as Error).message}`);
      }
    }

    const total = stalePending.length + staleEscrow.length + stalePaid.length;
    if (total > 0) {
      this.logger.log(
        `Timeout sweep: ${stalePending.length} cancelled, ${staleEscrow.length} escrow cancelled, ${stalePaid.length} disputed`
      );
    }
  }
}
