import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface BridgeResult {
  transferId: string;
  sourceChainTx: string;
  estimatedTime: number; // seconds
}

export interface BridgeFeeEstimate {
  feeUsd: number;
  feePercent: number;
  estimatedTimeSeconds: number;
}

export interface BridgeStatus {
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  sourceChainTx?: string;
  destinationChainTx?: string;
}

@Injectable()
export class AllbridgeAdapter {
  private readonly logger = new Logger(AllbridgeAdapter.name);
  private readonly baseUrl: string;
  private readonly isMock: boolean;

  constructor(private readonly config: ConfigService) {
    this.baseUrl =
      this.config.get<string>('ALLBRIDGE_API_URL') || 'https://core.api.allbridgecoreapi.net';
    this.isMock = this.config.get<string>('MONEYGRAM_ENVIRONMENT') === 'mock';
  }

  get isEnabled(): boolean {
    return !this.isMock;
  }

  /** Bridge USDC from Solana to Stellar */
  async bridgeSolanaToStellar(amountUsdc: string): Promise<BridgeResult> {
    if (!this.isEnabled) {
      return {
        transferId: `MOCK_BRIDGE_S2ST_${Date.now()}`,
        sourceChainTx: `MOCK_SOL_TX_${Date.now()}`,
        estimatedTime: 180,
      };
    }

    try {
      // Get transfer parameters from Allbridge Core API
      const res = await fetch(`${this.baseUrl}/v1/bridge/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceChain: 'SOL',
          destinationChain: 'STLR',
          sourceToken: 'USDC',
          destinationToken: 'USDC',
          amount: amountUsdc,
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Allbridge transfer initiation failed: ${res.status} ${body}`);
      }

      const data = await res.json();
      this.logger.log(`Allbridge SOL→STLR bridge initiated: ${data.transferId}`);

      return {
        transferId: data.transferId,
        sourceChainTx: data.sourceChainTxId || '',
        estimatedTime: data.estimatedTime || 300,
      };
    } catch (error) {
      this.logger.error(`Allbridge SOL→STLR bridge failed: ${error}`);
      throw error;
    }
  }

  /** Bridge USDC from Stellar to Solana */
  async bridgeStellarToSolana(
    amountUsdc: string,
    destinationWallet: string
  ): Promise<BridgeResult> {
    if (!this.isEnabled) {
      return {
        transferId: `MOCK_BRIDGE_ST2S_${Date.now()}`,
        sourceChainTx: `MOCK_STLR_TX_${Date.now()}`,
        estimatedTime: 180,
      };
    }

    try {
      const res = await fetch(`${this.baseUrl}/v1/bridge/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceChain: 'STLR',
          destinationChain: 'SOL',
          sourceToken: 'USDC',
          destinationToken: 'USDC',
          amount: amountUsdc,
          destinationAddress: destinationWallet,
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Allbridge transfer initiation failed: ${res.status} ${body}`);
      }

      const data = await res.json();
      this.logger.log(`Allbridge STLR→SOL bridge initiated: ${data.transferId}`);

      return {
        transferId: data.transferId,
        sourceChainTx: data.sourceChainTxId || '',
        estimatedTime: data.estimatedTime || 300,
      };
    } catch (error) {
      this.logger.error(`Allbridge STLR→SOL bridge failed: ${error}`);
      throw error;
    }
  }

  /** Estimate bridge fees */
  async estimateFee(
    amountUsd: number,
    direction: 'solana_to_stellar' | 'stellar_to_solana'
  ): Promise<BridgeFeeEstimate> {
    if (!this.isEnabled) {
      const feePercent = 0.3;
      return {
        feeUsd: Math.round(amountUsd * feePercent) / 100,
        feePercent,
        estimatedTimeSeconds: 180,
      };
    }

    try {
      const [source, dest] = direction === 'solana_to_stellar' ? ['SOL', 'STLR'] : ['STLR', 'SOL'];

      const res = await fetch(
        `${this.baseUrl}/v1/bridge/estimate?` +
          `sourceChain=${source}&destinationChain=${dest}&` +
          `sourceToken=USDC&destinationToken=USDC&amount=${amountUsd}`
      );

      if (!res.ok) {
        // Fallback to default estimate
        return { feeUsd: amountUsd * 0.003, feePercent: 0.3, estimatedTimeSeconds: 300 };
      }

      const data = await res.json();
      return {
        feeUsd: parseFloat(data.fee || '0'),
        feePercent: (parseFloat(data.fee || '0') / amountUsd) * 100,
        estimatedTimeSeconds: data.estimatedTime || 300,
      };
    } catch {
      return { feeUsd: amountUsd * 0.003, feePercent: 0.3, estimatedTimeSeconds: 300 };
    }
  }

  /** Check bridge transfer status */
  async getTransferStatus(transferId: string): Promise<BridgeStatus> {
    if (!this.isEnabled) {
      return {
        status: 'COMPLETED',
        sourceChainTx: transferId,
        destinationChainTx: `MOCK_DEST_${Date.now()}`,
      };
    }

    try {
      const res = await fetch(`${this.baseUrl}/v1/bridge/transfer/${transferId}/status`);

      if (!res.ok) {
        return { status: 'PENDING' };
      }

      const data = await res.json();
      const statusMap: Record<string, BridgeStatus['status']> = {
        pending: 'PENDING',
        in_progress: 'IN_PROGRESS',
        completed: 'COMPLETED',
        failed: 'FAILED',
      };

      return {
        status: statusMap[data.status] || 'PENDING',
        sourceChainTx: data.sourceChainTxId,
        destinationChainTx: data.destinationChainTxId,
      };
    } catch {
      return { status: 'PENDING' };
    }
  }
}
