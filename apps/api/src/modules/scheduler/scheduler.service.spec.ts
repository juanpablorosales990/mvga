/* eslint-disable @typescript-eslint/no-explicit-any */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';

const WALLET = '7EqJj2FvNCqiTVJYwcqYgndNeCakBt9dZZpx53bfFu81';
const OTHER_WALLET = 'BrEAK7zGZ6dM71H6FNzfLqF3fYvRMXvZchEWe1YNqf2e';
const PAYMENT_ID = 'pay-001';
const DCA_ID = 'dca-001';
const EXEC_ID = 'exec-001';

function mockPayment(overrides: any = {}) {
  return {
    id: PAYMENT_ID,
    walletAddress: WALLET,
    recipientAddress: OTHER_WALLET,
    recipientLabel: 'Mom',
    token: 'USDC',
    amount: BigInt(10_000_000), // 10 USDC
    frequency: 'WEEKLY',
    status: 'ACTIVE',
    nextExecutionAt: new Date(),
    ...overrides,
  };
}

function mockDCAOrder(overrides: any = {}) {
  return {
    id: DCA_ID,
    walletAddress: WALLET,
    inputToken: 'USDC',
    outputToken: 'SOL',
    inputAmount: BigInt(5_000_000),
    frequency: 'WEEKLY',
    status: 'ACTIVE',
    slippageBps: 50,
    totalSpent: BigInt(0),
    totalReceived: BigInt(0),
    executionCount: 0,
    nextExecutionAt: new Date(),
    ...overrides,
  };
}

function mockExecution(overrides: any = {}) {
  return {
    id: EXEC_ID,
    type: 'PAYMENT',
    paymentId: PAYMENT_ID,
    dcaId: null,
    status: 'PENDING',
    scheduledFor: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    payment: mockPayment(),
    dca: null,
    ...overrides,
  };
}

