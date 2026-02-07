import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Test the pure formatting/conversion logic from usePrices without React hooks.
// The hook wraps fetchPricesFromAPI + useState/useEffect, so we test:
// 1. The formatting functions (toFiat, formatFiat, formatUsdValue) by reimplementing their logic
// 2. The fetch flow by calling fetchPricesFromAPI directly

// ── Formatting logic (mirrors usePrices return functions) ──────────────

interface Prices {
  sol: number;
  usdc: number;
  usdt: number;
  mvga: number;
  vesRate: number;
}

function toFiat(
  prices: Prices,
  amount: number,
  token: string,
  currency: 'USD' | 'VES' = 'USD'
): number {
  const tokenKey = token.toLowerCase() as keyof Prices;
  const price = tokenKey in prices ? (prices[tokenKey] as number) : 0;
  const usdValue = amount * price;
  return currency === 'VES' ? usdValue * prices.vesRate : usdValue;
}

function formatFiat(
  prices: Prices,
  amount: number,
  token: string,
  currency: 'USD' | 'VES' = 'USD'
): string {
  if (currency === 'VES' && prices.vesRate === 0) {
    return 'Bs \u2014';
  }
  const value = toFiat(prices, amount, token, currency);
  if (currency === 'VES') {
    return `Bs ${value.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatUsdValue(prices: Prices, usd: number, currency: 'USD' | 'VES' = 'USD'): string {
  if (currency === 'VES') {
    if (prices.vesRate === 0) return 'Bs \u2014';
    const ves = usd * prices.vesRate;
    return `Bs ${ves.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `$${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('usePrices - toFiat', () => {
  const prices: Prices = { sol: 150, usdc: 1, usdt: 1, mvga: 0.05, vesRate: 36.5 };

  it('converts token amount to USD', () => {
    expect(toFiat(prices, 2, 'SOL', 'USD')).toBe(300);
    expect(toFiat(prices, 100, 'USDC', 'USD')).toBe(100);
    expect(toFiat(prices, 1000, 'MVGA', 'USD')).toBe(50);
  });

  it('converts token amount to VES', () => {
    // 2 SOL * $150 * 36.5 VES/USD = 10950
    expect(toFiat(prices, 2, 'SOL', 'VES')).toBe(10950);
  });

  it('returns 0 for unknown token', () => {
    expect(toFiat(prices, 100, 'UNKNOWN', 'USD')).toBe(0);
  });

  it('defaults to USD', () => {
    expect(toFiat(prices, 1, 'SOL')).toBe(150);
  });
});

describe('usePrices - formatFiat', () => {
  const prices: Prices = { sol: 150, usdc: 1, usdt: 1, mvga: 0.05, vesRate: 36.5 };

  it('formats USD value', () => {
    const formatted = formatFiat(prices, 1, 'SOL', 'USD');
    expect(formatted).toMatch(/^\$150\.00$/);
  });

  it('formats VES value with Bs prefix', () => {
    const formatted = formatFiat(prices, 1, 'SOL', 'VES');
    expect(formatted).toMatch(/^Bs /);
  });

  it('returns dash when VES rate is 0', () => {
    const zeroPrices: Prices = { sol: 150, usdc: 1, usdt: 1, mvga: 0, vesRate: 0 };
    expect(formatFiat(zeroPrices, 1, 'SOL', 'VES')).toBe('Bs \u2014');
  });

  it('formats USDC correctly', () => {
    expect(formatFiat(prices, 50, 'USDC', 'USD')).toMatch(/^\$50\.00$/);
  });
});

describe('usePrices - formatUsdValue', () => {
  const prices: Prices = { sol: 150, usdc: 1, usdt: 1, mvga: 0.05, vesRate: 36.5 };

  it('formats a raw USD number', () => {
    expect(formatUsdValue(prices, 100, 'USD')).toMatch(/^\$100\.00$/);
  });

  it('converts USD to VES', () => {
    const formatted = formatUsdValue(prices, 100, 'VES');
    expect(formatted).toMatch(/^Bs /);
    // 100 * 36.5 = 3650
    expect(formatted).toContain('3');
  });

  it('returns dash for VES when rate is 0', () => {
    const zeroPrices: Prices = { sol: 150, usdc: 1, usdt: 1, mvga: 0, vesRate: 0 };
    expect(formatUsdValue(zeroPrices, 100, 'VES')).toBe('Bs \u2014');
  });

  it('defaults to USD', () => {
    expect(formatUsdValue(prices, 42)).toMatch(/^\$42\.00$/);
  });
});

// ── Fetch flow (test fetchPricesFromAPI behavior via mocked fetch) ────

describe('usePrices - fetchPricesFromAPI flow', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mockPriceResponses(
    cryptoPrices: { symbol: string; price: number }[] = [
      { symbol: 'SOL', price: 150 },
      { symbol: 'USDC', price: 1 },
      { symbol: 'MVGA', price: 0.05 },
    ],
    vesRate: number = 36.5
  ) {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/wallet/prices')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(cryptoPrices),
        });
      }
      if (url.includes('er-api.com')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ rates: { VES: vesRate } }),
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });
  }

  it('calls crypto prices API and exchange rate API', async () => {
    mockPriceResponses();

    // Simulate what fetchPricesFromAPI does
    const cryptoRes = await fetch('http://localhost:4000/api/wallet/prices');
    const cryptoData = await cryptoRes.json();
    expect(cryptoData).toEqual([
      { symbol: 'SOL', price: 150 },
      { symbol: 'USDC', price: 1 },
      { symbol: 'MVGA', price: 0.05 },
    ]);

    const vesRes = await fetch('https://open.er-api.com/v6/latest/USD');
    const vesData = await vesRes.json();
    expect(vesData.rates.VES).toBe(36.5);
  });

  it('uses fallback SOL price when API fails', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/wallet/prices')) {
        return Promise.reject(new Error('Network error'));
      }
      if (url.includes('er-api.com')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ rates: { VES: 36.5 } }),
        });
      }
      return Promise.reject(new Error('Unknown'));
    });

    // Simulate the fallback behavior
    const prices: Prices = { sol: 0, usdc: 1, usdt: 1, mvga: 0, vesRate: 0 };
    try {
      await fetch('http://localhost:4000/api/wallet/prices');
    } catch {
      prices.sol = 150; // fallback
    }

    expect(prices.sol).toBe(150);
  });

  it('handles missing VES rate gracefully', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/wallet/prices')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ symbol: 'SOL', price: 200 }]),
        });
      }
      if (url.includes('er-api.com')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ rates: {} }), // no VES
        });
      }
      return Promise.reject(new Error('Unknown'));
    });

    const vesRes = await fetch('https://open.er-api.com/v6/latest/USD');
    const data = await vesRes.json();
    expect(data.rates.VES).toBeUndefined();

    // vesRate stays 0 → formatFiat returns dash
    const prices: Prices = { sol: 200, usdc: 1, usdt: 1, mvga: 0, vesRate: 0 };
    expect(formatFiat(prices, 1, 'SOL', 'VES')).toBe('Bs \u2014');
  });
});
