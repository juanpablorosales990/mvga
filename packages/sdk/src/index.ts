// MVGA SDK - Shared constants, types, and utilities

// ============================================================================
// Constants
// ============================================================================

export const MVGA_TOKEN = {
  mint: 'DRX65kM2n5CLTpdjJCemZvkUwE98ou4RpHrd8Z3GH5Qh',
  symbol: 'MVGA',
  name: 'Make Venezuela Great Again',
  decimals: 9,
  totalSupply: 1_000_000_000,
};

export const SUPPORTED_TOKENS = {
  SOL: {
    mint: 'So11111111111111111111111111111111111111112',
    symbol: 'SOL',
    name: 'Solana',
    decimals: 9,
  },
  USDC: {
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
  },
  USDT: {
    mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
  },
  MVGA: MVGA_TOKEN,
} as const;

export const TREASURY_WALLETS = {
  main: 'H9j1W4u5LEiw8AZdui6c8AmN6t4tKkPQCAULPW8eMiTE',
  humanitarian: '82XeVLtfjniaE6qvrDiY7UaCHvkimyhVximvRDdQsdqS',
  staking: 'GNhLCjqThNJAJAdDYvRTr2EfWyGXAFUymaPuKaL1duEh',
  team: '8m8L2CGoneYwP3xEYyss5sjbj7GKy7cK3YxDcG2yNbH4',
  marketing: 'DA5VQFLsx87hNQqL2EsM36oVhGnzM2CnqPSe6E9RFpeo',
  advisors: 'Huq3ea9KKf6HFb5Qiacdx2pJDSM4c881WdyMCBHXq4hF',
} as const;

export const STAKING_TIERS = [
  {
    name: 'Bronze',
    minStake: 0,
    multiplier: 1.0,
    benefits: ['Basic wallet access', 'Community access'],
  },
  {
    name: 'Silver',
    minStake: 10_000,
    multiplier: 1.2,
    benefits: ['0.5% cashback on swaps', 'Priority support'],
  },
  {
    name: 'Gold',
    minStake: 50_000,
    multiplier: 1.5,
    benefits: ['1% cashback on swaps', 'Governance voting', 'Early feature access'],
  },
  {
    name: 'Diamond',
    minStake: 200_000,
    multiplier: 2.0,
    benefits: ['2% cashback', 'Zero fees', 'VIP support', 'Exclusive events'],
  },
] as const;

export const LOCK_PERIODS = [
  { days: 0, label: 'Flexible', multiplier: 1.0 },
  { days: 30, label: '30 Days', multiplier: 1.25 },
  { days: 90, label: '90 Days', multiplier: 1.5 },
  { days: 180, label: '180 Days', multiplier: 2.0 },
] as const;

// ============================================================================
// Types
// ============================================================================

export interface TokenInfo {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  logoUrl?: string;
}

export interface TokenBalance {
  mint: string;
  symbol: string;
  name: string;
  balance: number;
  decimals: number;
  usdValue: number;
  logoUrl?: string;
}

export interface StakingPosition {
  stakedAmount: number;
  lockPeriod: number;
  lockEndDate: Date | null;
  earnedRewards: number;
  currentTier: string;
  apy: number;
}

export interface P2POffer {
  id: string;
  sellerId: string;
  type: 'BUY' | 'SELL';
  cryptoAmount: number;
  cryptoCurrency: 'USDC' | 'MVGA';
  fiatCurrency: 'USD';
  paymentMethod: 'ZELLE' | 'VENMO' | 'PAYPAL' | 'BANK_TRANSFER';
  rate: number;
  minAmount: number;
  maxAmount: number;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED';
}

export interface P2PTrade {
  id: string;
  offerId: string;
  buyerId: string;
  amount: number;
  status: 'PENDING' | 'PAID' | 'COMPLETED' | 'DISPUTED' | 'CANCELLED';
  escrowTx?: string;
  createdAt: Date;
  paidAt?: Date;
  completedAt?: Date;
}

export interface UserReputation {
  totalTrades: number;
  completedTrades: number;
  disputesLost: number;
  rating: number;
  avgResponseTime: number;
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Format a token amount with proper decimals
 */
export function formatTokenAmount(amount: number, decimals: number = 9): string {
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: Math.min(decimals, 6),
  });
}

/**
 * Format USD amount
 */
export function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

/**
 * Shorten a Solana address for display
 */
export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * Get staking tier for a given amount
 */
export function getStakingTier(stakedAmount: number) {
  for (let i = STAKING_TIERS.length - 1; i >= 0; i--) {
    if (stakedAmount >= STAKING_TIERS[i].minStake) {
      return STAKING_TIERS[i];
    }
  }
  return STAKING_TIERS[0];
}

/**
 * Calculate APY based on base rate, tier, and lock period
 */
export function calculateAPY(
  baseApy: number,
  stakedAmount: number,
  lockPeriodDays: number
): number {
  const tier = getStakingTier(stakedAmount);
  const lockPeriod = LOCK_PERIODS.find((p) => p.days === lockPeriodDays) || LOCK_PERIODS[0];
  return baseApy * tier.multiplier * lockPeriod.multiplier;
}

/**
 * Validate a Solana address
 */
export function isValidSolanaAddress(address: string): boolean {
  try {
    // Basic validation - Solana addresses are base58 encoded, 32-44 chars
    if (address.length < 32 || address.length > 44) return false;
    // Check for valid base58 characters
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
    return base58Regex.test(address);
  } catch {
    return false;
  }
}

// ============================================================================
// API Client (for use in frontend apps)
// ============================================================================

export class MVGAClient {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:4000/api') {
    this.baseUrl = baseUrl;
  }

  private async fetch<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  async getBalances(address: string): Promise<TokenBalance[]> {
    return this.fetch(`/wallet/${address}/balances`);
  }

  async getTransactions(address: string) {
    return this.fetch(`/wallet/${address}/transactions`);
  }

  async getPrices() {
    return this.fetch('/wallet/prices');
  }

  async getStakingInfo() {
    return this.fetch('/staking/info');
  }

  async getStakingPosition(address: string): Promise<StakingPosition> {
    return this.fetch(`/staking/${address}`);
  }

  async stake(address: string, amount: number, lockPeriod: number) {
    return this.fetch('/staking/stake', {
      method: 'POST',
      body: JSON.stringify({ address, amount, lockPeriod }),
    });
  }

  async unstake(address: string, amount: number) {
    return this.fetch('/staking/unstake', {
      method: 'POST',
      body: JSON.stringify({ address, amount }),
    });
  }

  async claimRewards(address: string) {
    return this.fetch(`/staking/${address}/claim`, { method: 'POST' });
  }
}