describe('SchedulerService', () => {
  let service: SchedulerService;
  let prisma: any;
  let swapService: any;
  let solanaService: any;

  beforeEach(() => {
    prisma = {
      recurringPayment: {
        create: jest.fn().mockResolvedValue(mockPayment()),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(mockPayment()),
        update: jest.fn().mockResolvedValue(mockPayment()),
      },
      dCAOrder: {
        create: jest.fn().mockResolvedValue(mockDCAOrder()),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(mockDCAOrder()),
        update: jest.fn().mockResolvedValue(mockDCAOrder()),
      },
      scheduledExecution: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(mockExecution()),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(mockExecution()),
        update: jest.fn().mockResolvedValue(mockExecution()),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    swapService = {
      getQuote: jest.fn().mockResolvedValue({
        inAmount: '5000000',
        outAmount: '50000000',
        priceImpactPct: '0.01',
      }),
      getSwapTransaction: jest.fn().mockResolvedValue({
        swapTransaction: 'base64-encoded-tx',
      }),
    };

    solanaService = {
      getConnection: jest.fn().mockReturnValue({
        getParsedTransaction: jest.fn().mockResolvedValue({
          meta: { err: null },
          transaction: {
            message: {
              accountKeys: [{ pubkey: { toBase58: () => WALLET } }],
            },
          },
        }),
      }),
    };

    service = new SchedulerService(prisma, swapService, solanaService);
  });

  // ── Recurring Payments ──────────────────────────────────────────────

  describe('createRecurringPayment', () => {
    const dto = {
      recipientAddress: OTHER_WALLET,
      token: 'USDC',
      amount: 10,
      frequency: 'WEEKLY',
    } as any;

    it('creates a recurring payment with correct smallest-unit conversion', async () => {
      await service.createRecurringPayment(WALLET, dto);

      expect(prisma.recurringPayment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          walletAddress: WALLET,
          recipientAddress: OTHER_WALLET,
          token: 'USDC',
          amount: BigInt(10_000_000), // 10 USDC = 10 * 10^6
          frequency: 'WEEKLY',
        }),
      });
    });

    it('rejects payment to self', async () => {
      await expect(
        service.createRecurringPayment(WALLET, { ...dto, recipientAddress: WALLET })
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects unsupported token', async () => {
      await expect(
        service.createRecurringPayment(WALLET, { ...dto, token: 'BONK' })
      ).rejects.toThrow(BadRequestException);
    });

    it('correctly converts SOL amount (9 decimals)', async () => {
      await service.createRecurringPayment(WALLET, {
        ...dto,
        token: 'SOL',
        amount: 1.5,
      });

      expect(prisma.recurringPayment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          amount: BigInt(1_500_000_000),
        }),
      });
    });

    it('correctly converts MVGA amount (9 decimals)', async () => {
      await service.createRecurringPayment(WALLET, {
        ...dto,
        token: 'MVGA',
        amount: 100,
      });

      expect(prisma.recurringPayment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          amount: BigInt(100_000_000_000),
        }),
      });
    });

    it('stores optional memo and recipientLabel', async () => {
      await service.createRecurringPayment(WALLET, {
        ...dto,
        recipientLabel: 'Mom',
        memo: 'Monthly rent',
      });

      expect(prisma.recurringPayment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          recipientLabel: 'Mom',
          memo: 'Monthly rent',
        }),
      });
    });

    it('sets nextExecutionAt in the future', async () => {
      await service.createRecurringPayment(WALLET, dto);

      const call = prisma.recurringPayment.create.mock.calls[0][0];
      expect(call.data.nextExecutionAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('getRecurringPayments', () => {
    it('queries by wallet and includes executions', async () => {
      await service.getRecurringPayments(WALLET, 'ACTIVE');

      expect(prisma.recurringPayment.findMany).toHaveBeenCalledWith({
        where: { walletAddress: WALLET, status: 'ACTIVE' },
        include: { executions: { orderBy: { createdAt: 'desc' }, take: 10 } },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('omits status filter when not provided', async () => {
      await service.getRecurringPayments(WALLET);

      expect(prisma.recurringPayment.findMany).toHaveBeenCalledWith({
        where: { walletAddress: WALLET },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('pauseRecurringPayment', () => {
    it('pauses an active payment', async () => {
      await service.pauseRecurringPayment(WALLET, PAYMENT_ID);

      expect(prisma.recurringPayment.update).toHaveBeenCalledWith({
        where: { id: PAYMENT_ID },
        data: { status: 'PAUSED' },
      });
    });

    it('rejects pausing a non-active payment', async () => {
      prisma.recurringPayment.findUnique.mockResolvedValue(mockPayment({ status: 'PAUSED' }));

      await expect(service.pauseRecurringPayment(WALLET, PAYMENT_ID)).rejects.toThrow(
        BadRequestException
      );
    });

    it('rejects if payment belongs to different wallet', async () => {
      prisma.recurringPayment.findUnique.mockResolvedValue(
        mockPayment({ walletAddress: OTHER_WALLET })
      );

      await expect(service.pauseRecurringPayment(WALLET, PAYMENT_ID)).rejects.toThrow(
        NotFoundException
      );
    });

    it('rejects if payment not found', async () => {
      prisma.recurringPayment.findUnique.mockResolvedValue(null);

      await expect(service.pauseRecurringPayment(WALLET, 'nonexistent')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('resumeRecurringPayment', () => {
    it('resumes a paused payment with new nextExecutionAt', async () => {
      prisma.recurringPayment.findUnique.mockResolvedValue(mockPayment({ status: 'PAUSED' }));

      await service.resumeRecurringPayment(WALLET, PAYMENT_ID);

      expect(prisma.recurringPayment.update).toHaveBeenCalledWith({
        where: { id: PAYMENT_ID },
        data: {
          status: 'ACTIVE',
          nextExecutionAt: expect.any(Date),
        },
      });
    });

    it('rejects resuming an active payment', async () => {
      await expect(service.resumeRecurringPayment(WALLET, PAYMENT_ID)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('cancelRecurringPayment', () => {
    it('cancels a payment', async () => {
      await service.cancelRecurringPayment(WALLET, PAYMENT_ID);

      expect(prisma.recurringPayment.update).toHaveBeenCalledWith({
        where: { id: PAYMENT_ID },
        data: { status: 'CANCELLED' },
      });
    });
  });

  // ── DCA Orders ──────────────────────────────────────────────────────

  describe('createDCAOrder', () => {
    const dto = {
      inputToken: 'USDC',
      outputToken: 'SOL',
      amount: 5,
      frequency: 'WEEKLY',
    } as any;

    it('creates a DCA order with correct conversion', async () => {
      await service.createDCAOrder(WALLET, dto);

      expect(prisma.dCAOrder.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          walletAddress: WALLET,
          inputToken: 'USDC',
          outputToken: 'SOL',
          inputAmount: BigInt(5_000_000),
          frequency: 'WEEKLY',
          slippageBps: 50,
        }),
      });
    });

    it('rejects same input and output token', async () => {
      await expect(service.createDCAOrder(WALLET, { ...dto, outputToken: 'USDC' })).rejects.toThrow(
        BadRequestException
      );
    });

    it('rejects unsupported input token', async () => {
      await expect(service.createDCAOrder(WALLET, { ...dto, inputToken: 'BONK' })).rejects.toThrow(
        BadRequestException
      );
    });

    it('rejects unsupported output token', async () => {
      await expect(service.createDCAOrder(WALLET, { ...dto, outputToken: 'BONK' })).rejects.toThrow(
        BadRequestException
      );
    });

    it('uses custom slippageBps when provided', async () => {
      await service.createDCAOrder(WALLET, { ...dto, slippageBps: 100 });

      expect(prisma.dCAOrder.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          slippageBps: 100,
        }),
      });
    });
  });

  describe('pauseDCAOrder', () => {
    it('pauses an active DCA order', async () => {
      await service.pauseDCAOrder(WALLET, DCA_ID);

      expect(prisma.dCAOrder.update).toHaveBeenCalledWith({
        where: { id: DCA_ID },
        data: { status: 'PAUSED' },
      });
    });

    it('rejects pausing a non-active order', async () => {
      prisma.dCAOrder.findUnique.mockResolvedValue(mockDCAOrder({ status: 'CANCELLED' }));

      await expect(service.pauseDCAOrder(WALLET, DCA_ID)).rejects.toThrow(BadRequestException);
    });
  });

  describe('resumeDCAOrder', () => {
    it('resumes a paused DCA order with new nextExecutionAt', async () => {
      prisma.dCAOrder.findUnique.mockResolvedValue(mockDCAOrder({ status: 'PAUSED' }));

      await service.resumeDCAOrder(WALLET, DCA_ID);

      expect(prisma.dCAOrder.update).toHaveBeenCalledWith({
        where: { id: DCA_ID },
        data: {
          status: 'ACTIVE',
          nextExecutionAt: expect.any(Date),
        },
      });
    });

    it('rejects resuming an active order', async () => {
      await expect(service.resumeDCAOrder(WALLET, DCA_ID)).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancelDCAOrder', () => {
    it('cancels a DCA order', async () => {
      await service.cancelDCAOrder(WALLET, DCA_ID);

      expect(prisma.dCAOrder.update).toHaveBeenCalledWith({
        where: { id: DCA_ID },
        data: { status: 'CANCELLED' },
      });
    });

    it('rejects if order belongs to other wallet', async () => {
      prisma.dCAOrder.findUnique.mockResolvedValue(mockDCAOrder({ walletAddress: OTHER_WALLET }));

      await expect(service.cancelDCAOrder(WALLET, DCA_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ── Executions ──────────────────────────────────────────────────────

  describe('getPendingExecutions', () => {
    it('merges payment and DCA executions sorted by scheduledFor', async () => {
      const earlyDate = new Date('2026-01-01');
      const lateDate = new Date('2026-01-02');

      prisma.scheduledExecution.findMany
        .mockResolvedValueOnce([{ ...mockExecution(), scheduledFor: lateDate }])
        .mockResolvedValueOnce([
          {
            ...mockExecution({ type: 'DCA', dcaId: DCA_ID, paymentId: null }),
            scheduledFor: earlyDate,
          },
        ]);

      const result = await service.getPendingExecutions(WALLET);

      expect(result).toHaveLength(2);
      expect(result[0].scheduledFor).toEqual(earlyDate);
      expect(result[1].scheduledFor).toEqual(lateDate);
    });
  });

  describe('getExecution', () => {
    it('returns execution for correct wallet', async () => {
      const exec = await service.getExecution(WALLET, EXEC_ID);
      expect(exec.id).toBe(EXEC_ID);
    });

    it('throws if execution not found', async () => {
      prisma.scheduledExecution.findUnique.mockResolvedValue(null);

      await expect(service.getExecution(WALLET, 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('throws if wallet does not match', async () => {
      await expect(service.getExecution(OTHER_WALLET, EXEC_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('completeExecution', () => {
    const dto = {
      signature: 'abc123def456abc123def456abc123def456abc123def456abc123def456abc1234',
    };

    it('completes a pending payment execution', async () => {
      await service.completeExecution(WALLET, EXEC_ID, dto);

      expect(prisma.scheduledExecution.updateMany).toHaveBeenCalledWith({
        where: { id: EXEC_ID, status: 'PENDING' },
        data: expect.objectContaining({
          status: 'COMPLETED',
          signature: dto.signature,
        }),
      });

      // Advances parent payment
      expect(prisma.recurringPayment.update).toHaveBeenCalledWith({
        where: { id: PAYMENT_ID },
        data: expect.objectContaining({
          lastExecutedAt: expect.any(Date),
          nextExecutionAt: expect.any(Date),
        }),
      });
    });

    it('completes a DCA execution and updates stats', async () => {
      const dcaExec = mockExecution({
        type: 'DCA',
        paymentId: null,
        dcaId: DCA_ID,
        payment: null,
        dca: mockDCAOrder(),
      });
      prisma.scheduledExecution.findUnique.mockResolvedValue(dcaExec);

      await service.completeExecution(WALLET, EXEC_ID, {
        ...dto,
        outputAmount: '50000000',
      });

      expect(prisma.dCAOrder.update).toHaveBeenCalledWith({
        where: { id: DCA_ID },
        data: expect.objectContaining({
          executionCount: { increment: 1 },
          totalSpent: { increment: BigInt(5_000_000) },
          totalReceived: { increment: BigInt(50_000_000) },
        }),
      });
    });

    it('rejects non-pending execution', async () => {
      prisma.scheduledExecution.findUnique.mockResolvedValue(
        mockExecution({ status: 'COMPLETED' })
      );

      await expect(service.completeExecution(WALLET, EXEC_ID, dto)).rejects.toThrow(
        BadRequestException
      );
    });

    it('rejects expired execution', async () => {
      prisma.scheduledExecution.findUnique.mockResolvedValue(
        mockExecution({ expiresAt: new Date(Date.now() - 1000) })
      );

      await expect(service.completeExecution(WALLET, EXEC_ID, dto)).rejects.toThrow(
        BadRequestException
      );
    });

    it('rejects if tx not found on-chain', async () => {
      solanaService.getConnection().getParsedTransaction.mockResolvedValue(null);

      await expect(service.completeExecution(WALLET, EXEC_ID, dto)).rejects.toThrow(
        BadRequestException
      );
    });

    it('rejects if tx failed on-chain', async () => {
      solanaService.getConnection().getParsedTransaction.mockResolvedValue({
        meta: { err: 'InsufficientFunds' },
        transaction: {
          message: { accountKeys: [{ pubkey: { toBase58: () => WALLET } }] },
        },
      });

      await expect(service.completeExecution(WALLET, EXEC_ID, dto)).rejects.toThrow(
        BadRequestException
      );
    });

    it('rejects if tx signer does not match wallet', async () => {
      solanaService.getConnection().getParsedTransaction.mockResolvedValue({
        meta: { err: null },
        transaction: {
          message: {
            accountKeys: [{ pubkey: { toBase58: () => OTHER_WALLET } }],
          },
        },
      });

      await expect(service.completeExecution(WALLET, EXEC_ID, dto)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('skipExecution', () => {
    it('marks execution as skipped and advances payment', async () => {
      await service.skipExecution(WALLET, EXEC_ID);

      expect(prisma.scheduledExecution.update).toHaveBeenCalledWith({
        where: { id: EXEC_ID },
        data: { status: 'SKIPPED' },
      });

      expect(prisma.recurringPayment.update).toHaveBeenCalledWith({
        where: { id: PAYMENT_ID },
        data: { nextExecutionAt: expect.any(Date) },
      });
    });

    it('advances DCA order on skip', async () => {
      prisma.scheduledExecution.findUnique.mockResolvedValue(
        mockExecution({
          type: 'DCA',
          paymentId: null,
          dcaId: DCA_ID,
          payment: null,
          dca: mockDCAOrder(),
        })
      );

      await service.skipExecution(WALLET, EXEC_ID);

      expect(prisma.dCAOrder.update).toHaveBeenCalledWith({
        where: { id: DCA_ID },
        data: { nextExecutionAt: expect.any(Date) },
      });
    });

    it('rejects skipping non-pending execution', async () => {
      prisma.scheduledExecution.findUnique.mockResolvedValue(
        mockExecution({ status: 'COMPLETED' })
      );

      await expect(service.skipExecution(WALLET, EXEC_ID)).rejects.toThrow(BadRequestException);
    });
  });

  describe('buildDCASwapTransaction', () => {
    it('calls swap service with correct parameters', async () => {
      const dcaExec = mockExecution({
        type: 'DCA',
        paymentId: null,
        dcaId: DCA_ID,
        payment: null,
        dca: mockDCAOrder(),
      });
      prisma.scheduledExecution.findUnique.mockResolvedValue(dcaExec);

      const result = await service.buildDCASwapTransaction(WALLET, EXEC_ID);

      expect(swapService.getQuote).toHaveBeenCalledWith({
        inputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        outputMint: 'So11111111111111111111111111111111111111112',
        amount: 5_000_000,
        slippageBps: 50,
      });

      expect(swapService.getSwapTransaction).toHaveBeenCalledWith({
        quoteResponse: expect.any(Object),
        userPublicKey: WALLET,
      });

      expect(result.swapTransaction).toBe('base64-encoded-tx');
      expect(result.quote).toEqual({
        inputAmount: '5000000',
        outputAmount: '50000000',
        priceImpact: '0.01',
      });
    });

    it('rejects if execution is not DCA type', async () => {
      // Default mock is PAYMENT type
      await expect(service.buildDCASwapTransaction(WALLET, EXEC_ID)).rejects.toThrow(
        BadRequestException
      );
    });

    it('rejects if execution is not pending', async () => {
      prisma.scheduledExecution.findUnique.mockResolvedValue(
        mockExecution({
          type: 'DCA',
          dcaId: DCA_ID,
          paymentId: null,
          status: 'COMPLETED',
          dca: mockDCAOrder(),
          payment: null,
        })
      );

      await expect(service.buildDCASwapTransaction(WALLET, EXEC_ID)).rejects.toThrow(
        BadRequestException
      );
    });
  });
});
