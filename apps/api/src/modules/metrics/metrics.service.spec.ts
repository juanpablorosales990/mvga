/* eslint-disable @typescript-eslint/no-explicit-any */
import { MetricsService } from './metrics.service';

const MVGA_DECIMALS = 9;

describe('MetricsService', () => {
  let service: MetricsService;
  let mockPrisma: any;
  let mockCronLock: any;

  beforeEach(() => {
    mockPrisma = {
      stake: {
        aggregate: jest.fn(),
        groupBy: jest.fn(),
      },
      treasuryBalance: {
        findFirst: jest.fn(),
      },
      tokenBurn: {
        aggregate: jest.fn(),
      },
      transactionLog: {
        aggregate: jest.fn(),
        groupBy: jest.fn(),
      },
      feeCollection: {
        aggregate: jest.fn(),
      },
      user: {
        count: jest.fn(),
      },
      metricsSnapshot: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
    };

    mockCronLock = {
      acquireLock: jest.fn(),
      releaseLock: jest.fn(),
    };

    service = new MetricsService(mockPrisma, mockCronLock);
  });

  describe('takeSnapshot', () => {
    it('skips if lock cannot be acquired', async () => {
      mockCronLock.acquireLock.mockResolvedValue(null);
      await service.takeSnapshot();
      expect(mockPrisma.metricsSnapshot.create).not.toHaveBeenCalled();
    });

    it('creates snapshot and releases lock on success', async () => {
      mockCronLock.acquireLock.mockResolvedValue('lock-1');
      mockPrisma.stake.aggregate.mockResolvedValue({ _sum: { amount: BigInt(1000) } });
      mockPrisma.treasuryBalance.findFirst.mockResolvedValue({ liquidityWallet: BigInt(500) });
      mockPrisma.tokenBurn.aggregate.mockResolvedValue({ _sum: { amount: BigInt(100) } });
      mockPrisma.transactionLog.aggregate.mockResolvedValue({ _sum: { amount: BigInt(2000) } });
      mockPrisma.feeCollection.aggregate.mockResolvedValue({ _sum: { amount: BigInt(50) } });
      mockPrisma.user.count.mockResolvedValue(42);
      mockPrisma.transactionLog.groupBy.mockResolvedValue([
        { walletAddress: 'a' },
        { walletAddress: 'b' },
      ]);
      mockPrisma.stake.groupBy.mockResolvedValue([{ userId: 'u1' }]);
      mockPrisma.metricsSnapshot.create.mockResolvedValue({});

      await service.takeSnapshot();

      expect(mockPrisma.metricsSnapshot.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tvl: BigInt(1500),
          volume24h: BigInt(2000),
          revenue24h: BigInt(50),
          totalUsers: 42,
          activeUsers: 2,
          totalStakers: 1,
          totalBurned: BigInt(100),
        }),
      });
      expect(mockCronLock.releaseLock).toHaveBeenCalledWith('lock-1');
    });

    it('releases lock even on error', async () => {
      mockCronLock.acquireLock.mockResolvedValue('lock-1');
      mockPrisma.stake.aggregate.mockRejectedValue(new Error('db fail'));

      await service.takeSnapshot();
      expect(mockCronLock.releaseLock).toHaveBeenCalledWith('lock-1');
    });
  });

  describe('getLatestMetrics', () => {
    it('returns zeroes when no snapshot exists', async () => {
      mockPrisma.metricsSnapshot.findFirst.mockResolvedValue(null);
      const metrics = await service.getLatestMetrics();
      expect(metrics.tvl).toBe(0);
      expect(metrics.totalUsers).toBe(0);
      expect(metrics.snapshotAt).toBeNull();
    });

    it('converts bigint fields to numbers correctly', async () => {
      const tvl = BigInt(5_000_000) * BigInt(10 ** MVGA_DECIMALS);
      mockPrisma.metricsSnapshot.findFirst.mockResolvedValue({
        tvl,
        volume24h: BigInt(0),
        revenue24h: BigInt(0),
        totalUsers: 100,
        activeUsers: 20,
        totalStakers: 5,
        totalBurned: BigInt(0),
        snapshotAt: new Date('2026-02-08'),
      });

      const metrics = await service.getLatestMetrics();
      expect(metrics.tvl).toBe(5_000_000);
      expect(metrics.totalUsers).toBe(100);
      expect(metrics.snapshotAt).toBe('2026-02-08T00:00:00.000Z');
    });
  });

  describe('getMetricsHistory', () => {
    it('returns empty array when no snapshots', async () => {
      mockPrisma.metricsSnapshot.findMany.mockResolvedValue([]);
      expect(await service.getMetricsHistory('24h')).toEqual([]);
    });

    it('filters by correct period', async () => {
      mockPrisma.metricsSnapshot.findMany.mockResolvedValue([]);
      await service.getMetricsHistory('7d');

      const callArgs = mockPrisma.metricsSnapshot.findMany.mock.calls[0][0];
      const since = callArgs.where.snapshotAt.gte;
      const diffDays = (Date.now() - since.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeCloseTo(7, 0);
    });

    it('maps snapshot fields to numbers', async () => {
      mockPrisma.metricsSnapshot.findMany.mockResolvedValue([
        {
          tvl: BigInt(1000) * BigInt(10 ** MVGA_DECIMALS),
          volume24h: BigInt(0),
          revenue24h: BigInt(0),
          totalUsers: 10,
          activeUsers: 3,
          totalStakers: 1,
          totalBurned: BigInt(0),
          snapshotAt: new Date('2026-02-07'),
        },
      ]);

      const history = await service.getMetricsHistory();
      expect(history[0].tvl).toBe(1000);
      expect(history[0].snapshotAt).toBe('2026-02-07T00:00:00.000Z');
    });
  });
});
