import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  ParsedTransactionWithMeta,
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

export interface TokenAccount {
  mint: string;
  amount: number;
}

@Injectable()
export class SolanaService {
  private readonly logger = new Logger(SolanaService.name);
  private connection: Connection;

  constructor(private configService: ConfigService) {
    const rpcUrl =
      this.configService.get('SOLANA_RPC_URL') || 'https://api.mainnet-beta.solana.com';
    this.connection = new Connection(rpcUrl, 'confirmed');
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

  async getTransactionHistory(
    address: string,
    limit = 20
  ): Promise<
    {
      signature: string;
      timestamp: number;
      type: string;
      amount?: number;
      token?: string;
    }[]
  > {
    try {
      const publicKey = new PublicKey(address);
      const signatures = await this.connection.getSignaturesForAddress(publicKey, { limit });

      const transactions: {
        signature: string;
        timestamp: number;
        type: string;
        amount?: number;
        token?: string;
      }[] = [];

      for (const sig of signatures) {
        transactions.push({
          signature: sig.signature,
          timestamp: sig.blockTime || 0,
          type: 'transfer', // Simplified - would need to parse for actual type
        });
      }

      return transactions;
    } catch (error) {
      this.logger.error('Error fetching transactions:', error);
      return [];
    }
  }

  getConnection(): Connection {
    return this.connection;
  }
}
