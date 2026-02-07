import { BadRequestException } from '@nestjs/common';
import { SwapService } from './swap.service';
import { TiersService } from '../tiers/tiers.service';

// Mock dependencies
const mockPrismaService = {
  feeCollection: {
    create: jest.fn(),
    findFirst: jest.fn().mockResolvedValue(null),
  },
  stake: {
    findMany: jest.fn().mockResolvedValue([]),
  },
};

const mockConfigService = {
  get: jest.fn((key: string, defaultValue?: string) => defaultValue),
};

describe('SwapService', () => {
  let service: SwapService;
  let tiersService: TiersService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrismaService.feeCollection.findFirst.mockResolvedValue(null);
    tiersService = new TiersService(mockPrismaService as any);
    const mockSolanaService = {
      getConnection: jest.fn().mockReturnValue({
        getParsedTransaction: jest.fn().mockResolvedValue({
          meta: { err: null },
          transaction: {
            message: {
              accountKeys: [{ pubkey: { toBase58: () => 'test-wallet' } }],
            },
          },
        }),
      }),
    };
    service = new SwapService(
      mockPrismaService as any,
      mockConfigService as any,
      tiersService,
      mockSolanaService as any
    );
  });

  describe('getQuote validation', () => {
    it('rejects same input and output token', async () => {
      await expect(
        service.getQuote({
          inputMint: 'So11111111111111111111111111111111111111112',
          outputMint: 'So11111111111111111111111111111111111111112',
          amount: 1000000,
        })
      ).rejects.toThrow('Input and output tokens cannot be the same');
    });

    it('rejects zero or negative amount', async () => {
      await expect(
        service.getQuote({
          inputMint: 'So11111111111111111111111111111111111111112',
          outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          amount: 0,
        })
      ).rejects.toThrow('Amount must be greater than 0');

      await expect(
        service.getQuote({
          inputMint: 'So11111111111111111111111111111111111111112',
          outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          amount: -100,
        })
      ).rejects.toThrow('Amount must be greater than 0');
    });
  });

  describe('slippage capping', () => {
    it('caps slippage at 500 bps (5%)', async () => {
      const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ slippageBps: 500 }),
      } as any);

      await service.getQuote({
        inputMint: 'So11111111111111111111111111111111111111112',
        outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        amount: 1000000,
        slippageBps: 1000,
      });

      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).toContain('slippageBps=500');

      fetchSpy.mockRestore();
    });

    it('enforces minimum slippage of 1 bps', async () => {
      const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ slippageBps: 1 }),
      } as any);

      await service.getQuote({
        inputMint: 'So11111111111111111111111111111111111111112',
        outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        amount: 1000000,
        slippageBps: 0,
      });

      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).toContain('slippageBps=1');

      fetchSpy.mockRestore();
    });

    it('defaults slippage to 50 bps', async () => {
      const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ slippageBps: 50 }),
      } as any);

      await service.getQuote({
        inputMint: 'So11111111111111111111111111111111111111112',
        outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        amount: 1000000,
      });

      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).toContain('slippageBps=50');

      fetchSpy.mockRestore();
    });
  });

  describe('getMultipleTokenPrices', () => {
    const MVGA_MINT = 'DRX65kM2n5CLTpdjJCemZvkUwE98ou4RpHrd8Z3GH5Qh';
    const SOL_MINT = 'So11111111111111111111111111111111111111112';

    it('returns cached prices without fetching', async () => {
      const cache = (service as any).priceCache as Map<string, any>;
      cache.set(SOL_MINT, { price: 85.0, timestamp: Date.now() });

      const prices = await service.getMultipleTokenPrices([SOL_MINT]);
      expect(prices[SOL_MINT]).toBe(85.0);
    });

    it('fetches from DexScreener for uncached mints', async () => {
      const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => [{ baseToken: { address: MVGA_MINT }, priceUsd: '0.0015' }],
      } as any);

      const prices = await service.getMultipleTokenPrices([MVGA_MINT]);
      expect(prices[MVGA_MINT]).toBe(0.0015);
      expect(fetchSpy.mock.calls[0][0]).toContain('api.dexscreener.com/tokens/v1/solana/');

      fetchSpy.mockRestore();
    });

    it('falls back to default price for MVGA on DexScreener failure', async () => {
      const fetchSpy = jest.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network'));

      const prices = await service.getMultipleTokenPrices([MVGA_MINT]);
      expect(prices[MVGA_MINT]).toBe(0.001);

      fetchSpy.mockRestore();
    });
  });

  describe('getMvgaPrice', () => {
    it('returns fallback 0.001 when DexScreener returns no data', async () => {
      const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as any);

      const price = await service.getMvgaPrice();
      expect(price).toBe(0.001);

      fetchSpy.mockRestore();
    });
  });

  describe('recordSwap with tier integration', () => {
    const swapParams = {
      walletAddress: 'test-wallet',
      signature: 'test-sig-123',
      inputMint: 'So11111111111111111111111111111111111111112',
      outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      inputAmount: '1000000000', // 1 SOL in lamports
      outputAmount: '150000000', // 150 USDC
    };

    it('records full fee for Bronze tier (no discount)', async () => {
      mockPrismaService.stake.findMany.mockResolvedValue([]);

      const result = await service.recordSwap(swapParams);

      expect(result.tier).toBe('Bronze');
      expect(result.feeDiscount).toBe(0);
      expect(result.cashbackRate).toBe(0);
      // 0.1% of 1000000000 = 1000000
      expect(result.feeAmount).toBe('1000000');
      expect(result.cashbackAmount).toBe('0');
      expect(mockPrismaService.feeCollection.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          source: 'SWAP',
          amount: BigInt(1000000),
          token: 'SOL',
        }),
      });
    });

    it('applies 10% fee discount for Silver tier', async () => {
      mockPrismaService.stake.findMany.mockResolvedValue([{ amount: BigInt(10_000) }]);

      const result = await service.recordSwap(swapParams);

      expect(result.tier).toBe('Silver');
      expect(result.feeDiscount).toBe(10);
      expect(result.cashbackRate).toBe(0.5);
      // Math.round(0.1 * 10) = 1 discountBps, effectiveFeeBps = 10-1 = 9
      // 1000000000 * 9 / 10000 = 900000
      expect(result.feeAmount).toBe('900000');
      // cashbackBps = Math.round(0.005 * 10000) = 50
      // 1000000000 * 50 / 10000 = 5000000
      expect(result.cashbackAmount).toBe('5000000');
    });

    it('applies 25% fee discount for Gold tier', async () => {
      mockPrismaService.stake.findMany.mockResolvedValue([{ amount: BigInt(50_000) }]);

      const result = await service.recordSwap(swapParams);

      expect(result.tier).toBe('Gold');
      expect(result.feeDiscount).toBe(25);
      expect(result.cashbackRate).toBe(1);
      // Math.round(0.25 * 10) = 3 discountBps (rounding: 2.5 → 3)
      // effectiveFeeBps = 10-3 = 7
      // 1000000000 * 7 / 10000 = 700000
      expect(result.feeAmount).toBe('700000');
      // cashbackBps = Math.round(0.01 * 10000) = 100
      // 1000000000 * 100 / 10000 = 10000000
      expect(result.cashbackAmount).toBe('10000000');
    });

    it('applies zero fees for Diamond tier', async () => {
      mockPrismaService.stake.findMany.mockResolvedValue([{ amount: BigInt(200_000) }]);

      const result = await service.recordSwap(swapParams);

      expect(result.tier).toBe('Diamond');
      expect(result.feeDiscount).toBe(100);
      expect(result.cashbackRate).toBe(2);
      expect(result.feeAmount).toBe('0');
      // 2% cashback of 1000000000 = 20000000
      expect(result.cashbackAmount).toBe('20000000');
    });
  });

  describe('getFeeDetails', () => {
    it('returns base fees when no wallet provided', async () => {
      const result = await service.getFeeDetails();

      expect(result.platformFeeBps).toBe(10);
      expect(result.effectiveFeeBps).toBe(10);
      expect(result.tier).toBe('Bronze');
      expect(result.feeDiscount).toBe(0);
      expect(result.cashbackRate).toBe(0);
    });

    it('returns discounted fees for Silver tier wallet', async () => {
      mockPrismaService.stake.findMany.mockResolvedValue([{ amount: BigInt(10_000) }]);

      const result = await service.getFeeDetails('silver-wallet');

      expect(result.platformFeeBps).toBe(10);
      expect(result.effectiveFeeBps).toBe(9); // 10% discount
      expect(result.tier).toBe('Silver');
      expect(result.feeDiscount).toBe(10);
      expect(result.cashbackRate).toBe(0.5);
    });

    it('returns zero fees for Diamond tier wallet', async () => {
      mockPrismaService.stake.findMany.mockResolvedValue([{ amount: BigInt(200_000) }]);

      const result = await service.getFeeDetails('diamond-wallet');

      expect(result.effectiveFeeBps).toBe(0);
      expect(result.tier).toBe('Diamond');
      expect(result.feeDiscount).toBe(100);
      expect(result.cashbackRate).toBe(2);
    });
  });
});
