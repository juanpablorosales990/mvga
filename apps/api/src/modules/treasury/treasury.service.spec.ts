/* eslint-disable @typescript-eslint/no-explicit-any */
import { TreasuryService } from './treasury.service';

const MVGA_DECIMALS = 9;

describe('TreasuryService', () => {
  let service: TreasuryService;
  let mockPrisma: any;
  let mockCronLock: any;
  let mockConfig: any;
  let mockBurnService: any;
  let mockStakingService: any;

  beforeEach(() => {
    mockPrisma = {
      feeCollection: {
        create: jest.fn(),
        findMany: jest.fn(),
        aggregate: jest.fn(),
        updateMany: jest.fn(),
      },
      treasuryDistribution: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        aggregate: jest.fn(),
      },
      distributionStep: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      treasuryBalance: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      feeSnapshot: {
        create: jest.fn(),
      },
    };

    mockCronLock = {
      acquireLock: jest.fn(),
      releaseLock: jest.fn(),
    };

    mockConfig = {
      get: jest.fn((key: string, defaultVal?: string) => {
        if (key === 'MVGA_TOKEN_MINT') return 'DRX65kM2n5CLTpdjJCemZvkUwE98ou4RpHrd8Z3GH5Qh';
        if (key === 'USDC_MINT') return 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
        if (key === 'TREASURY_KEYPAIR') return undefined;
        return defaultVal;
      }),
    };

    mockBurnService = {
      executeBurn: jest.fn(),
    };

    mockStakingService = {
      getTotalStakeWeight: jest.fn(),
    };

    service = new TreasuryService(
      mockPrisma,
      mockCronLock,
      {} as any, // solana
      mockConfig,
      mockBurnService,
      mockStakingService
    );
  });

  describe('recordFee', () => {
    it('creates fee collection record', async () => {
      mockPrisma.feeCollection.create.mockResolvedValue({});
      await service.recordFee({
        source: 'SWAP',
        amount: '1000000000',
        token: 'MVGA',
        signature: 'sig1',
      } as any);

      expect(mockPrisma.feeCollection.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          source: 'SWAP',
          token: 'MVGA',
          signature: 'sig1',
        }),
      });
    });
  });

  describe('executeWeeklyDistribution', () => {
    it('skips if lock cannot be acquired', async () => {
      mockCronLock.acquireLock.mockResolvedValue(null);
      await service.executeWeeklyDistribution();
      expect(mockPrisma.treasuryDistribution.findFirst).not.toHaveBeenCalled();
    });

    it('skips when treasury keypair not configured', async () => {
      mockCronLock.acquireLock.mockResolvedValue('lock-1');
      await service.executeWeeklyDistribution();
      // Should skip gracefully and release lock
      expect(mockCronLock.releaseLock).toHaveBeenCalledWith('lock-1');
    });
  });

  describe('getTreasuryStats', () => {
    it('returns stats with no data', async () => {
      mockPrisma.treasuryBalance.findFirst.mockResolvedValue(null);
      mockPrisma.feeCollection.aggregate.mockResolvedValue({ _sum: { amount: null } });
      mockPrisma.treasuryDistribution.findFirst.mockResolvedValue(null);
      // Mock getLiveBalances to return zeros (no keypair)
      (service as any).getLiveBalances = jest.fn().mockResolvedValue({
        main: 0,
        liquidity: 0,
        staking: 0,
        grants: 0,
      });

      const stats = await service.getTreasuryStats();
      expect(stats.totalRevenue).toBe(0);
      expect(stats.pendingDistribution).toBe(0);
      expect(stats.lastDistributionAt).toBeNull();
      expect(stats.distributionBreakdown).toEqual({
        liquidityPercent: 40,
        stakingPercent: 40,
        grantsPercent: 20,
      });
      expect(stats.nextDistributionAt).toBeDefined();
    });

    it('returns correct pending distribution amount', async () => {
      mockPrisma.treasuryBalance.findFirst.mockResolvedValue(null);
      mockPrisma.feeCollection.aggregate.mockResolvedValue({
        _sum: { amount: BigInt(5000) * BigInt(10 ** MVGA_DECIMALS) },
      });
      mockPrisma.treasuryDistribution.findFirst.mockResolvedValue(null);
      (service as any).getLiveBalances = jest.fn().mockResolvedValue({
        main: 0,
        liquidity: 0,
        staking: 0,
        grants: 0,
      });

      const stats = await service.getTreasuryStats();
      expect(stats.pendingDistribution).toBe(5000);
    });
  });

  describe('getDistributionHistory', () => {
    it('returns empty array when no distributions', async () => {
      mockPrisma.treasuryDistribution.findMany.mockResolvedValue([]);
      expect(await service.getDistributionHistory()).toEqual([]);
    });

    it('maps distribution records correctly', async () => {
      const total = BigInt(10000) * BigInt(10 ** MVGA_DECIMALS);
      mockPrisma.treasuryDistribution.findMany.mockResolvedValue([
        {
          id: 'd1',
          totalAmount: total,
          burnAmount: (total * BigInt(5)) / BigInt(100),
          liquidityAmount: BigInt(0),
          stakingAmount: BigInt(0),
          grantsAmount: BigInt(0),
          swapFees: total,
          topupFees: BigInt(0),
          giftcardFees: BigInt(0),
          yieldEarnings: BigInt(0),
          status: 'COMPLETED',
          periodStart: new Date('2026-02-01'),
          periodEnd: new Date('2026-02-08'),
          executedAt: new Date('2026-02-08'),
          burnTx: 'burn-sig',
          liquidityTx: null,
          stakingTx: null,
          grantsTx: null,
        },
      ]);

      const history = await service.getDistributionHistory(5);
      expect(history).toHaveLength(1);
      expect(history[0].totalAmount).toBe(10000);
      expect(history[0].burnAmount).toBe(500);
      expect(history[0].transactions.burn).toBe('burn-sig');
      expect(history[0].sources.swapFees).toBe(10000);
    });
  });

  describe('triggerManualDistribution', () => {
    it('triggers distribution and returns success', async () => {
      mockPrisma.treasuryDistribution.findFirst.mockResolvedValue(null);
      mockCronLock.acquireLock.mockResolvedValue('lock-1');
      // No keypair, so it will skip the actual distribution

      const result = await service.triggerManualDistribution();
      expect(result).toEqual({ success: true, message: 'Distribution triggered' });
    });
  });
});
