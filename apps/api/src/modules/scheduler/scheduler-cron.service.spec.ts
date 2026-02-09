/* eslint-disable @typescript-eslint/no-explicit-any */
import { SchedulerCronService } from './scheduler-cron.service';

describe('SchedulerCronService', () => {
  let service: SchedulerCronService;
  let prisma: any;
  let cronLock: any;
  let notifications: any;

  const WALLET = '7EqJj2FvNCqiTVJYwcqYgndNeCakBt9dZZpx53bfFu81';

  beforeEach(() => {
    prisma = {
      recurringPayment: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      dCAOrder: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      scheduledExecution: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'exec-001' }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    cronLock = {
      acquireLock: jest.fn().mockResolvedValue('lock-001'),
      releaseLock: jest.fn().mockResolvedValue(undefined),
    };

    notifications = {
      sendToWallet: jest.fn().mockResolvedValue(undefined),
    };

    service = new SchedulerCronService(prisma, cronLock, notifications);
  });

  describe('processScheduledOrders', () => {
    it('acquires lock before processing', async () => {
      await service.processScheduledOrders();

      expect(cronLock.acquireLock).toHaveBeenCalledWith('process-scheduled-orders', 300_000);
    });

    it('skips if lock cannot be acquired', async () => {
      cronLock.acquireLock.mockResolvedValue(null);

      await service.processScheduledOrders();

      expect(prisma.recurringPayment.findMany).not.toHaveBeenCalled();
      expect(prisma.dCAOrder.findMany).not.toHaveBeenCalled();
    });

    it('releases lock after processing', async () => {
      await service.processScheduledOrders();

      expect(cronLock.releaseLock).toHaveBeenCalledWith('lock-001');
    });

    it('releases lock even if processing fails', async () => {
      prisma.recurringPayment.findMany.mockRejectedValue(new Error('DB error'));

      await service.processScheduledOrders();

      expect(cronLock.releaseLock).toHaveBeenCalledWith('lock-001');
    });
  });

  describe('checkRecurringPayments (via processScheduledOrders)', () => {
    it('creates execution and sends notification for due payments', async () => {
      prisma.recurringPayment.findMany.mockResolvedValue([
        {
          id: 'pay-001',
          walletAddress: WALLET,
          recipientAddress: 'BrEAK7zGZ6dM71H6FNzfLqF3fYvRMXvZchEWe1YNqf2e',
          recipientLabel: 'Mom',
          token: 'USDC',
          amount: BigInt(10_000_000),
          nextExecutionAt: new Date(Date.now() - 60_000),
        },
      ]);

      await service.processScheduledOrders();

      expect(prisma.scheduledExecution.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'PAYMENT',
          paymentId: 'pay-001',
          status: 'PENDING',
        }),
      });

      expect(notifications.sendToWallet).toHaveBeenCalledWith(
        WALLET,
        expect.objectContaining({
          title: 'Pago recurrente listo',
          url: '/scheduled',
        })
      );
    });

    it('skips creating execution if one already exists (idempotency)', async () => {
      prisma.recurringPayment.findMany.mockResolvedValue([
        {
          id: 'pay-001',
          walletAddress: WALLET,
          token: 'USDC',
          amount: BigInt(10_000_000),
          nextExecutionAt: new Date(),
        },
      ]);

      prisma.scheduledExecution.findFirst.mockResolvedValue({
        id: 'exec-existing',
        status: 'PENDING',
      });

      await service.processScheduledOrders();

      expect(prisma.scheduledExecution.create).not.toHaveBeenCalled();
    });
  });

  describe('checkDCAOrders (via processScheduledOrders)', () => {
    it('creates execution and sends notification for due DCA orders', async () => {
      prisma.dCAOrder.findMany.mockResolvedValue([
        {
          id: 'dca-001',
          walletAddress: WALLET,
          inputToken: 'USDC',
          outputToken: 'SOL',
          inputAmount: BigInt(5_000_000),
          nextExecutionAt: new Date(Date.now() - 60_000),
        },
      ]);

      await service.processScheduledOrders();

      expect(prisma.scheduledExecution.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'DCA',
          dcaId: 'dca-001',
          status: 'PENDING',
        }),
      });

      expect(notifications.sendToWallet).toHaveBeenCalledWith(
        WALLET,
        expect.objectContaining({
          title: 'DCA listo',
        })
      );
    });

    it('skips DCA if pending execution already exists', async () => {
      prisma.dCAOrder.findMany.mockResolvedValue([
        {
          id: 'dca-001',
          walletAddress: WALLET,
          inputToken: 'USDC',
          outputToken: 'SOL',
          inputAmount: BigInt(5_000_000),
          nextExecutionAt: new Date(),
        },
      ]);

      // findFirst is only called for items in the loop — no recurring payments due,
      // so the only findFirst call is for the DCA order
      prisma.scheduledExecution.findFirst.mockResolvedValue({
        id: 'exec-existing',
        status: 'PENDING',
      });

      await service.processScheduledOrders();

      expect(prisma.scheduledExecution.create).not.toHaveBeenCalled();
    });
  });

  describe('expireStaleExecutions (via processScheduledOrders)', () => {
    it('marks expired pending executions', async () => {
      prisma.scheduledExecution.updateMany.mockResolvedValue({ count: 3 });

      await service.processScheduledOrders();

      expect(prisma.scheduledExecution.updateMany).toHaveBeenCalledWith({
        where: {
          status: 'PENDING',
          expiresAt: { lt: expect.any(Date) },
        },
        data: expect.objectContaining({
          status: 'EXPIRED',
        }),
      });
    });

    it('does nothing when no stale executions exist', async () => {
      await service.processScheduledOrders();

      expect(prisma.scheduledExecution.updateMany).toHaveBeenCalled();
      // count = 0 is fine, just verify it ran
    });
  });

  describe('notification content', () => {
    it('formats payment amount correctly in notification', async () => {
      prisma.recurringPayment.findMany.mockResolvedValue([
        {
          id: 'pay-001',
          walletAddress: WALLET,
          recipientAddress: 'BrEAK7zGZ6dM71H6FNzfLqF3fYvRMXvZchEWe1YNqf2e',
          recipientLabel: null,
          token: 'SOL',
          amount: BigInt(1_500_000_000), // 1.5 SOL
          nextExecutionAt: new Date(),
        },
      ]);

      await service.processScheduledOrders();

      expect(notifications.sendToWallet).toHaveBeenCalledWith(
        WALLET,
        expect.objectContaining({
          body: expect.stringContaining('1.5 SOL'),
        })
      );
    });

    it('uses recipient label in payment notification', async () => {
      prisma.recurringPayment.findMany.mockResolvedValue([
        {
          id: 'pay-001',
          walletAddress: WALLET,
          recipientAddress: 'BrEAK7zGZ6dM71H6FNzfLqF3fYvRMXvZchEWe1YNqf2e',
          recipientLabel: 'Mom',
          token: 'USDC',
          amount: BigInt(50_000_000),
          nextExecutionAt: new Date(),
        },
      ]);

      await service.processScheduledOrders();

      expect(notifications.sendToWallet).toHaveBeenCalledWith(
        WALLET,
        expect.objectContaining({
          body: expect.stringContaining('Mom'),
        })
      );
    });

    it('truncates address when no label provided', async () => {
      const addr = 'BrEAK7zGZ6dM71H6FNzfLqF3fYvRMXvZchEWe1YNqf2e';
      prisma.recurringPayment.findMany.mockResolvedValue([
        {
          id: 'pay-001',
          walletAddress: WALLET,
          recipientAddress: addr,
          recipientLabel: null,
          token: 'USDC',
          amount: BigInt(10_000_000),
          nextExecutionAt: new Date(),
        },
      ]);

      await service.processScheduledOrders();

      expect(notifications.sendToWallet).toHaveBeenCalledWith(
        WALLET,
        expect.objectContaining({
          body: expect.stringContaining('BrEAK7zG...'),
        })
      );
    });

    it('includes DCA token pair in notification', async () => {
      prisma.dCAOrder.findMany.mockResolvedValue([
        {
          id: 'dca-001',
          walletAddress: WALLET,
          inputToken: 'USDC',
          outputToken: 'SOL',
          inputAmount: BigInt(10_000_000),
          nextExecutionAt: new Date(),
        },
      ]);

      await service.processScheduledOrders();

      const call = notifications.sendToWallet.mock.calls[0];
      expect(call[1].body).toContain('USDC');
      expect(call[1].body).toContain('SOL');
    });
  });
});
