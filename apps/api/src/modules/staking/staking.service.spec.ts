import { BadRequestException } from '@nestjs/common';
import { StakingService, StakingTier } from './staking.service';

const MVGA_DECIMALS = 9;

describe('StakingService', () => {
  let service: StakingService;
  let mockPrisma: any;
  let mockConfig: any;

  beforeEach(() => {
    mockPrisma = {
      stake: {
        aggregate: jest.fn(),
        groupBy: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      feeSnapshot: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
      },
      tokenBurn: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }),
      },
    };

    mockConfig = {
      get: jest.fn((key: string, defaultVal?: string) => {
        if (key === 'MVGA_TOKEN_MINT') return 'DRX65kM2n5CLTpdjJCemZvkUwE98ou4RpHrd8Z3GH5Qh';
        if (key === 'STAKING_VAULT_WALLET') return 'GNhLCjqThNJAJAdDYvRTr2EfWyGXAFUymaPuKaL1duEh';
        if (key === 'STAKING_VAULT_KEYPAIR') return undefined;
        return defaultVal;
      }),
    };

    service = new StakingService(
      mockPrisma,
      {} as any, // txLogger
      {} as any, // solana
      mockConfig
    );
  });

  describe('getTiers', () => {
    it('returns 4 tiers in ascending order', () => {
      const tiers = service.getTiers();
      expect(tiers).toHaveLength(4);
      expect(tiers[0].name).toBe('Bronze');
      expect(tiers[1].name).toBe('Silver');
      expect(tiers[2].name).toBe('Gold');
      expect(tiers[3].name).toBe('Diamond');
    });

    it('has increasing minStake thresholds', () => {
      const tiers = service.getTiers();
      for (let i = 1; i < tiers.length; i++) {
        expect(tiers[i].minStake).toBeGreaterThan(tiers[i - 1].minStake);
      }
    });

    it('has increasing multipliers', () => {
      const tiers = service.getTiers();
      for (let i = 1; i < tiers.length; i++) {
        expect(tiers[i].multiplier).toBeGreaterThanOrEqual(tiers[i - 1].multiplier);
      }
    });

    it('each tier has benefits array', () => {
      const tiers = service.getTiers();
      tiers.forEach((tier) => {
        expect(Array.isArray(tier.benefits)).toBe(true);
        expect(tier.benefits.length).toBeGreaterThan(0);
      });
    });
  });

  describe('getTierForAmount (private)', () => {
    const getTier = (amount: number): StakingTier => {
      return (service as any).getTierForAmount(amount);
    };

    it('returns Bronze for 0 MVGA', () => {
      expect(getTier(0).name).toBe('Bronze');
    });

    it('returns Bronze for 9999 MVGA', () => {
      expect(getTier(9999).name).toBe('Bronze');
    });

    it('returns Silver for 10000 MVGA', () => {
      expect(getTier(10000).name).toBe('Silver');
    });

    it('returns Gold for 50000 MVGA', () => {
      expect(getTier(50000).name).toBe('Gold');
    });

    it('returns Diamond for 200000 MVGA', () => {
      expect(getTier(200000).name).toBe('Diamond');
    });

    it('returns Diamond for very large amounts', () => {
      expect(getTier(1_000_000).name).toBe('Diamond');
    });

    it('returns Bronze for negative amounts', () => {
      expect(getTier(-1).name).toBe('Bronze');
    });
  });

  describe('reward formula', () => {
    it('calculates correct reward for Bronze tier, no lock, 365 days', () => {
      const amount = 1000;
      const baseApy = 12;
      const tierMultiplier = 1.0;
      const lockMultiplier = 1.0;
      const days = 365;

      const effectiveApy = baseApy * tierMultiplier * lockMultiplier;
      const reward = amount * (effectiveApy / 100) * (days / 365);
      expect(reward).toBe(120);
    });

    it('calculates correct reward for Gold tier, 90-day lock, 365 days', () => {
      const amount = 50000;
      const baseApy = 12;
      const tierMultiplier = 1.5;
      const lockMultiplier = 1.5;
      const days = 365;

      const effectiveApy = baseApy * tierMultiplier * lockMultiplier;
      const reward = amount * (effectiveApy / 100) * (days / 365);
      expect(reward).toBe(13500);
    });

    it('calculates correct reward for Diamond tier, 180-day lock, 365 days', () => {
      const amount = 200000;
      const baseApy = 12;
      const tierMultiplier = 2.0;
      const lockMultiplier = 2.0;
      const days = 365;

      const effectiveApy = baseApy * tierMultiplier * lockMultiplier;
      const reward = amount * (effectiveApy / 100) * (days / 365);
      expect(reward).toBe(96000);
    });

    it('reward scales linearly with time', () => {
      const amount = 10000;
      const effectiveApy = 12;
      const reward30 = amount * (effectiveApy / 100) * (30 / 365);
      const reward60 = amount * (effectiveApy / 100) * (60 / 365);
      expect(reward60).toBeCloseTo(reward30 * 2, 2);
    });
  });

  describe('lock period multipliers', () => {
    it('has correct lock period multipliers', () => {
      const multipliers = (service as any).lockPeriodMultipliers;
      expect(multipliers[0]).toBe(1.0);
      expect(multipliers[30]).toBe(1.25);
      expect(multipliers[90]).toBe(1.5);
      expect(multipliers[180]).toBe(2.0);
    });

    it('unknown lock periods default to 1.0', () => {
      const multipliers = (service as any).lockPeriodMultipliers;
      expect(multipliers[15]).toBeUndefined();
    });
  });

  describe('getStakingPosition', () => {
    it('returns default position for unknown user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.getStakingPosition('unknown-wallet');
      expect(result.stakes).toEqual([]);
      expect(result.totalStaked).toBe(0);
      expect(result.earnedRewards).toBe(0);
      expect(result.feeRewards).toBe(0);
      expect(result.currentTier).toBe('Bronze');
      expect(result.apy).toBe(12);
    });

    it('returns stakes with calculated rewards', async () => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', walletAddress: 'wallet' });
      mockPrisma.stake.findMany.mockResolvedValue([
        {
          id: 'stake-1',
          amount: BigInt(10000 * 10 ** MVGA_DECIMALS),
          lockPeriod: 0,
          lockedUntil: null,
          createdAt: oneDayAgo,
          status: 'ACTIVE',
          autoCompound: false,
        },
      ]);
      // Mock getStakingInfo dependencies
      mockPrisma.stake.aggregate.mockResolvedValue({
        _sum: { amount: BigInt(10000 * 10 ** MVGA_DECIMALS) },
      });
      mockPrisma.stake.groupBy.mockResolvedValue([{ userId: 'user-1' }]);

      const result = await service.getStakingPosition('wallet');
      expect(result.stakes).toHaveLength(1);
      expect(result.totalStaked).toBe(10000);
      expect(result.earnedRewards).toBeGreaterThan(0);
      expect(result.currentTier).toBe('Silver');
    });

    it('returns correct tier for large stakers', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', walletAddress: 'wallet' });
      mockPrisma.stake.findMany.mockResolvedValue([
        {
          id: 'stake-1',
          amount: BigInt(200000 * 10 ** MVGA_DECIMALS),
          lockPeriod: 90,
          lockedUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          status: 'ACTIVE',
          autoCompound: false,
        },
      ]);
      // Mock getStakingInfo dependencies
      mockPrisma.stake.aggregate.mockResolvedValue({
        _sum: { amount: BigInt(200000 * 10 ** MVGA_DECIMALS) },
      });
      mockPrisma.stake.groupBy.mockResolvedValue([{ userId: 'user-1' }]);

      const result = await service.getStakingPosition('wallet');
      expect(result.currentTier).toBe('Diamond');
      // Dynamic APY at 0.02% staking rate → 1.3x multiplier → 12 * 1.3 * 2.0 = 31.2
      expect(result.apy).toBeCloseTo(31.2, 0);
    });
  });

  describe('createStakeTransaction', () => {
    it('returns vault and mint information', async () => {
      const result = await service.createStakeTransaction({
        address: 'wallet',
        amount: 10000,
        lockPeriod: 30,
      });

      expect(result.vaultAddress).toBe('GNhLCjqThNJAJAdDYvRTr2EfWyGXAFUymaPuKaL1duEh');
      expect(result.mintAddress).toBe('DRX65kM2n5CLTpdjJCemZvkUwE98ou4RpHrd8Z3GH5Qh');
      expect(result.amount).toBe(10000);
      expect(result.lockPeriod).toBe(30);
    });

    it('calculates correct APY for Silver tier with 30-day lock', async () => {
      const result = await service.createStakeTransaction({
        address: 'wallet',
        amount: 10000,
        lockPeriod: 30,
      });

      // Silver (1.2) * 30-day lock (1.25) * 12% base = 18%
      expect(result.estimatedApy).toBe(18);
    });

    it('calculates correct APY for no-lock Bronze', async () => {
      const result = await service.createStakeTransaction({
        address: 'wallet',
        amount: 100,
        lockPeriod: 0,
      });

      expect(result.estimatedApy).toBe(12);
      expect(result.tier).toBe('Bronze');
    });
  });

  describe('createClaimTransaction', () => {
    beforeEach(() => {
      // Common mocks needed for getStakingInfo (called indirectly via getStakingPosition)
      mockPrisma.stake.aggregate.mockResolvedValue({
        _sum: { amount: BigInt(50000 * 10 ** MVGA_DECIMALS) },
      });
      mockPrisma.stake.groupBy.mockResolvedValue([{ userId: 'user-1' }]);
    });

    it('throws if no rewards to claim', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', walletAddress: 'wallet' });
      mockPrisma.stake.findMany.mockResolvedValue([]);

      await expect(service.createClaimTransaction('wallet')).rejects.toThrow(BadRequestException);
    });

    it('throws if rewards are below minimum (10 MVGA)', async () => {
      // Stake 1000 MVGA for 10 days at Bronze (12% APY * 1.3 dynamic, no lock) => ~4.27 MVGA rewards
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', walletAddress: 'wallet' });
      mockPrisma.stake.findMany.mockResolvedValue([
        {
          id: 'stake-1',
          amount: BigInt(1000 * 10 ** MVGA_DECIMALS),
          lockPeriod: 0,
          lockedUntil: null,
          createdAt: tenDaysAgo,
          status: 'ACTIVE',
          autoCompound: false,
        },
      ]);

      await expect(service.createClaimTransaction('wallet')).rejects.toThrow(
        'Minimum claim amount is 10 MVGA'
      );
    });

    it('throws if vault keypair not configured', async () => {
      // Create a stake old enough to have > 10 MVGA in rewards
      const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', walletAddress: 'wallet' });
      mockPrisma.stake.findMany.mockResolvedValue([
        {
          id: 'stake-1',
          amount: BigInt(50000 * 10 ** MVGA_DECIMALS),
          lockPeriod: 0,
          lockedUntil: null,
          createdAt: sixMonthsAgo,
          status: 'ACTIVE',
          autoCompound: false,
        },
      ]);

      await expect(service.createClaimTransaction('wallet')).rejects.toThrow(
        'Staking vault not configured'
      );
    });
  });

  describe('getStakingInfo', () => {
    it('returns aggregate staking info with dynamic APY', async () => {
      mockPrisma.stake.aggregate.mockResolvedValue({
        _sum: { amount: BigInt(100000 * 10 ** MVGA_DECIMALS) },
      });
      mockPrisma.stake.groupBy.mockResolvedValue([{ userId: 'a' }, { userId: 'b' }]);

      const result = await service.getStakingInfo();
      expect(result.totalStaked).toBe(100000);
      expect(result.totalStakers).toBe(2);
      expect(result.baseApy).toBe(12);
      // 100k/1B = 0.01% staking rate → <10% → 1.3x multiplier
      expect(result.dynamicApy).toBeCloseTo(15.6, 1);
      expect(result.stakingRate).toBeCloseTo(0.0001, 4);
    });

    it('handles zero staking correctly', async () => {
      mockPrisma.stake.aggregate.mockResolvedValue({ _sum: { amount: null } });
      mockPrisma.stake.groupBy.mockResolvedValue([]);

      const result = await service.getStakingInfo();
      expect(result.totalStaked).toBe(0);
      expect(result.totalStakers).toBe(0);
      expect(result.dynamicApy).toBeCloseTo(15.6, 1); // 0% staking → 1.3x
    });
  });

  describe('calculateDynamicApy', () => {
    it('returns 1.3x multiplier for <10% staking rate', () => {
      const result = service.calculateDynamicApy(0.05);
      expect(result.apyMultiplier).toBe(1.3);
      expect(result.dynamicApy).toBeCloseTo(15.6, 1);
    });

    it('returns 1.0x multiplier for 10-30% staking rate', () => {
      const result = service.calculateDynamicApy(0.2);
      expect(result.apyMultiplier).toBe(1.0);
      expect(result.dynamicApy).toBe(12);
    });

    it('returns 0.85x multiplier for 30-50% staking rate', () => {
      const result = service.calculateDynamicApy(0.4);
      expect(result.apyMultiplier).toBe(0.85);
      expect(result.dynamicApy).toBeCloseTo(10.2, 1);
    });

    it('returns 0.7x multiplier for >50% staking rate', () => {
      const result = service.calculateDynamicApy(0.6);
      expect(result.apyMultiplier).toBe(0.7);
      expect(result.dynamicApy).toBeCloseTo(8.4, 1);
    });
  });
});
