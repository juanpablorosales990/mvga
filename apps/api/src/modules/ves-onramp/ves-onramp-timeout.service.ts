import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma.service';
import { CronLockService } from '../../common/cron-lock.service';
import { VesOnrampService } from './ves-onramp.service';
import { VesOrderStatus } from '@prisma/client';

@Injectable()
export class VesOnrampTimeoutService {
  private readonly logger = new Logger(VesOnrampTimeoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cronLockService: CronLockService,
    private readonly vesOnrampService: VesOnrampService
  ) {}

  @Cron('*/5 * * * *')
  async handleOrderTimeouts() {
    const lockId = await this.cronLockService.acquireLock('ves-onramp-timeout', 300_000);
    if (!lockId) {
      this.logger.debug('VES timeout: another instance holds the lock, skipping');
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
    let cancelled = 0;
    let expired = 0;
    let refunded = 0;

    // 1. Auto-cancel PENDING orders past expiresAt (no VES sent, no escrow)
    const stalePending = await this.prisma.vesOrder.findMany({
      where: {
        status: 'PENDING',
        expiresAt: { lt: now },
      },
    });

    for (const order of stalePending) {
      try {
        const { count } = await this.prisma.vesOrder.updateMany({
          where: { id: order.id, status: 'PENDING' as VesOrderStatus },
          data: { status: 'CANCELLED' },
        });
        if (count > 0) {
          // Restore offer availability
          await this.prisma.vesOffer.update({
            where: { id: order.offerId },
            data: {
              availableUsdc: { increment: order.amountUsdc },
              status: 'ACTIVE',
            },
          });
          cancelled++;
          this.logger.log(`Auto-cancelled stale PENDING VES order ${order.id}`);
        }
      } catch (e) {
        this.logger.error(`Failed to cancel VES order ${order.id}: ${(e as Error).message}`);
      }
    }

    // 2. Auto-cancel + refund ESCROW_LOCKED orders past expiresAt (escrow locked but buyer never sent VES)
    const staleEscrow = await this.prisma.vesOrder.findMany({
      where: {
        status: 'ESCROW_LOCKED',
        expiresAt: { lt: now },
      },
    });

    for (const order of staleEscrow) {
      try {
        if (order.escrowTx) {
          try {
            await this.vesOnrampService.refundEscrow(order.id);
            refunded++;
            this.logger.log(`Auto-refunded stale ESCROW_LOCKED VES order ${order.id}`);
            continue;
          } catch (refundErr) {
            this.logger.error(
              `Auto-refund failed for VES order ${order.id}: ${(refundErr as Error).message}`
            );
          }
        }
        // Fallback: cancel (manual refund needed)
        await this.prisma.vesOrder.updateMany({
          where: { id: order.id, status: 'ESCROW_LOCKED' as VesOrderStatus },
          data: { status: 'CANCELLED' },
        });
        // Restore offer availability even on failed refund
        await this.prisma.vesOffer.update({
          where: { id: order.offerId },
          data: {
            availableUsdc: { increment: order.amountUsdc },
            status: 'ACTIVE',
          },
        });
        cancelled++;
        this.logger.log(
          `Auto-cancelled stale ESCROW_LOCKED VES order ${order.id} (refund failed, needs manual review)`
        );
      } catch (e) {
        this.logger.error(`Failed to process VES order ${order.id}: ${(e as Error).message}`);
      }
    }

    // 3. Expire PAYMENT_SENT orders past expiresAt — mark EXPIRED (don't auto-refund, user may have sent VES)
    const stalePaid = await this.prisma.vesOrder.findMany({
      where: {
        status: 'PAYMENT_SENT',
        expiresAt: { lt: now },
      },
    });

    for (const order of stalePaid) {
      try {
        const { count } = await this.prisma.vesOrder.updateMany({
          where: { id: order.id, status: 'PAYMENT_SENT' as VesOrderStatus },
          data: { status: 'EXPIRED' },
        });
        if (count > 0) {
          expired++;
          this.logger.log(`Expired PAYMENT_SENT VES order ${order.id} — needs LP review`);
        }
      } catch (e) {
        this.logger.error(`Failed to expire VES order ${order.id}: ${(e as Error).message}`);
      }
    }

    const total = cancelled + refunded + expired;
    if (total > 0) {
      this.logger.log(
        `VES timeout sweep: ${cancelled} cancelled, ${refunded} refunded, ${expired} expired`
      );
    }
  }
}
