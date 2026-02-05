import { Injectable } from '@nestjs/common';
import { SolanaService } from './solana.service';
import { SwapService } from '../swap/swap.service';

export interface TokenBalance {
  mint: string;
  symbol: string;
  name: string;
  balance: number;
  decimals: number;
  usdValue: number;
  logoUrl?: string;
}

export interface TokenPrice {
  symbol: string;
  price: number;
  change24h: number;
}

const PRICE_MINTS = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  MVGA: 'DRX65kM2n5CLTpdjJCemZvkUwE98ou4RpHrd8Z3GH5Qh',
};

@Injectable()
export class WalletService {
  private priceCache: { prices: TokenPrice[]; timestamp: number } | null = null;
  private readonly CACHE_TTL = 60_000; // 60 seconds

  constructor(
    private readonly solanaService: SolanaService,
    private readonly swapService: SwapService,
  ) {}

  async getBalances(address: string): Promise<TokenBalance[]> {
    const solBalance = await this.solanaService.getSolBalance(address);
    const tokenAccounts = await this.solanaService.getTokenAccounts(address);
    const prices = await this.getPrices();

    const balances: TokenBalance[] = [
      {
        mint: 'So11111111111111111111111111111111111111112',
        symbol: 'SOL',
        name: 'Solana',
        balance: solBalance,
        decimals: 9,
        usdValue: solBalance * (prices.find((p) => p.symbol === 'SOL')?.price || 0),
        logoUrl:
          'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
      },
    ];

    // Add SPL token balances
    for (const account of tokenAccounts) {
      const tokenInfo = this.getTokenInfo(account.mint);
      if (tokenInfo) {
        const price = prices.find((p) => p.symbol === tokenInfo.symbol)?.price || 0;
        balances.push({
          mint: account.mint,
          symbol: tokenInfo.symbol,
          name: tokenInfo.name,
          balance: account.amount,
          decimals: tokenInfo.decimals,
          usdValue: account.amount * price,
          logoUrl: tokenInfo.logoUrl,
        });
      }
    }

    return balances;
  }

  async getTransactions(address: string) {
    return this.solanaService.getTransactionHistory(address);
  }

  async getPrices(): Promise<TokenPrice[]> {
    // Return cached if still fresh
    if (this.priceCache && Date.now() - this.priceCache.timestamp < this.CACHE_TTL) {
      return this.priceCache.prices;
    }

    try {
      const mints = Object.values(PRICE_MINTS);
      const mintPrices = await this.swapService.getMultipleTokenPrices(mints);

      const prices: TokenPrice[] = Object.entries(PRICE_MINTS).map(([symbol, mint]) => ({
        symbol,
        price: mintPrices[mint] || 0,
        change24h: 0,
      }));

      // Stablecoins fallback
      for (const p of prices) {
        if ((p.symbol === 'USDC' || p.symbol === 'USDT') && p.price === 0) {
          p.price = 1;
        }
      }

      this.priceCache = { prices, timestamp: Date.now() };
      return prices;
    } catch {
      // Fallback to hardcoded if Jupiter is down
      return [
        { symbol: 'SOL', price: 150, change24h: 0 },
        { symbol: 'USDC', price: 1, change24h: 0 },
        { symbol: 'USDT', price: 1, change24h: 0 },
        { symbol: 'MVGA', price: 0, change24h: 0 },
      ];
    }
  }

  private getTokenInfo(mint: string) {
    const tokens: Record<
      string,
      { symbol: string; name: string; decimals: number; logoUrl: string }
    > = {
      EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: {
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        logoUrl:
          'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
      },
      Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: {
        symbol: 'USDT',
        name: 'Tether USD',
        decimals: 6,
        logoUrl:
          'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg',
      },
      DRX65kM2n5CLTpdjJCemZvkUwE98ou4RpHrd8Z3GH5Qh: {
        symbol: 'MVGA',
        name: 'Make Venezuela Great Again',
        decimals: 9,
        logoUrl: 'https://gateway.irys.xyz/J47ckDJCqKGrt5QHo4ZjDSa4LcaitMFXkcEJ3qyM2qnD',
      },
    };
    return tokens[mint];
  }
}
