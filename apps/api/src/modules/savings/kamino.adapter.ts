import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import {
  KaminoMarket,
  KaminoAction,
  VanillaObligation,
  PROGRAM_ID as KLEND_PROGRAM_ID,
} from '@kamino-finance/klend-sdk';

// Kamino main market address (mainnet)
const KAMINO_MAIN_MARKET = new PublicKey('7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF');

// DefiLlama pool IDs for Kamino Lending (used for APY fetch)
const DEFILLAMA_POOL_IDS: Record<string, string> = {
  USDC: 'd2141a59-c199-4be7-8',
  USDT: '546b3c0c-138d-4190-b',
};

const TOKEN_MINTS: Record<string, string> = {
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
};

export interface YieldRate {
  protocol: string;
  token: string;
  supplyApy: number;
}

export interface UserPosition {
  deposited: bigint;
  current: bigint;
  kTokenBalance: bigint;
}

@Injectable()
export class KaminoAdapter {
  private readonly logger = new Logger(KaminoAdapter.name);
  private readonly connection: Connection;
  private marketCache: KaminoMarket | null = null;
  private marketCacheExpiry = 0;
  private apyCache: Array<{ project: string; symbol: string; apy: number }> | null = null;
  private apyCacheExpiry = 0;

  constructor(private readonly config: ConfigService) {
    const rpcUrl =
      this.config.get<string>('SOLANA_RPC_URL') || 'https://api.mainnet-beta.solana.com';
    this.connection = new Connection(rpcUrl, 'confirmed');
  }

  /**
   * Load (or return cached) KaminoMarket instance.
   * Cache expires after 5 minutes to keep reserve data reasonably fresh.
   */
  private async getMarket(): Promise<KaminoMarket> {
    const now = Date.now();
    if (this.marketCache && now < this.marketCacheExpiry) {
      return this.marketCache;
    }

    const market = await KaminoMarket.load(this.connection, KAMINO_MAIN_MARKET, 400);
    if (!market) {
      throw new Error('Failed to load Kamino market');
    }
    await market.loadReserves();

    this.marketCache = market;
    this.marketCacheExpiry = now + 5 * 60 * 1000;
    return market;
  }

  /**
   * Get current supply APY for a token from Kamino lending.
   * Uses DefiLlama yields API, falls back to hardcoded values.
   */
  async getSupplyApy(token: 'USDC' | 'USDT'): Promise<number> {
    try {
      if (!this.apyCache || Date.now() > this.apyCacheExpiry) {
        const res = await fetch('https://yields.llama.fi/pools', {
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) {
          this.logger.warn(`DefiLlama API returned ${res.status}`);
          return this.getFallbackApy(token);
        }
        const data = (await res.json()) as {
          data: Array<{ project: string; symbol: string; apy: number }>;
        };
        this.apyCache = data.data.filter((p) => p.project === 'kamino-lend');
        this.apyCacheExpiry = Date.now() + 30 * 60 * 1000; // 30 min cache
      }

      const pool = this.apyCache.find((p) => p.symbol === token);
      return pool?.apy ?? this.getFallbackApy(token);
    } catch (err) {
      this.logger.warn(`Failed to fetch Kamino APY for ${token}: ${err}`);
      return this.getFallbackApy(token);
    }
  }

  /**
   * Get all available rates.
   */
  async getRates(): Promise<YieldRate[]> {
    const [usdcApy, usdtApy] = await Promise.all([
      this.getSupplyApy('USDC'),
      this.getSupplyApy('USDT'),
    ]);

    return [
      { protocol: 'Kamino', token: 'USDC', supplyApy: usdcApy },
      { protocol: 'Kamino', token: 'USDT', supplyApy: usdtApy },
    ];
  }

  /**
   * Build a deposit transaction for the user to sign.
   * Uses Kamino's klend-sdk to construct the instruction set.
   */
  async buildDepositTx(wallet: PublicKey, amount: bigint, token: string): Promise<Transaction> {
    const tx = new Transaction();
    const mint = TOKEN_MINTS[token];
    if (!mint) {
      this.logger.warn(`Unsupported token for Kamino deposit: ${token}`);
      return tx;
    }

    this.logger.log(`Building Kamino deposit: ${amount} ${token} from ${wallet.toBase58()}`);

    try {
      const market = await this.getMarket();
      const kaminoAction = await KaminoAction.buildDepositTxns(
        market,
        amount.toString(),
        new PublicKey(mint),
        wallet,
        new VanillaObligation(KLEND_PROGRAM_ID)
      );

      tx.add(...kaminoAction.setupIxs, ...kaminoAction.lendingIxs);
      const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
      tx.recentBlockhash = blockhash;
      tx.feePayer = wallet;
    } catch (err) {
      this.logger.error(`Failed to build Kamino deposit tx: ${err}`);
    }

    return tx;
  }

  /**
   * Build a withdraw transaction for the user to sign.
   */
  async buildWithdrawTx(wallet: PublicKey, amount: bigint, token: string): Promise<Transaction> {
    const tx = new Transaction();
    const mint = TOKEN_MINTS[token];
    if (!mint) {
      this.logger.warn(`Unsupported token for Kamino withdraw: ${token}`);
      return tx;
    }

    this.logger.log(`Building Kamino withdraw: ${amount} ${token} to ${wallet.toBase58()}`);

    try {
      const market = await this.getMarket();
      const kaminoAction = await KaminoAction.buildWithdrawTxns(
        market,
        amount.toString(),
        new PublicKey(mint),
        wallet,
        new VanillaObligation(KLEND_PROGRAM_ID)
      );

      tx.add(...kaminoAction.setupIxs, ...kaminoAction.lendingIxs);
      const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
      tx.recentBlockhash = blockhash;
      tx.feePayer = wallet;
    } catch (err) {
      this.logger.error(`Failed to build Kamino withdraw tx: ${err}`);
    }

    return tx;
  }

  /**
   * Get a user's position in Kamino lending.
   */
  async getUserPosition(wallet: PublicKey, _token: string): Promise<UserPosition> {
    try {
      const market = await this.getMarket();
      const obligations = await market.getAllUserObligations(wallet);

      let deposited = 0n;
      let current = 0n;

      for (const obligation of obligations) {
        if (!obligation) continue;
        for (const [, deposit] of obligation.deposits) {
          deposited += BigInt(Math.floor(deposit.amount.toNumber()));
          current += BigInt(Math.floor(deposit.marketValueRefreshed.toNumber()));
        }
      }

      return { deposited, current, kTokenBalance: 0n };
    } catch (err) {
      this.logger.warn(`Failed to get Kamino position for ${wallet.toBase58()}: ${err}`);
      return { deposited: 0n, current: 0n, kTokenBalance: 0n };
    }
  }

  private getFallbackApy(token: string): number {
    return token === 'USDC' ? 5.2 : 4.8;
  }
}
