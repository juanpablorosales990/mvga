import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

export interface TokenAccount {
  mint: string;
  amount: number;
}

export interface EnhancedTransaction {
  signature: string;
  timestamp: number;
  type: string;
  source: string;
  description: string;
  fee: number;
  feePayer: string;
  nativeTransfers: { fromUserAccount: string; toUserAccount: string; amount: number }[];
  tokenTransfers: {
    fromUserAccount: string;
    toUserAccount: string;
    mint: string;
    tokenAmount: number;
    tokenStandard: string;
  }[];
  amount?: number;
  token?: string;
}

@Injectable()
export class SolanaService {
  private readonly logger = new Logger(SolanaService.name);
  private connection: Connection;
  private readonly heliusApiKey: string;
  private readonly heliusBaseUrl: string;

  constructor(private configService: ConfigService) {
    const rpcUrl =
      this.configService.get('SOLANA_RPC_URL') || 'https://api.mainnet-beta.solana.com';
    this.connection = new Connection(rpcUrl, 'confirmed');
    this.heliusApiKey = this.configService.get('HELIUS_API_KEY') || '';
    this.heliusBaseUrl = 'https://api.helius.xyz/v0';
  }

  async getSolBalance(address: string): Promise<number> {
    try {
      const publicKey = new PublicKey(address);
      const balance = await this.connection.getBalance(publicKey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      this.logger.error('Error fetching SOL balance:', error);
      return 0;
    }
  }

  async getTokenAccounts(address: string): Promise<TokenAccount[]> {
    try {
      const publicKey = new PublicKey(address);
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(publicKey, {
        programId: TOKEN_PROGRAM_ID,
      });

      return tokenAccounts.value.map((account) => {
        const parsed = account.account.data.parsed.info;
        return {
          mint: parsed.mint,
          amount: parsed.tokenAmount.uiAmount || 0,
        };
      });
    } catch (error) {
      this.logger.error('Error fetching token accounts:', error);
      return [];
    }
  }

  async getTransactionHistory(address: string, limit = 20): Promise<EnhancedTransaction[]> {
    // Try Helius enhanced API first for rich transaction data
    if (this.heliusApiKey) {
      try {
        return await this.getHeliusTransactions(address, limit);
      } catch (error) {
        this.logger.warn('Helius API failed, falling back to basic RPC:', error);
      }
    }

    // Fallback to basic RPC
    return this.getBasicTransactions(address, limit);
  }

  private async getHeliusTransactions(
    address: string,
    limit: number
  ): Promise<EnhancedTransaction[]> {
    const url = `${this.heliusBaseUrl}/addresses/${address}/transactions?api-key=${this.heliusApiKey}&limit=${limit}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      throw new Error(`Helius API error: ${res.status}`);
    }

    const data: Array<{
      signature: string;
      timestamp: number;
      type: string;
      source: string;
      description: string;
      fee: number;
      feePayer: string;
      nativeTransfers?: { fromUserAccount: string; toUserAccount: string; amount: number }[];
      tokenTransfers?: {
        fromUserAccount: string;
        toUserAccount: string;
        mint: string;
        tokenAmount: number;
        tokenStandard: string;
      }[];
    }> = await res.json();

    return data.map((tx) => {
      // Extract primary amount and token from transfers
      let amount: number | undefined;
      let token: string | undefined;

      if (tx.tokenTransfers?.length) {
        const transfer = tx.tokenTransfers[0];
        amount = transfer.tokenAmount;
        token = this.mintToSymbol(transfer.mint);
      } else if (tx.nativeTransfers?.length) {
        const transfer = tx.nativeTransfers[0];
        amount = transfer.amount / LAMPORTS_PER_SOL;
        token = 'SOL';
      }

      return {
        signature: tx.signature,
        timestamp: tx.timestamp,
        type: tx.type || 'UNKNOWN',
        source: tx.source || 'UNKNOWN',
        description: tx.description || '',
        fee: tx.fee,
        feePayer: tx.feePayer,
        nativeTransfers: tx.nativeTransfers || [],
        tokenTransfers: tx.tokenTransfers || [],
        amount,
        token,
      };
    });
  }

  private async getBasicTransactions(
    address: string,
    limit: number
  ): Promise<EnhancedTransaction[]> {
    try {
      const publicKey = new PublicKey(address);
      const signatures = await this.connection.getSignaturesForAddress(publicKey, { limit });

      return signatures.map((sig) => ({
        signature: sig.signature,
        timestamp: sig.blockTime || 0,
        type: 'TRANSFER',
        source: 'SYSTEM_PROGRAM',
        description: '',
        fee: 0,
        feePayer: address,
        nativeTransfers: [],
        tokenTransfers: [],
      }));
    } catch (error) {
      this.logger.error('Error fetching transactions:', error);
      return [];
    }
  }

  private mintToSymbol(mint: string): string {
    const symbols: Record<string, string> = {
      So11111111111111111111111111111111111111112: 'SOL',
      EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: 'USDC',
      Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: 'USDT',
      DRX65kM2n5CLTpdjJCemZvkUwE98ou4RpHrd8Z3GH5Qh: 'MVGA',
    };
    return symbols[mint] || mint.slice(0, 6) + '...';
  }

  getConnection(): Connection {
    return this.connection;
  }
}
