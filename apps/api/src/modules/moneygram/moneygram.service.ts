import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma.service';
import { StellarAdapter } from './stellar.adapter';
import { AllbridgeAdapter } from './allbridge.adapter';

import { MoneygramStatus } from '@prisma/client';

const TERMINAL_STATUSES: MoneygramStatus[] = ['COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED'];
const MAX_RETRIES = 5;
const POLL_COOLDOWN_MS = 2 * 60 * 1000; // 2 min between polls per tx

@Injectable()
export class MoneygramService {
  private readonly logger = new Logger(MoneygramService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stellar: StellarAdapter,
    private readonly allbridge: AllbridgeAdapter
  ) {}

  get isEnabled(): boolean {
    // Enable in production only when the real adapters are configured.
    // In non-production environments we allow mock flows for UI/dev testing.
    if (this.stellar.isEnabled && this.allbridge.isEnabled) return true;
    return process.env.NODE_ENV !== 'production';
  }

  /** Off-ramp: Initiate cash-out (USDC → cash at MoneyGram) */
  async initiateOfframp(walletAddress: string, amountUsd: number) {
    if (amountUsd < 5 || amountUsd > 2500) {
      throw new BadRequestException('Amount must be between $5 and $2,500');
    }

    // Create DB record
    const tx = await this.prisma.moneygramTransaction.create({
      data: {
        walletAddress,
        direction: 'OFFRAMP',
        amountUsd,
        status: 'INITIATED',
      },
    });

    try {
      // SEP-10 auth + SEP-24 withdraw
      const token = await this.stellar.authenticate(tx.id);
      const withdraw = await this.stellar.initiateWithdraw(token, amountUsd.toFixed(2));

      // Update with Stellar data
      await this.prisma.moneygramTransaction.update({
        where: { id: tx.id },
        data: {
          stellarTransactionId: withdraw.id,
          interactiveUrl: withdraw.url,
          stellarMemo: withdraw.memo,
          stellarDestination: withdraw.destination,
          status: 'PENDING_KYC',
        },
      });

      this.logger.log(`MoneyGram offramp initiated: ${tx.id} → ${withdraw.id}`);

      return {
        id: tx.id,
        interactiveUrl: withdraw.url,
        stellarTransactionId: withdraw.id,
        status: 'PENDING_KYC',
      };
    } catch (error) {
      await this.prisma.moneygramTransaction.update({
        where: { id: tx.id },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Initiation failed',
        },
      });
      throw error;
    }
  }

  /** Off-ramp: Confirm after user completes MoneyGram webview */
  async confirmOfframp(walletAddress: string, transactionId: string) {
    const tx = await this.prisma.moneygramTransaction.findUnique({
      where: { id: transactionId },
    });

    if (!tx || tx.walletAddress !== walletAddress) {
      throw new NotFoundException('Transaction not found');
    }

    if (tx.status !== 'INITIATED' && tx.status !== 'PENDING_KYC') {
      throw new BadRequestException('Transaction cannot be confirmed in current state');
    }

    await this.prisma.moneygramTransaction.update({
      where: { id: transactionId },
      data: { status: 'CONFIRMED', confirmedAt: new Date() },
    });

    this.logger.log(`MoneyGram offramp confirmed: ${transactionId}`);

    return { id: transactionId, status: 'CONFIRMED' };
  }

  /** On-ramp: Initiate cash deposit (cash → USDC in wallet) */
  async initiateOnramp(walletAddress: string, amountUsd: number) {
    if (amountUsd < 5 || amountUsd > 950) {
      throw new BadRequestException('Amount must be between $5 and $950');
    }

    const tx = await this.prisma.moneygramTransaction.create({
      data: {
        walletAddress,
        direction: 'ONRAMP',
        amountUsd,
        status: 'INITIATED',
      },
    });

    try {
      const token = await this.stellar.authenticate(tx.id);
      const deposit = await this.stellar.initiateDeposit(token, amountUsd.toFixed(2));

      await this.prisma.moneygramTransaction.update({
        where: { id: tx.id },
        data: {
          stellarTransactionId: deposit.id,
          interactiveUrl: deposit.url,
          status: 'PENDING_KYC',
        },
      });

      this.logger.log(`MoneyGram onramp initiated: ${tx.id} → ${deposit.id}`);

      return {
        id: tx.id,
        interactiveUrl: deposit.url,
        stellarTransactionId: deposit.id,
        status: 'PENDING_KYC',
      };
    } catch (error) {
      await this.prisma.moneygramTransaction.update({
        where: { id: tx.id },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Initiation failed',
        },
      });
      throw error;
    }
  }

  /** Get a single transaction */
  async getTransaction(walletAddress: string, transactionId: string) {
    const tx = await this.prisma.moneygramTransaction.findUnique({
      where: { id: transactionId },
    });

    if (!tx || tx.walletAddress !== walletAddress) {
      throw new NotFoundException('Transaction not found');
    }

    return tx;
  }

  /** List transactions for a wallet */
  async getTransactions(walletAddress: string, direction?: 'ONRAMP' | 'OFFRAMP') {
    return this.prisma.moneygramTransaction.findMany({
      where: {
        walletAddress,
        ...(direction ? { direction } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /** Cancel a transaction */
  async cancelTransaction(walletAddress: string, transactionId: string) {
    const tx = await this.prisma.moneygramTransaction.findUnique({
      where: { id: transactionId },
    });

    if (!tx || tx.walletAddress !== walletAddress) {
      throw new NotFoundException('Transaction not found');
    }

    if (TERMINAL_STATUSES.includes(tx.status)) {
      throw new BadRequestException('Transaction cannot be cancelled');
    }

    await this.prisma.moneygramTransaction.update({
      where: { id: transactionId },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });

    this.logger.log(`MoneyGram transaction cancelled: ${transactionId}`);

    return { id: transactionId, status: 'CANCELLED' };
  }

  /** Estimate fees for a transaction */
  async estimateFees(amountUsd: number, direction: 'ONRAMP' | 'OFFRAMP') {
    const bridgeDirection = direction === 'OFFRAMP' ? 'solana_to_stellar' : 'stellar_to_solana';
    const bridgeFee = await this.allbridge.estimateFee(amountUsd, bridgeDirection);

    // MoneyGram fee estimate (~2-4% based on typical remittance fees)
    const mgFeeEstimate = parseFloat((amountUsd * 0.03).toFixed(2));
    const totalFees = parseFloat((bridgeFee.feeUsd + mgFeeEstimate).toFixed(2));
    const netAmount = parseFloat((amountUsd - totalFees).toFixed(2));

    return {
      amountUsd,
      direction,
      bridgeFee: bridgeFee.feeUsd,
      bridgeFeePercent: bridgeFee.feePercent,
      mgFeeEstimate,
      totalFees,
      netAmount,
      estimatedTime: bridgeFee.estimatedTimeSeconds + 600, // bridge + MoneyGram processing
    };
  }

  /** Cron: Process pending MoneyGram transactions every 5 minutes */
  @Cron('0 */5 * * * *')
  async processTransactions() {
    // Acquire cron lock
    const lockId = `moneygram-processor-${Date.now()}`;
    try {
      await this.prisma.cronLock.create({
        data: {
          jobName: 'moneygram-process',
          lockedBy: lockId,
          expiresAt: new Date(Date.now() + 4 * 60 * 1000), // 4 min lock
        },
      });
    } catch {
      return; // Another instance holds the lock
    }

    try {
      const pendingTxs = await this.prisma.moneygramTransaction.findMany({
        where: {
          status: { notIn: TERMINAL_STATUSES },
          retryCount: { lt: MAX_RETRIES },
        },
        take: 20,
        orderBy: { lastPolledAt: 'asc' },
      });

      for (const tx of pendingTxs) {
        // Respect polling cooldown
        if (tx.lastPolledAt && Date.now() - tx.lastPolledAt.getTime() < POLL_COOLDOWN_MS) {
          continue;
        }

        try {
          if (tx.direction === 'OFFRAMP') {
            await this.processOfframpTransaction(tx);
          } else {
            await this.processOnrampTransaction(tx);
          }
        } catch (error) {
          this.logger.error(`Error processing MoneyGram tx ${tx.id}: ${error}`);
          await this.prisma.moneygramTransaction.update({
            where: { id: tx.id },
            data: {
              retryCount: { increment: 1 },
              lastPolledAt: new Date(),
              ...(tx.retryCount + 1 >= MAX_RETRIES
                ? { status: 'FAILED', errorMessage: 'Max retries exceeded' }
                : {}),
            },
          });
        }
      }
    } finally {
      await this.prisma.cronLock
        .update({
          where: { id: lockId },
          data: { completedAt: new Date() },
        })
        .catch(() => {});
    }
  }

  /** Process a single off-ramp transaction state machine */
  private async processOfframpTransaction(tx: {
    id: string;
    status: string;
    stellarTransactionId: string | null;
    stellarDestination: string | null;
    stellarMemo: string | null;
    amountUsd: number;
  }) {
    if (!tx.stellarTransactionId) return;

    const token = await this.stellar.authenticate(tx.id);
    const stellarTx = await this.stellar.getTransactionStatus(token, tx.stellarTransactionId);

    await this.prisma.moneygramTransaction.update({
      where: { id: tx.id },
      data: { lastPolledAt: new Date() },
    });

    if (tx.status === 'CONFIRMED' && stellarTx.status === 'pending_user_transfer_start') {
      // Ready to bridge and send USDC
      await this.prisma.moneygramTransaction.update({
        where: { id: tx.id },
        data: { status: 'BRIDGING' },
      });

      try {
        // Bridge Solana USDC → Stellar USDC
        const bridge = await this.allbridge.bridgeSolanaToStellar(tx.amountUsd.toFixed(2));

        await this.prisma.moneygramTransaction.update({
          where: { id: tx.id },
          data: {
            bridgeTxSolana: bridge.sourceChainTx,
            bridgeStatus: 'COMPLETED',
          },
        });

        // Send Stellar USDC to MoneyGram
        const destination = stellarTx.withdraw_anchor_account || tx.stellarDestination || '';
        const memo = stellarTx.withdraw_memo || tx.stellarMemo || '';
        const amount = stellarTx.amount_in || tx.amountUsd.toFixed(2);

        const stellarPaymentTx = await this.stellar.sendPayment(destination, amount, memo);

        await this.prisma.moneygramTransaction.update({
          where: { id: tx.id },
          data: {
            bridgeTxStellar: stellarPaymentTx,
            status: 'USDC_SENT',
            mgFeeUsd: stellarTx.amount_fee ? parseFloat(stellarTx.amount_fee) : null,
          },
        });

        this.logger.log(`MoneyGram offramp USDC sent: ${tx.id}`);
      } catch (error) {
        this.logger.error(`MoneyGram offramp bridge/send failed for ${tx.id}: ${error}`);
        await this.prisma.moneygramTransaction.update({
          where: { id: tx.id },
          data: {
            status: 'FAILED',
            errorMessage: `Bridge/send error: ${error instanceof Error ? error.message : String(error)}`,
          },
        });
      }
    }

    if (tx.status === 'USDC_SENT' && stellarTx.status === 'pending_user_transfer_complete') {
      await this.prisma.moneygramTransaction.update({
        where: { id: tx.id },
        data: {
          status: 'PENDING_PICKUP',
          referenceNumber: stellarTx.external_transaction_id || null,
        },
      });
    }

    if (stellarTx.status === 'completed') {
      await this.prisma.moneygramTransaction.update({
        where: { id: tx.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          referenceNumber: stellarTx.external_transaction_id || tx.stellarTransactionId,
        },
      });
      this.logger.log(`MoneyGram offramp completed: ${tx.id}`);
    }

    if (stellarTx.status === 'error' || stellarTx.status === 'expired') {
      await this.prisma.moneygramTransaction.update({
        where: { id: tx.id },
        data: {
          status: 'FAILED',
          errorMessage: `MoneyGram status: ${stellarTx.status}`,
        },
      });
    }
  }

  /** Process a single on-ramp transaction state machine */
  private async processOnrampTransaction(tx: {
    id: string;
    status: string;
    stellarTransactionId: string | null;
    walletAddress: string;
    amountUsd: number;
  }) {
    if (!tx.stellarTransactionId) return;

    const token = await this.stellar.authenticate(tx.id);
    const stellarTx = await this.stellar.getTransactionStatus(token, tx.stellarTransactionId);

    await this.prisma.moneygramTransaction.update({
      where: { id: tx.id },
      data: { lastPolledAt: new Date() },
    });

    if (stellarTx.status === 'pending_user_transfer_start') {
      // User needs to deposit cash at MoneyGram
      if (tx.status !== 'PENDING_DEPOSIT') {
        await this.prisma.moneygramTransaction.update({
          where: { id: tx.id },
          data: { status: 'PENDING_DEPOSIT' },
        });
      }
    }

    if (stellarTx.status === 'completed') {
      // MoneyGram sent Stellar USDC to our account
      await this.prisma.moneygramTransaction.update({
        where: { id: tx.id },
        data: { status: 'USDC_RECEIVED' },
      });

      // Bridge Stellar USDC → Solana USDC
      await this.prisma.moneygramTransaction.update({
        where: { id: tx.id },
        data: { status: 'BRIDGING_BACK' },
      });

      const amount = stellarTx.amount_out || tx.amountUsd.toFixed(2);
      const bridge = await this.allbridge.bridgeStellarToSolana(amount, tx.walletAddress);

      await this.prisma.moneygramTransaction.update({
        where: { id: tx.id },
        data: {
          bridgeTxStellar: bridge.sourceChainTx,
          bridgeStatus: 'COMPLETED',
          status: 'COMPLETED',
          completedAt: new Date(),
          netAmountUsd: stellarTx.amount_out ? parseFloat(stellarTx.amount_out) : null,
          mgFeeUsd: stellarTx.amount_fee ? parseFloat(stellarTx.amount_fee) : null,
        },
      });

      this.logger.log(`MoneyGram onramp completed: ${tx.id}`);
    }

    if (stellarTx.status === 'error' || stellarTx.status === 'expired') {
      await this.prisma.moneygramTransaction.update({
        where: { id: tx.id },
        data: {
          status: 'FAILED',
          errorMessage: `MoneyGram status: ${stellarTx.status}`,
        },
      });
    }
  }
}
