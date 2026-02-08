import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma.service';
import { CronLockService } from '../../common/cron-lock.service';
import { SolanaService } from '../wallet/solana.service';
import { Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  getAccount,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import { RecordFeeDto } from './treasury.dto';
import { BurnService } from '../burn/burn.service';
import { StakingService } from '../staking/staking.service';

// Fee sharing: 50% of staking bucket goes to pro-rata fee sharing
const FEE_SHARE_PERCENT = 50;

// Distribution percentages (applied to distributable amount after burn)
const LIQUIDITY_PERCENT = 40;
const STAKING_PERCENT = 40;
const GRANTS_PERCENT = 20;
const BURN_PERCENT = 5; // 5% burned before distribution

const MVGA_DECIMALS = 9;

@Injectable()
export class TreasuryService {
  private readonly logger = new Logger(TreasuryService.name);
  private treasuryKeypair: Keypair | null = null;
  private mvgaMint: PublicKey;
  private usdcMint: PublicKey;

  // Treasury wallet addresses (from env or defaults)
  private readonly liquidityWallet: string;
  private readonly stakingWallet: string;
  private readonly grantsWallet: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cronLockService: CronLockService,
    private readonly solana: SolanaService,
    private readonly config: ConfigService,
    private readonly burnService: BurnService,
    private readonly stakingService: StakingService
  ) {
    this.mvgaMint = new PublicKey(
      this.config.get('MVGA_TOKEN_MINT', 'DRX65kM2n5CLTpdjJCemZvkUwE98ou4RpHrd8Z3GH5Qh')
    );
    this.usdcMint = new PublicKey(
      this.config.get('USDC_MINT', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
    );

    // Load treasury keypair from env
    const treasuryKeypairStr = this.config.get<string>('TREASURY_KEYPAIR');
    if (treasuryKeypairStr) {
      try {
        const decoded = Buffer.from(treasuryKeypairStr, 'base64');
        this.treasuryKeypair = Keypair.fromSecretKey(
          new Uint8Array(JSON.parse(decoded.toString()))
        );
        this.logger.log('Treasury keypair loaded');
      } catch (e) {
        this.logger.error(`TREASURY_KEYPAIR is set but invalid: ${(e as Error).message}`);
      }
    } else {
      this.logger.warn('TREASURY_KEYPAIR not set — auto-distribution disabled');
    }

    // Wallet addresses
    this.liquidityWallet = this.config.get(
      'LIQUIDITY_WALLET',
      'HWRFGiMDWNvPHo5ZLV1MJEDjDNFVDJ8KJMDXcJjLVGa8'
    );
    this.stakingWallet = this.config.get(
      'STAKING_VAULT_WALLET',
      'GNhLCjqThNJAJAdDYvRTr2EfWyGXAFUymaPuKaL1duEh'
    );
    this.grantsWallet = this.config.get(
      'GRANTS_WALLET',
      '9oeQpF87vYz1LmHDBqx1xvGsFxbRVJXmgNvRFYg3e8AQ'
    );
  }

  /**
   * Weekly cron job: Every Monday at 00:00 UTC
   * Distributes all collected fees to: liquidity (40%), staking (40%), grants (20%)
   */
  private static readonly STEP_ORDER = [
    'BURN',
    'LIQUIDITY',
    'STAKING',
    'GRANTS',
    'FEE_SNAPSHOT',
    'MARK_COLLECTED',
  ];

  @Cron(CronExpression.EVERY_WEEK)
  async executeWeeklyDistribution() {
    const lockId = await this.cronLockService.acquireLock('weekly-distribution', 900_000);
    if (!lockId) {
      this.logger.debug('Weekly distribution: another instance holds the lock, skipping');
      return;
    }

    try {
      this.logger.log('Starting weekly treasury distribution...');

      if (!this.treasuryKeypair) {
        this.logger.warn('Treasury keypair not configured, skipping distribution');
        return;
      }

      // Check for an existing IN_PROGRESS distribution (resume after crash)
      let distribution = await this.prisma.treasuryDistribution.findFirst({
        where: { status: 'IN_PROGRESS' },
        include: { steps: true },
      });

      if (!distribution) {
        distribution = await this.createDistributionWithSteps();
        if (!distribution) return; // No fees to distribute
      }

      // Execute each step in order; skip already-completed steps
      for (const stepName of TreasuryService.STEP_ORDER) {
        const step = distribution.steps.find((s) => s.stepName === stepName);
        if (!step || step.status === 'COMPLETED' || step.status === 'SKIPPED') continue;

        try {
          await this.executeDistributionStep(distribution, step);
        } catch (error: unknown) {
          const errMsg = error instanceof Error ? error.message : String(error);
          await this.prisma.distributionStep.update({
            where: { id: step.id },
            data: { status: 'FAILED', error: errMsg, completedAt: new Date() },
          });

          // Burn and FEE_SNAPSHOT failures are non-critical, continue
          if (stepName !== 'BURN' && stepName !== 'FEE_SNAPSHOT') {
            this.logger.error(`Critical step ${stepName} failed, halting distribution: ${errMsg}`);
            break;
          }
          this.logger.warn(`Non-critical step ${stepName} failed, continuing: ${errMsg}`);
        }
      }

      // Check final state
      const updatedSteps = await this.prisma.distributionStep.findMany({
        where: { distributionId: distribution.id },
      });

      const allDone = updatedSteps.every(
        (s) => s.status === 'COMPLETED' || s.status === 'SKIPPED' || s.status === 'FAILED'
      );
      const criticalFailed = updatedSteps.some(
        (s) => s.status === 'FAILED' && !['BURN', 'FEE_SNAPSHOT'].includes(s.stepName)
      );

      if (allDone) {
        await this.prisma.treasuryDistribution.update({
          where: { id: distribution.id },
          data: {
            status: criticalFailed ? 'FAILED' : 'COMPLETED',
            executedAt: new Date(),
            burnTx: updatedSteps.find((s) => s.stepName === 'BURN')?.signature ?? null,
            liquidityTx: updatedSteps.find((s) => s.stepName === 'LIQUIDITY')?.signature ?? null,
            stakingTx: updatedSteps.find((s) => s.stepName === 'STAKING')?.signature ?? null,
            grantsTx: updatedSteps.find((s) => s.stepName === 'GRANTS')?.signature ?? null,
          },
        });

        if (!criticalFailed) {
          await this.updateBalanceSnapshot();
          this.logger.log(
            `Weekly distribution completed! Total: ${Number(distribution.totalAmount) / 10 ** MVGA_DECIMALS} MVGA`
          );
        } else {
          this.logger.error(
            'Weekly distribution partially failed — check DistributionStep records'
          );
        }
      }
    } catch (error) {
      this.logger.error('Weekly distribution failed:', error);
    } finally {
      await this.cronLockService.releaseLock(lockId);
    }
  }

  private async createDistributionWithSteps() {
    const periodEnd = new Date();
    const periodStart = new Date(periodEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

    const uncollectedFees = await this.prisma.feeCollection.findMany({
      where: { collected: false },
    });

    if (uncollectedFees.length === 0) {
      this.logger.log('No fees to distribute this period');
      return null;
    }

    const swapFees = uncollectedFees
      .filter((f) => f.source === 'SWAP')
      .reduce((sum, f) => sum + f.amount, BigInt(0));
    const topupFees = uncollectedFees
      .filter((f) => f.source === 'MOBILE_TOPUP')
      .reduce((sum, f) => sum + f.amount, BigInt(0));
    const giftcardFees = uncollectedFees
      .filter((f) => f.source === 'GIFT_CARD')
      .reduce((sum, f) => sum + f.amount, BigInt(0));
    const yieldEarnings = uncollectedFees
      .filter((f) => f.source === 'YIELD')
      .reduce((sum, f) => sum + f.amount, BigInt(0));

    const totalAmount = swapFees + topupFees + giftcardFees + yieldEarnings;
    if (totalAmount === BigInt(0)) {
      this.logger.log('Total fees are zero, skipping distribution');
      return null;
    }

    const burnAmount = (totalAmount * BigInt(BURN_PERCENT)) / BigInt(100);
    const distributable = totalAmount - burnAmount;
    const liquidityAmount = (distributable * BigInt(LIQUIDITY_PERCENT)) / BigInt(100);
    const stakingAmount = (distributable * BigInt(STAKING_PERCENT)) / BigInt(100);
    const grantsAmount = (distributable * BigInt(GRANTS_PERCENT)) / BigInt(100);

    const distribution = await this.prisma.treasuryDistribution.create({
      data: {
        totalAmount,
        burnAmount,
        liquidityAmount,
        stakingAmount,
        grantsAmount,
        swapFees,
        topupFees,
        giftcardFees,
        yieldEarnings,
        status: 'IN_PROGRESS',
        periodStart,
        periodEnd,
        steps: {
          create: TreasuryService.STEP_ORDER.map((stepName) => ({ stepName })),
        },
      },
      include: { steps: true },
    });

    return distribution;
  }

  private async executeDistributionStep(
    distribution: {
      id: string;
      burnAmount: bigint;
      liquidityAmount: bigint;
      stakingAmount: bigint;
      grantsAmount: bigint;
      periodEnd: Date;
    },
    step: { id: string; stepName: string; status: string; signature?: string | null }
  ): Promise<void> {
    await this.prisma.distributionStep.update({
      where: { id: step.id },
      data: { status: 'IN_PROGRESS', startedAt: new Date() },
    });

    // Idempotency: if this step already has a signature, the on-chain tx succeeded
    // in a previous attempt even though the DB update may have failed. Skip re-execution.
    if (step.signature) {
      this.logger.log(
        `Step ${step.stepName} already has signature ${step.signature}, marking complete`
      );
      await this.prisma.distributionStep.update({
        where: { id: step.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      return;
    }

    let signature: string | null = null;

    switch (step.stepName) {
      case 'BURN':
        if (distribution.burnAmount > BigInt(0)) {
          signature = await this.burnService.executeBurn(distribution.burnAmount, 'WEEKLY');
          this.logger.log(
            `Burn: ${Number(distribution.burnAmount) / 10 ** MVGA_DECIMALS} MVGA — tx: ${signature}`
          );
        }
        break;

      case 'LIQUIDITY':
        if (distribution.liquidityAmount > BigInt(0)) {
          signature = await this.transferMVGA(this.liquidityWallet, distribution.liquidityAmount);
          this.logger.log(`Liquidity transfer: ${signature}`);
        }
        break;

      case 'STAKING': {
        const feeShareAmount =
          (distribution.stakingAmount * BigInt(FEE_SHARE_PERCENT)) / BigInt(100);
        const vaultRefillAmount = distribution.stakingAmount - feeShareAmount;
        if (vaultRefillAmount > BigInt(0)) {
          signature = await this.transferMVGA(this.stakingWallet, vaultRefillAmount);
          this.logger.log(`Staking vault refill: ${signature}`);
        }
        break;
      }

      case 'GRANTS':
        if (distribution.grantsAmount > BigInt(0)) {
          signature = await this.transferMVGA(this.grantsWallet, distribution.grantsAmount);
          this.logger.log(`Grants transfer: ${signature}`);
        }
        break;

      case 'FEE_SNAPSHOT': {
        // Only create fee snapshot if STAKING step succeeded — prevents crediting
        // stakers for fees that were never actually transferred to the vault
        const stakingStep = await this.prisma.distributionStep.findFirst({
          where: {
            distributionId: distribution.id,
            stepName: 'STAKING',
            status: 'COMPLETED',
          },
        });
        if (!stakingStep) {
          this.logger.warn(
            'STAKING step did not complete — skipping FEE_SNAPSHOT to prevent phantom credits'
          );
          await this.prisma.distributionStep.update({
            where: { id: step.id },
            data: { status: 'SKIPPED', completedAt: new Date() },
          });
          return;
        }

        const feeShare = (distribution.stakingAmount * BigInt(FEE_SHARE_PERCENT)) / BigInt(100);
        if (feeShare > BigInt(0)) {
          const totalWeight = await this.stakingService.getTotalStakeWeight();
          if (totalWeight > BigInt(0)) {
            const feePerWeight = Number(feeShare) / Number(totalWeight);
            await this.prisma.feeSnapshot.create({
              data: {
                totalFees: feeShare,
                totalWeight,
                feePerWeight,
                periodEnd: distribution.periodEnd,
              },
            });
            this.logger.log(`Fee snapshot created: ${Number(feeShare) / 10 ** MVGA_DECIMALS} MVGA`);
          }
        }
        break;
      }

      case 'MARK_COLLECTED':
        await this.prisma.feeCollection.updateMany({
          where: { collected: false },
          data: { collected: true, collectedAt: new Date() },
        });
        this.logger.log('Fees marked as collected');
        break;
    }

    await this.prisma.distributionStep.update({
      where: { id: step.id },
      data: { status: 'COMPLETED', signature, completedAt: new Date() },
    });
  }

  /**
   * Transfer MVGA tokens from treasury to destination
   */
  private async transferMVGA(destination: string, amount: bigint): Promise<string> {
    if (!this.treasuryKeypair) {
      throw new Error('Treasury keypair not configured');
    }

    const connection = this.solana.getConnection();
    const destPubkey = new PublicKey(destination);

    const treasuryAta = await getAssociatedTokenAddress(
      this.mvgaMint,
      this.treasuryKeypair.publicKey
    );
    const destAta = await getAssociatedTokenAddress(this.mvgaMint, destPubkey);

    const tx = new Transaction();

    // Check if destination ATA exists, create if not
    try {
      await getAccount(connection, destAta);
    } catch {
      tx.add(
        createAssociatedTokenAccountInstruction(
          this.treasuryKeypair.publicKey,
          destAta,
          destPubkey,
          this.mvgaMint
        )
      );
    }

    tx.add(createTransferInstruction(treasuryAta, destAta, this.treasuryKeypair.publicKey, amount));

    return sendAndConfirmTransaction(connection, tx, [this.treasuryKeypair]);
  }

  /**
   * Record a fee collection for later distribution
   */
  async recordFee(dto: RecordFeeDto): Promise<void> {
    await this.prisma.feeCollection.create({
      data: {
        source: dto.source,
        amount: BigInt(dto.amount),
        token: dto.token,
        signature: dto.signature,
        relatedTx: dto.relatedTx,
      },
    });
    this.logger.log(`Fee recorded: ${dto.amount} ${dto.token} from ${dto.source}`);
  }

  /**
   * Get treasury statistics for transparency dashboard
   */
  async getTreasuryStats() {
    // Get latest balance snapshot
    const latestSnapshot = await this.prisma.treasuryBalance.findFirst({
      orderBy: { snapshotAt: 'desc' },
    });

    // Get pending fees
    const pendingFees = await this.prisma.feeCollection.aggregate({
      where: { collected: false },
      _sum: { amount: true },
    });

    // Get last distribution
    const lastDistribution = await this.prisma.treasuryDistribution.findFirst({
      where: { status: 'COMPLETED' },
      orderBy: { executedAt: 'desc' },
    });

    // Calculate next distribution (next Monday 00:00 UTC)
    const now = new Date();
    const nextMonday = new Date(now);
    nextMonday.setUTCDate(now.getUTCDate() + ((8 - now.getUTCDay()) % 7 || 7));
    nextMonday.setUTCHours(0, 0, 0, 0);

    // Get live balances from chain
    const balances = await this.getLiveBalances();

    return {
      mainBalance: balances.main,
      liquidityBalance: balances.liquidity,
      stakingBalance: balances.staking,
      grantsBalance: balances.grants,
      totalRevenue: latestSnapshot ? Number(latestSnapshot.totalRevenue) / 10 ** MVGA_DECIMALS : 0,
      totalDistributed: latestSnapshot
        ? Number(latestSnapshot.totalDistributed) / 10 ** MVGA_DECIMALS
        : 0,
      pendingDistribution: Number(pendingFees._sum.amount || 0) / 10 ** MVGA_DECIMALS,
      nextDistributionAt: nextMonday.toISOString(),
      lastDistributionAt: lastDistribution?.executedAt?.toISOString() || null,
      distributionBreakdown: {
        liquidityPercent: LIQUIDITY_PERCENT,
        stakingPercent: STAKING_PERCENT,
        grantsPercent: GRANTS_PERCENT,
      },
    };
  }

  /**
   * Get distribution history
   */
  async getDistributionHistory(limit = 10) {
    const distributions = await this.prisma.treasuryDistribution.findMany({
      orderBy: { periodEnd: 'desc' },
      take: limit,
    });

    return distributions.map((d) => ({
      id: d.id,
      totalAmount: Number(d.totalAmount) / 10 ** MVGA_DECIMALS,
      burnAmount: Number(d.burnAmount) / 10 ** MVGA_DECIMALS,
      liquidityAmount: Number(d.liquidityAmount) / 10 ** MVGA_DECIMALS,
      stakingAmount: Number(d.stakingAmount) / 10 ** MVGA_DECIMALS,
      grantsAmount: Number(d.grantsAmount) / 10 ** MVGA_DECIMALS,
      status: d.status,
      periodStart: d.periodStart.toISOString(),
      periodEnd: d.periodEnd.toISOString(),
      executedAt: d.executedAt?.toISOString() || null,
      transactions: {
        burn: d.burnTx,
        liquidity: d.liquidityTx,
        staking: d.stakingTx,
        grants: d.grantsTx,
      },
      sources: {
        swapFees: Number(d.swapFees) / 10 ** MVGA_DECIMALS,
        topupFees: Number(d.topupFees) / 10 ** MVGA_DECIMALS,
        giftcardFees: Number(d.giftcardFees) / 10 ** MVGA_DECIMALS,
        yieldEarnings: Number(d.yieldEarnings) / 10 ** MVGA_DECIMALS,
      },
    }));
  }

  /**
   * Get live on-chain balances for all treasury wallets
   */
  private async getLiveBalances() {
    const connection = this.solana.getConnection();
    const getBalance = async (wallet: string) => {
      try {
        const pubkey = new PublicKey(wallet);
        const ata = await getAssociatedTokenAddress(this.mvgaMint, pubkey);
        const account = await getAccount(connection, ata);
        return Number(account.amount) / 10 ** MVGA_DECIMALS;
      } catch {
        return 0;
      }
    };

    const mainWallet = this.treasuryKeypair?.publicKey.toBase58() || '';

    const [main, liquidity, staking, grants] = await Promise.all([
      mainWallet ? getBalance(mainWallet) : 0,
      getBalance(this.liquidityWallet),
      getBalance(this.stakingWallet),
      getBalance(this.grantsWallet),
    ]);

    return { main, liquidity, staking, grants };
  }

  /**
   * Update treasury balance snapshot
   */
  private async updateBalanceSnapshot() {
    const balances = await this.getLiveBalances();

    // Get cumulative totals
    const distributions = await this.prisma.treasuryDistribution.aggregate({
      where: { status: 'COMPLETED' },
      _sum: {
        totalAmount: true,
        liquidityAmount: true,
        stakingAmount: true,
        grantsAmount: true,
      },
    });

    const fees = await this.prisma.feeCollection.aggregate({
      where: { collected: true },
      _sum: { amount: true },
    });

    await this.prisma.treasuryBalance.create({
      data: {
        mainWallet: BigInt(Math.round(balances.main * 10 ** MVGA_DECIMALS)),
        liquidityWallet: BigInt(Math.round(balances.liquidity * 10 ** MVGA_DECIMALS)),
        stakingWallet: BigInt(Math.round(balances.staking * 10 ** MVGA_DECIMALS)),
        grantsWallet: BigInt(Math.round(balances.grants * 10 ** MVGA_DECIMALS)),
        totalRevenue: fees._sum.amount || BigInt(0),
        totalDistributed: distributions._sum.totalAmount || BigInt(0),
        totalToLiquidity: distributions._sum.liquidityAmount || BigInt(0),
        totalToStaking: distributions._sum.stakingAmount || BigInt(0),
        totalToGrants: distributions._sum.grantsAmount || BigInt(0),
      },
    });
  }

  /**
   * Trigger manual distribution (admin only)
   */
  async triggerManualDistribution() {
    // Check for an existing in-progress distribution
    const existing = await this.prisma.treasuryDistribution.findFirst({
      where: { status: 'IN_PROGRESS' },
    });
    if (existing) {
      this.logger.log('Resuming existing in-progress distribution');
    } else {
      this.logger.log('Manual distribution triggered');
    }
    await this.executeWeeklyDistribution();
    return { success: true, message: 'Distribution triggered' };
  }
}
