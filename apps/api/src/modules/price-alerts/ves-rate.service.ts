import { Injectable, Logger } from '@nestjs/common';

export interface VesRates {
  official: number;
  parallel: number;
}

@Injectable()
export class VesRateService {
  private readonly logger = new Logger(VesRateService.name);
  private cache: { rates: VesRates; timestamp: number } | null = null;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  async getRate(type: 'BCV_OFFICIAL' | 'PARALLEL_MARKET'): Promise<number> {
    const rates = await this.getAllRates();
    return type === 'BCV_OFFICIAL' ? rates.official : rates.parallel;
  }

  async getAllRates(): Promise<VesRates> {
    const now = Date.now();
    if (this.cache && now - this.cache.timestamp < this.CACHE_TTL) {
      return this.cache.rates;
    }

    try {
      const [officialRes, parallelRes] = await Promise.all([
        fetch('https://ve.dolarapi.com/v1/dolar/oficial'),
        fetch('https://ve.dolarapi.com/v1/dolar/paralelo'),
      ]);

      if (!officialRes.ok || !parallelRes.ok) {
        throw new Error(
          `DolarApi HTTP error: official=${officialRes.status}, parallel=${parallelRes.status}`
        );
      }

      const official = await officialRes.json();
      const parallel = await parallelRes.json();

      const rates: VesRates = {
        official: official.promedio ?? 0,
        parallel: parallel.promedio ?? 0,
      };

      this.cache = { rates, timestamp: now };
      return rates;
    } catch (err) {
      this.logger.warn(`DolarApi fetch failed: ${(err as Error).message}`);
      if (this.cache) {
        return this.cache.rates;
      }
      return { official: 0, parallel: 0 };
    }
  }
}
