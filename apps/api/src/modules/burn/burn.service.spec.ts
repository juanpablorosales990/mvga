/* eslint-disable @typescript-eslint/no-explicit-any */
import { BurnService } from './burn.service';

const MVGA_DECIMALS = 9;

describe('BurnService', () => {
  let service: BurnService;
  let mockPrisma: any;
  let mockTxLogger: any;
  let mockConfig: any;

  beforeEach(() => {
    mockPrisma = {
      tokenBurn: {
        create: jest.fn(),
        aggregate: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
    };

    mockTxLogger = {
      log: jest.fn(),
      confirm: jest.fn(),
    };

    mockConfig = {
      get: jest.fn((key: string, defaultVal?: string) => {
        if (key === 'MVGA_TOKEN_MINT') return 'DRX65kM2n5CLTpdjJCemZvkUwE98ou4RpHrd8Z3GH5Qh';
        if (key === 'TREASURY_KEYPAIR') return undefined;
        return defaultVal;
      }),
    };

    service = new BurnService(mockPrisma, mockTxLogger, {} as any, mockConfig);
  });

  describe('executeBurn', () => {
    it('throws when treasury keypair not configured', async () => {
      await expect(service.executeBurn(BigInt(1000), 'WEEKLY')).rejects.toThrow(
        'Treasury keypair not configured'
      );
    });

    it('throws when burn amount is zero', async () => {
      // Set keypair via reflection
      (service as any).treasuryKeypair = { publicKey: { toBase58: () => 'abc' } };
      await expect(service.executeBurn(BigInt(0), 'MANUAL')).rejects.toThrow(
        'Burn amount must be positive'
      );
    });
  });

  describe('getBurnStats', () => {
    it('returns stats with no burns', async () => {
      mockPrisma.tokenBurn.aggregate.mockResolvedValue({ _sum: { amount: null } });
      mockPrisma.tokenBurn.count.mockResolvedValue(0);
      mockPrisma.tokenBurn.findFirst.mockResolvedValue(null);

      const stats = await service.getBurnStats();
      expect(stats.totalBurned).toBe(0);
      expect(stats.burnCount).toBe(0);
      expect(stats.lastBurnAt).toBeNull();
      expect(stats.lastBurnTx).toBeNull();
      expect(stats.supplyReduction).toBe(0);
    });

    it('calculates correct stats with burns', async () => {
      const amount = BigInt(1_000_000) * BigInt(10 ** MVGA_DECIMALS);
      mockPrisma.tokenBurn.aggregate.mockResolvedValue({ _sum: { amount } });
      mockPrisma.tokenBurn.count.mockResolvedValue(5);
      mockPrisma.tokenBurn.findFirst.mockResolvedValue({
        amount: BigInt(200_000) * BigInt(10 ** MVGA_DECIMALS),
        createdAt: new Date('2026-02-01'),
        signature: 'sig123',
      });

      const stats = await service.getBurnStats();
      expect(stats.totalBurned).toBe(1_000_000);
      expect(stats.burnCount).toBe(5);
      expect(stats.lastBurnAt).toBe('2026-02-01T00:00:00.000Z');
      expect(stats.lastBurnAmount).toBe(200_000);
      expect(stats.lastBurnTx).toBe('sig123');
      expect(stats.supplyReduction).toBeCloseTo(0.1, 5);
    });
  });

  describe('getBurnHistory', () => {
    it('returns empty array when no burns', async () => {
      mockPrisma.tokenBurn.findMany.mockResolvedValue([]);
      expect(await service.getBurnHistory()).toEqual([]);
    });

    it('maps burn records correctly', async () => {
      mockPrisma.tokenBurn.findMany.mockResolvedValue([
        {
          id: '1',
          amount: BigInt(500) * BigInt(10 ** MVGA_DECIMALS),
          signature: 'sig1',
          source: 'WEEKLY',
          createdAt: new Date('2026-01-15'),
        },
      ]);

      const history = await service.getBurnHistory(5);
      expect(history).toHaveLength(1);
      expect(history[0].amount).toBe(500);
      expect(history[0].source).toBe('WEEKLY');
      expect(mockPrisma.tokenBurn.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 })
      );
    });
  });
});
