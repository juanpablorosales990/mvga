import { Test, TestingModule } from '@nestjs/testing';
import { VesRateService } from './ves-rate.service';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe('VesRateService', () => {
  let service: VesRateService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VesRateService],
    }).compile();

    service = module.get<VesRateService>(VesRateService);
    mockFetch.mockReset();
    // Reset cache between tests
    (service as any).cache = null;
  });

  it('fetches official rate and returns promedio', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ promedio: 388.74, compra: null, venta: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ promedio: 546.05, compra: null, venta: null }),
      });

    const rate = await service.getRate('BCV_OFFICIAL');
    expect(rate).toBe(388.74);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('fetches parallel rate and returns promedio', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ promedio: 388.74 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ promedio: 546.05 }),
      });

    const rate = await service.getRate('PARALLEL_MARKET');
    expect(rate).toBe(546.05);
  });

  it('returns cached value within 5 min window', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ promedio: 388.74 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ promedio: 546.05 }),
      });

    await service.getAllRates();
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Second call should hit cache
    const rates = await service.getAllRates();
    expect(rates.official).toBe(388.74);
    expect(rates.parallel).toBe(546.05);
    expect(mockFetch).toHaveBeenCalledTimes(2); // no new calls
  });

  it('returns cached value on API failure', async () => {
    // First call succeeds
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ promedio: 388.74 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ promedio: 546.05 }),
      });

    await service.getAllRates();

    // Expire cache
    (service as any).cache.timestamp = 0;

    // Second call fails
    mockFetch.mockRejectedValue(new Error('Network error'));

    const rates = await service.getAllRates();
    expect(rates.official).toBe(388.74);
    expect(rates.parallel).toBe(546.05);
  });

  it('returns zeros when no cache and API fails', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const rates = await service.getAllRates();
    expect(rates.official).toBe(0);
    expect(rates.parallel).toBe(0);
  });
});
