import { Injectable } from '@nestjs/common';
import { SolanaService } from './solana.service';

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

@Injectable()
export class WalletService {
  constructor(private readonly solanaService: SolanaService) {}

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
    // In production, fetch from Jupiter, CoinGecko, or similar
    // For now, return placeholder prices
    return [
      { symbol: 'SOL', price: 150, change24h: 2.5 },
      { symbol: 'USDC', price: 1, change24h: 0 },
      { symbol: 'USDT', price: 1, change24h: 0 },
      { symbol: 'MVGA', price: 0.0001, change24h: 10 }, // Placeholder
    ];
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
      // Add MVGA token address after creation
    };
    return tokens[mint];
  }
}
