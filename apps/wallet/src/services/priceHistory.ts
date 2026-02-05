const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export interface PricePoint {
  timestamp: number;
  price: number;
}

const cache: Record<string, { data: PricePoint[]; expiry: number }> = {};
const CACHE_TTL = 60_000; // 60s

export async function fetchPriceHistory(
  token: 'SOL' | 'MVGA',
  days: number
): Promise<PricePoint[]> {
  const cacheKey = `${token}-${days}`;
  const now = Date.now();

  if (cache[cacheKey] && cache[cacheKey].expiry > now) {
    return cache[cacheKey].data;
  }

  try {
    if (token === 'SOL') {
      // CoinGecko for SOL
      const res = await fetch(
        `https://api.coingecko.com/api/v3/coins/solana/market_chart?vs_currency=usd&days=${days}`
      );
      if (!res.ok) throw new Error('CoinGecko fetch failed');
      const data = await res.json();
      const points: PricePoint[] = data.prices.map(([ts, price]: [number, number]) => ({
        timestamp: ts,
        price,
      }));
      cache[cacheKey] = { data: points, expiry: now + CACHE_TTL };
      return points;
    }

    // MVGA — use DexScreener pair data via our API
    const res = await fetch(`${API_URL}/wallet/prices`);
    if (!res.ok) throw new Error('API price fetch failed');
    const priceData: { symbol: string; price: number }[] = await res.json();
    const mvgaPrice = priceData.find((p) => p.symbol === 'MVGA')?.price || 0;

    // Generate synthetic history (MVGA doesn't have long history on CoinGecko)
    // Use current price with small random variations for demo
    const interval = (days * 24 * 60 * 60 * 1000) / 100;
    const points: PricePoint[] = [];
    for (let i = 0; i < 100; i++) {
      const t = now - (100 - i) * interval;
      // Simulate price movement: +-5% random walk
      const variation = 1 + (Math.sin(i * 0.3) * 0.03 + (Math.random() - 0.5) * 0.02);
      points.push({
        timestamp: t,
        price: mvgaPrice * variation,
      });
    }
    // Last point is actual current price
    points[points.length - 1].price = mvgaPrice;

    cache[cacheKey] = { data: points, expiry: now + CACHE_TTL };
    return points;
  } catch {
    return [];
  }
}

export function calculateChange(data: PricePoint[]): { change: number; percent: number } {
  if (data.length < 2) return { change: 0, percent: 0 };
  const first = data[0].price;
  const last = data[data.length - 1].price;
  const change = last - first;
  const percent = first > 0 ? (change / first) * 100 : 0;
  return { change, percent };
}
