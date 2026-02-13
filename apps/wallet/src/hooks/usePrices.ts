import { useState, useEffect } from 'react';
import { API_URL } from '../config';

interface Prices {
  sol: number;
  usdc: number;
  usdt: number;
  mvga: number;
  vesRate: number; // BCV official (backward compat)
  vesBcvRate: number; // BCV official
  vesParallelRate: number; // parallel market
}

const CACHE_TTL = 60_000; // 60 seconds
let cachedPrices: Prices | null = null;
let cacheTimestamp = 0;

async function fetchPricesFromAPI(): Promise<Prices> {
  const now = Date.now();
  if (cachedPrices && now - cacheTimestamp < CACHE_TTL) {
    return cachedPrices;
  }

  const prices: Prices = {
    sol: 0,
    usdc: 1,
    usdt: 1,
    mvga: 0,
    vesRate: 0,
    vesBcvRate: 0,
    vesParallelRate: 0,
  };

  try {
    const res = await fetch(`${API_URL}/price-alerts/rates`);
    if (res.ok) {
      const data: { tokens: Record<string, number>; ves: { official: number; parallel: number } } =
        await res.json();

      // Map token prices
      if (data.tokens) {
        if (data.tokens.SOL) prices.sol = data.tokens.SOL;
        if (data.tokens.USDC) prices.usdc = data.tokens.USDC;
        if (data.tokens.USDT) prices.usdt = data.tokens.USDT;
        if (data.tokens.MVGA) prices.mvga = data.tokens.MVGA;
      }

      // Map VES rates
      if (data.ves) {
        prices.vesBcvRate = data.ves.official || 0;
        prices.vesParallelRate = data.ves.parallel || 0;
        prices.vesRate = prices.vesBcvRate; // backward compat
      }
    }
  } catch {
    // Use fallback prices
    prices.sol = 150;
  }

  // Cache if we got valid data
  if (prices.sol > 0 || prices.vesBcvRate > 0) {
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
    vesBcvRate: 0,
    vesParallelRate: 0,
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
