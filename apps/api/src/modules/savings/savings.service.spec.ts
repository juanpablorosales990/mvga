/* eslint-disable @typescript-eslint/no-explicit-any */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SavingsService } from './savings.service';

describe('SavingsService', () => {
  let service: SavingsService;
  let mockPrisma: any;
  let mockTxLogger: any;
  let mockKamino: any;
  let mockCronLock: any;

  beforeEach(() => {
    mockPrisma = {
      savingsPosition: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      yieldSnapshot: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
      },
      $transaction: jest.fn((fn: any) => fn(mockPrisma)),
    };

    mockTxLogger = {
      log: jest.fn().mockResolvedValue(undefined),
      confirm: jest.fn().mockResolvedValue(undefined),
    };

    mockKamino = {
      getRates: jest
        .fn()
        .mockResolvedValue([{ protocol: 'KAMINO', token: 'USDC', supplyApy: 5.5 }]),
      buildDepositTx: jest.fn().mockResolvedValue({ instructions: [] }),
      buildWithdrawTx: jest.fn().mockResolvedValue({ instructions: [] }),
    };

    mockCronLock = {
      acquireLock: jest.fn().mockResolvedValue('lock-id'),
      releaseLock: jest.fn().mockResolvedValue(undefined),
    };

    service = new SavingsService(mockPrisma, mockTxLogger, mockKamino, mockCronLock);
  });

  describe('initiateDeposit', () => {
    it('creates position with PENDING status', async () => {
      mockPrisma.savingsPosition.create.mockResolvedValue({
        id: 'pos-1',
        walletAddress: 'wallet1',
        protocol: 'KAMINO',
        token: 'USDC',
        depositedAmount: 100000000n,
        currentAmount: 100000000n,
        status: 'PENDING',
      });

      const result = await service.initiateDeposit('wallet1', 100);

      expect(mockPrisma.savingsPosition.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'PENDING',
          walletAddress: 'wallet1',
          protocol: 'KAMINO',
          token: 'USDC',
        }),
      });
      expect(result.positionId).toBe('pos-1');
    });

    it('rejects zero amount', async () => {
      await expect(service.initiateDeposit('wallet1', 0)).rejects.toThrow(BadRequestException);
    });

    it('rejects negative amount', async () => {
      await expect(service.initiateDeposit('wallet1', -50)).rejects.toThrow(BadRequestException);
    });
  });

  describe('confirmDeposit', () => {
    it('activates a PENDING position and sets depositTx', async () => {
      const pendingPosition = {
        id: 'pos-1',
        walletAddress: 'wallet1',
        depositTx: null,
        status: 'PENDING',
        depositedAmount: 100000000n,
        token: 'USDC',
      };

      mockPrisma.savingsPosition.findFirst
        .mockResolvedValueOnce(null) // replay check
        .mockResolvedValueOnce(pendingPosition); // find pending
      mockPrisma.savingsPosition.update.mockResolvedValue({
        ...pendingPosition,
        depositTx: 'sig123',
        status: 'ACTIVE',
      });

      const result = await service.confirmDeposit('wallet1', 'sig123');

      expect(mockPrisma.savingsPosition.update).toHaveBeenCalledWith({
        where: { id: 'pos-1' },
        data: { depositTx: 'sig123', status: 'ACTIVE' },
      });
      expect(result.success).toBe(true);
    });

    it('rejects replayed signature', async () => {
      mockPrisma.savingsPosition.findFirst.mockResolvedValueOnce({
        id: 'existing',
        depositTx: 'sig123',
      });

      await expect(service.confirmDeposit('wallet1', 'sig123')).rejects.toThrow(
        BadRequestException
      );
    });

    it('throws if no PENDING position found', async () => {
      mockPrisma.savingsPosition.findFirst
        .mockResolvedValueOnce(null) // replay check
        .mockResolvedValueOnce(null); // no pending

      await expect(service.confirmDeposit('wallet1', 'sig456')).rejects.toThrow(NotFoundException);
    });

    it('does not match ACTIVE positions (only PENDING)', async () => {
      mockPrisma.savingsPosition.findFirst
        .mockResolvedValueOnce(null) // replay check
        .mockResolvedValueOnce(null); // findFirst with status: 'PENDING' returns null

      await expect(service.confirmDeposit('wallet1', 'sig789')).rejects.toThrow(NotFoundException);

      // Verify the query explicitly filters for PENDING
      expect(mockPrisma.savingsPosition.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'PENDING' }),
        })
      );
    });
  });

  describe('initiateWithdraw', () => {
    it('rejects withdraw on non-ACTIVE position', async () => {
      mockPrisma.savingsPosition.updateMany = jest.fn().mockResolvedValue({ count: 0 });
      mockPrisma.savingsPosition.findUnique.mockResolvedValue({
        id: 'pos-1',
        walletAddress: 'wallet1',
        status: 'PENDING',
        currentAmount: 100000000n,
      });

      await expect(service.initiateWithdraw('wallet1', 'pos-1')).rejects.toThrow(
        BadRequestException
      );
    });

    it('rejects withdraw from wrong wallet', async () => {
      mockPrisma.savingsPosition.updateMany = jest.fn().mockResolvedValue({ count: 0 });
      mockPrisma.savingsPosition.findUnique.mockResolvedValue({
        id: 'pos-1',
        walletAddress: 'other-wallet',
        status: 'ACTIVE',
        currentAmount: 100000000n,
      });

      await expect(service.initiateWithdraw('wallet1', 'pos-1')).rejects.toThrow(NotFoundException);
    });

    it('allows full withdrawal on ACTIVE position', async () => {
      mockPrisma.savingsPosition.updateMany = jest.fn().mockResolvedValue({ count: 1 });
      mockPrisma.savingsPosition.findUnique.mockResolvedValue({
        id: 'pos-1',
        walletAddress: 'wallet1',
        status: 'WITHDRAWING',
        currentAmount: 100000000n,
        token: 'USDC',
      });

      const result = await service.initiateWithdraw('wallet1', 'pos-1');
      expect(result.amount).toBe(100);
      expect(mockPrisma.savingsPosition.updateMany).toHaveBeenCalledWith({
        where: { id: 'pos-1', walletAddress: 'wallet1', status: 'ACTIVE' },
        data: { status: 'WITHDRAWING' },
      });
    });
  });

  describe('confirmWithdraw', () => {
    it('closes position and sets withdrawTx', async () => {
      mockPrisma.savingsPosition.findFirst.mockResolvedValue(null); // replay check
      mockPrisma.savingsPosition.findUnique.mockResolvedValue({
        id: 'pos-1',
        walletAddress: 'wallet1',
        status: 'WITHDRAWING',
        currentAmount: 100000000n,
        token: 'USDC',
      });
      mockPrisma.savingsPosition.update.mockResolvedValue({});

      const result = await service.confirmWithdraw('wallet1', 'pos-1', 'sig-w1');
      expect(result.success).toBe(true);
      expect(mockPrisma.savingsPosition.update).toHaveBeenCalledWith({
        where: { id: 'pos-1' },
        data: { status: 'CLOSED', withdrawTx: 'sig-w1' },
      });
    });

    it('rejects replayed withdraw signature', async () => {
      mockPrisma.savingsPosition.findFirst.mockResolvedValue({
        id: 'existing',
        withdrawTx: 'sig-w1',
      });

      await expect(service.confirmWithdraw('wallet1', 'pos-1', 'sig-w1')).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('cleanupStalePending', () => {
    it('deletes PENDING positions older than 30 minutes', async () => {
      mockPrisma.savingsPosition.deleteMany.mockResolvedValue({ count: 3 });

      await service.cleanupStalePending();

      expect(mockPrisma.savingsPosition.deleteMany).toHaveBeenCalledWith({
        where: {
          status: 'PENDING',
          depositTx: null,
          createdAt: { lt: expect.any(Date) },
        },
      });
      expect(mockCronLock.releaseLock).toHaveBeenCalledWith('lock-id');
    });

    it('skips if lock not acquired', async () => {
      mockCronLock.acquireLock.mockResolvedValue(null);

      await service.cleanupStalePending();

      expect(mockPrisma.savingsPosition.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('getPositions', () => {
    it('returns PENDING and ACTIVE positions (excludes CLOSED)', async () => {
      mockPrisma.savingsPosition.findMany.mockResolvedValue([
        {
          id: 'p1',
          protocol: 'KAMINO',
          token: 'USDC',
          depositedAmount: 100000000n,
          currentAmount: 100000000n,
          status: 'PENDING',
          createdAt: new Date(),
        },
        {
          id: 'p2',
          protocol: 'KAMINO',
          token: 'USDC',
          depositedAmount: 200000000n,
          currentAmount: 210000000n,
          status: 'ACTIVE',
          createdAt: new Date(),
        },
      ]);

      const result = await service.getPositions('wallet1');

      expect(result.positions).toHaveLength(2);
      expect(result.positions[0].status).toBe('PENDING');
      expect(result.positions[1].status).toBe('ACTIVE');
      expect(mockPrisma.savingsPosition.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { walletAddress: 'wallet1', status: { notIn: ['CLOSED'] } },
        })
      );
    });
  });
});
