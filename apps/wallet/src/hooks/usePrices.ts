import { useState, useEffect } from 'react';
import { API_URL } from '../config';

interface Prices {
  sol: number;
  usdc: number;
  usdt: number;
  mvga: number;
  vesRate: number;
}

const CACHE_TTL = 60_000; // 60 seconds
let cachedPrices: Prices | null = null;
let cacheTimestamp = 0;

async function fetchPricesFromAPI(): Promise<Prices> {
  const now = Date.now();
  if (cachedPrices && now - cacheTimestamp < CACHE_TTL) {
    return cachedPrices;
  }

  // Fetch crypto prices from our API
  const prices: Prices = { sol: 0, usdc: 1, usdt: 1, mvga: 0, vesRate: 0 };

  try {
    const res = await fetch(`${API_URL}/wallet/prices`);
    if (res.ok) {
      const data: { symbol: string; price: number }[] = await res.json();
      for (const entry of data) {
        const key = entry.symbol.toLowerCase() as keyof Prices;
        if (key in prices && key !== 'vesRate') {
          prices[key] = entry.price;
        }
      }
    }
  } catch {
    // Use fallback prices
    prices.sol = 150;
  }

  // Fetch VES/USD rate
  try {
    const vesRes = await fetch('https://open.er-api.com/v6/latest/USD');
    if (vesRes.ok) {
      const data = await vesRes.json();
      if (data.rates?.VES) {
        prices.vesRate = data.rates.VES;
      }
    }
  } catch {
    // Keep default VES rate
  }

  // Only cache if we have a valid VES rate
  if (prices.vesRate > 0) {
    cachedPrices = prices;
    cacheTimestamp = now;
  }
  return prices;
}

export function usePrices() {
  const [prices, setPrices] = useState<Prices>({
    sol: 0,
    usdc: 1,
    usdt: 1,
    mvga: 0,
    vesRate: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const p = await fetchPricesFromAPI();
      if (mounted) {
        setPrices(p);
        setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, CACHE_TTL);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const toFiat = (amount: number, token: string, currency: 'USD' | 'VES' = 'USD'): number => {
    const tokenKey = token.toLowerCase() as keyof Prices;
    const price = tokenKey in prices ? (prices[tokenKey] as number) : 0;
    const usdValue = amount * price;
    return currency === 'VES' ? usdValue * prices.vesRate : usdValue;
  };

  const formatFiat = (amount: number, token: string, currency: 'USD' | 'VES' = 'USD'): string => {
    if (currency === 'VES' && prices.vesRate === 0) {
      return 'Bs \u2014';
    }
    const value = toFiat(amount, token, currency);
    if (currency === 'VES') {
      return `Bs ${value.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatUsdValue = (usd: number, currency: 'USD' | 'VES' = 'USD'): string => {
    if (currency === 'VES') {
      if (prices.vesRate === 0) return 'Bs \u2014';
      const ves = usd * prices.vesRate;
      return `Bs ${ves.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `$${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return { prices, loading, toFiat, formatFiat, formatUsdValue };
}
