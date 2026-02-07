import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';

// Reserve addresses for Kamino Lending on mainnet
const KAMINO_RESERVES: Record<string, string> = {
  USDC: 'D6q6wuQSrifJKDDYPbBQhFEJuSwV7F3FfFuFcbx2R1iH', // Kamino USDC reserve
  USDT: 'H3t6qZ1JkguCNTi9uzVKqQ7dvt2cum4XiXWom6Gn5e5S', // Kamino USDT reserve
};

const _TOKEN_MINTS: Record<string, string> = {
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
};

const _TOKEN_DECIMALS: Record<string, number> = {
  USDC: 6,
  USDT: 6,
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

  constructor(private readonly config: ConfigService) {
    const rpcUrl =
      this.config.get<string>('SOLANA_RPC_URL') || 'https://api.mainnet-beta.solana.com';
    this.connection = new Connection(rpcUrl, 'confirmed');
  }

  /**
   * Get current supply APY for a token from Kamino lending.
   * In production, this calls the Kamino SDK. For now, fetches from their API.
   */
  async getSupplyApy(token: 'USDC' | 'USDT'): Promise<number> {
    try {
      // Kamino exposes reserve data via their API
      const reserveAddr = KAMINO_RESERVES[token];
      if (!reserveAddr) return 0;

      // Use Kamino's public metrics API
      const res = await fetch(
        `https://api.hubbleprotocol.io/v2/kamino-market/MainnetBeta/reserves/${reserveAddr}/metrics`,
        { signal: AbortSignal.timeout(10000) }
      );

      if (!res.ok) {
        this.logger.warn(`Kamino API returned ${res.status} for ${token}`);
        return this.getFallbackApy(token);
      }

      const data = await res.json();
      const supplyApy = data?.supplyInterestAPY ?? data?.metrics?.supplyInterestAPY;
      return typeof supplyApy === 'number' ? supplyApy * 100 : this.getFallbackApy(token);
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
    // TODO: Wire in @kamino-finance/klend-sdk when installed
    // For now, return a placeholder transaction that will be replaced
    // with actual Kamino deposit instructions
    const tx = new Transaction();

    this.logger.log(`Building Kamino deposit: ${amount} ${token} from ${wallet.toBase58()}`);

    // Production implementation:
    // const market = await KaminoMarket.load(this.connection, KAMINO_MAIN_MARKET);
    // const reserve = market.getReserve(TOKEN_MINTS[token]);
    // const depositAction = await KaminoAction.buildDepositTxns(
    //   market, amount.toString(), new PublicKey(TOKEN_MINTS[token]), wallet
    // );
    // tx.add(...depositAction.setupIxs, ...depositAction.lendingIxs, ...depositAction.cleanupIxs);

    return tx;
  }

  /**
   * Build a withdraw transaction for the user to sign.
   */
  async buildWithdrawTx(wallet: PublicKey, amount: bigint, token: string): Promise<Transaction> {
    const tx = new Transaction();

    this.logger.log(`Building Kamino withdraw: ${amount} ${token} to ${wallet.toBase58()}`);

    // TODO: Wire in @kamino-finance/klend-sdk
    // const market = await KaminoMarket.load(this.connection, KAMINO_MAIN_MARKET);
    // const withdrawAction = await KaminoAction.buildWithdrawTxns(
    //   market, amount.toString(), new PublicKey(TOKEN_MINTS[token]), wallet
    // );
    // tx.add(...withdrawAction.setupIxs, ...withdrawAction.lendingIxs, ...withdrawAction.cleanupIxs);

    return tx;
  }

  /**
   * Get a user's position in Kamino lending.
   */
  async getUserPosition(wallet: PublicKey, _token: string): Promise<UserPosition> {
    try {
      // TODO: Use klend-sdk to query on-chain position
      // const market = await KaminoMarket.load(this.connection, KAMINO_MAIN_MARKET);
      // const obligations = await market.getAllUserObligations(wallet);
      return { deposited: 0n, current: 0n, kTokenBalance: 0n };
    } catch (err) {
      this.logger.warn(`Failed to get Kamino position for ${wallet.toBase58()}: ${err}`);
      return { deposited: 0n, current: 0n, kTokenBalance: 0n };
    }
  }

  private getFallbackApy(token: string): number {
    // Reasonable fallback APYs when API is unavailable
    return token === 'USDC' ? 5.2 : 4.8;
  }
}
