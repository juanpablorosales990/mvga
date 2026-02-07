/* eslint-disable @typescript-eslint/no-explicit-any */
import { TiersService } from './tiers.service';

describe('TiersService', () => {
  let service: TiersService;
  let prismaService: any;

  beforeEach(() => {
    prismaService = {
      stake: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    service = new TiersService(prismaService);
  });

  describe('getTiers', () => {
    it('returns all 4 tier definitions', () => {
      const tiers = service.getTiers();
      expect(tiers).toHaveLength(4);
      expect(tiers.map((t) => t.name)).toEqual(['Bronze', 'Silver', 'Gold', 'Diamond']);
    });

    it('tiers have correct minimum stakes', () => {
      const tiers = service.getTiers();
      expect(tiers[0].minStake).toBe(0);
      expect(tiers[1].minStake).toBe(10_000);
      expect(tiers[2].minStake).toBe(50_000);
      expect(tiers[3].minStake).toBe(200_000);
    });

    it('tiers have increasing multipliers', () => {
      const tiers = service.getTiers();
      for (let i = 1; i < tiers.length; i++) {
        expect(tiers[i].multiplier).toBeGreaterThan(tiers[i - 1].multiplier);
      }
    });

    it('tiers have increasing cashback rates', () => {
      const tiers = service.getTiers();
      for (let i = 1; i < tiers.length; i++) {
        expect(tiers[i].cashbackRate).toBeGreaterThanOrEqual(tiers[i - 1].cashbackRate);
      }
    });
  });

  describe('getTierForAmount', () => {
    it('returns Bronze for 0 staked', () => {
      expect(service.getTierForAmount(0).name).toBe('Bronze');
    });

    it('returns Bronze for 9,999 staked', () => {
      expect(service.getTierForAmount(9_999).name).toBe('Bronze');
    });

    it('returns Silver for exactly 10,000 staked', () => {
      expect(service.getTierForAmount(10_000).name).toBe('Silver');
    });

    it('returns Gold for 50,000 staked', () => {
      expect(service.getTierForAmount(50_000).name).toBe('Gold');
    });

    it('returns Diamond for 200,000+ staked', () => {
      expect(service.getTierForAmount(200_000).name).toBe('Diamond');
      expect(service.getTierForAmount(1_000_000).name).toBe('Diamond');
    });
  });

  describe('getNextTier', () => {
    it('returns Silver as next tier for Bronze', () => {
      const bronze = service.getTierForAmount(0);
      const next = service.getNextTier(bronze);
      expect(next?.name).toBe('Silver');
    });

    it('returns null for Diamond (highest tier)', () => {
      const diamond = service.getTierForAmount(200_000);
      expect(service.getNextTier(diamond)).toBeNull();
    });
  });

  describe('getUserTier', () => {
    it('returns Bronze for user with no stakes', async () => {
      prismaService.stake.findMany.mockResolvedValue([]);
      const result = await service.getUserTier('some-address');
      expect(result.tier.name).toBe('Bronze');
      expect(result.totalStaked).toBe(0);
      expect(result.nextTier?.name).toBe('Silver');
      expect(result.amountToNextTier).toBe(10_000);
    });

    it('returns Silver for user with 15,000 staked', async () => {
      prismaService.stake.findMany.mockResolvedValue([
        { amount: BigInt(10_000) },
        { amount: BigInt(5_000) },
      ]);
      const result = await service.getUserTier('some-address');
      expect(result.tier.name).toBe('Silver');
      expect(result.totalStaked).toBe(15_000);
      expect(result.nextTier?.name).toBe('Gold');
      expect(result.amountToNextTier).toBe(35_000);
    });

    it('returns Diamond with no next tier for 500,000 staked', async () => {
      prismaService.stake.findMany.mockResolvedValue([{ amount: BigInt(500_000) }]);
      const result = await service.getUserTier('some-address');
      expect(result.tier.name).toBe('Diamond');
      expect(result.nextTier).toBeNull();
      expect(result.amountToNextTier).toBe(0);
    });
  });

  describe('getCashbackRate', () => {
    it('returns 0 for Bronze users', async () => {
      prismaService.stake.findMany.mockResolvedValue([]);
      expect(await service.getCashbackRate('addr')).toBe(0);
    });

    it('returns 0.005 for Silver users', async () => {
      prismaService.stake.findMany.mockResolvedValue([{ amount: BigInt(10_000) }]);
      expect(await service.getCashbackRate('addr')).toBe(0.005);
    });

    it('returns 0.02 for Diamond users', async () => {
      prismaService.stake.findMany.mockResolvedValue([{ amount: BigInt(200_000) }]);
      expect(await service.getCashbackRate('addr')).toBe(0.02);
    });
  });

  describe('getFeeDiscount', () => {
    it('returns 0 for Bronze users', async () => {
      prismaService.stake.findMany.mockResolvedValue([]);
      expect(await service.getFeeDiscount('addr')).toBe(0);
    });

    it('returns 1.0 (100%) for Diamond users', async () => {
      prismaService.stake.findMany.mockResolvedValue([{ amount: BigInt(200_000) }]);
      expect(await service.getFeeDiscount('addr')).toBe(1.0);
    });
  });
});
