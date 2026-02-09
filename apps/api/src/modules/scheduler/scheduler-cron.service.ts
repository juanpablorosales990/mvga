import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma.service';
import { CronLockService } from '../../common/cron-lock.service';
import { NotificationsService } from '../notifications/notifications.service';

const TOKEN_DECIMALS: Record<string, number> = {
  SOL: 9,
  USDC: 6,
  USDT: 6,
  MVGA: 9,
};

function formatAmount(amount: bigint, token: string): string {
  const decimals = TOKEN_DECIMALS[token] ?? 6;
  const str = amount.toString().padStart(decimals + 1, '0');
  const whole = str.slice(0, str.length - decimals) || '0';
  const fraction = str.slice(str.length - decimals);
  const trimmed = fraction.replace(/0+$/, '');
  return trimmed ? `${whole}.${trimmed}` : whole;
}

@Injectable()
export class SchedulerCronService {
  private readonly logger = new Logger(SchedulerCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cronLock: CronLockService,
    private readonly notifications: NotificationsService
  ) {}

  @Cron('0 * * * *') // Every hour
  async processScheduledOrders() {
    const lockId = await this.cronLock.acquireLock('process-scheduled-orders', 300_000);
    if (!lockId) {
      this.logger.debug('Scheduled orders: another instance holds the lock');
      return;
    }

    try {
      await this.checkRecurringPayments();
      await this.checkDCAOrders();
      await this.expireStaleExecutions();
    } catch (err) {
      this.logger.error('Error processing scheduled orders:', err);
    } finally {
      await this.cronLock.releaseLock(lockId);
    }
  }

  private async checkRecurringPayments() {
    const now = new Date();
    const duePayments = await this.prisma.recurringPayment.findMany({
      where: {
        status: 'ACTIVE',
        nextExecutionAt: { lte: now },
      },
    });

    for (const payment of duePayments) {
      // Idempotency: skip if pending execution already exists
      const existing = await this.prisma.scheduledExecution.findFirst({
        where: { paymentId: payment.id, status: 'PENDING' },
      });
      if (existing) continue;

      const execution = await this.prisma.scheduledExecution.create({
        data: {
          type: 'PAYMENT',
          paymentId: payment.id,
          status: 'PENDING',
          scheduledFor: payment.nextExecutionAt,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          notifiedAt: now,
        },
      });

      const amountStr = formatAmount(payment.amount, payment.token);
      const label = payment.recipientLabel || `${payment.recipientAddress.slice(0, 8)}...`;

      await this.notifications.sendToWallet(payment.walletAddress, {
        title: 'Pago recurrente listo',
        body: `Tu pago de ${amountStr} ${payment.token} a ${label} está listo para aprobar`,
        url: '/scheduled',
        tag: `scheduled-${execution.id}`,
      });

      this.logger.log(`Created execution ${execution.id} for payment ${payment.id}`);
    }
  }

  private async checkDCAOrders() {
    const now = new Date();
    const dueOrders = await this.prisma.dCAOrder.findMany({
      where: {
        status: 'ACTIVE',
        nextExecutionAt: { lte: now },
      },
    });

    for (const order of dueOrders) {
      const existing = await this.prisma.scheduledExecution.findFirst({
        where: { dcaId: order.id, status: 'PENDING' },
      });
      if (existing) continue;

      const execution = await this.prisma.scheduledExecution.create({
        data: {
          type: 'DCA',
          dcaId: order.id,
          status: 'PENDING',
          scheduledFor: order.nextExecutionAt,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          notifiedAt: now,
        },
      });

      const amountStr = formatAmount(order.inputAmount, order.inputToken);

      await this.notifications.sendToWallet(order.walletAddress, {
        title: 'DCA listo',
        body: `Gastar ${amountStr} ${order.inputToken} para comprar ${order.outputToken}`,
        url: '/scheduled',
        tag: `scheduled-${execution.id}`,
      });

      this.logger.log(`Created execution ${execution.id} for DCA ${order.id}`);
    }
  }

  private async expireStaleExecutions() {
    const now = new Date();
    const { count } = await this.prisma.scheduledExecution.updateMany({
      where: {
        status: 'PENDING',
        expiresAt: { lt: now },
      },
      data: { status: 'EXPIRED', updatedAt: now },
    });

    if (count > 0) {
      this.logger.log(`Expired ${count} stale execution(s)`);
    }
  }
}
