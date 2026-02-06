import { BadRequestException } from '@nestjs/common';
import { SwapService } from './swap.service';

// Mock dependencies
const mockPrismaService = {
  feeCollection: {
    create: jest.fn(),
  },
};

const mockConfigService = {
  get: jest.fn((key: string, defaultValue?: string) => defaultValue),
};

describe('SwapService', () => {
  let service: SwapService;

  beforeEach(() => {
    service = new SwapService(mockPrismaService as any, mockConfigService as any);
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
    // We test the cap logic by intercepting the URL built in getQuote.
    // Since getQuote calls fetch (which will fail in test), we catch the error
    // and verify slippage was capped correctly.
    it('caps slippage at 500 bps (5%)', async () => {
      const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ slippageBps: 500 }),
      } as any);

      await service.getQuote({
        inputMint: 'So11111111111111111111111111111111111111112',
        outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        amount: 1000000,
        slippageBps: 1000, // Request 10%, should be capped to 5%
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

  describe('getMvgaPrice', () => {
    it('returns cached price within 60s window', async () => {
      // Seed the cache
      (service as any).mvgaPriceCache = { price: 0.0012, timestamp: Date.now() };

      const price = await service.getMvgaPrice();
      expect(price).toBe(0.0012);
    });

    it('fetches fresh price when cache is expired', async () => {
      (service as any).mvgaPriceCache = { price: 0.001, timestamp: Date.now() - 120_000 };

      const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ pairs: [{ priceUsd: '0.0015' }] }),
      } as any);

      const price = await service.getMvgaPrice();
      expect(price).toBe(0.0015);

      fetchSpy.mockRestore();
    });

    it('returns fallback 0.001 on API failure with no cache', async () => {
      (service as any).mvgaPriceCache = null;

      const fetchSpy = jest.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network'));

      const price = await service.getMvgaPrice();
      expect(price).toBe(0.001);

      fetchSpy.mockRestore();
    });
  });
});
