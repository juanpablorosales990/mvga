import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma.service';
import { SolanaService } from '../wallet/solana.service';
import { Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  getAccount,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
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
const USDC_DECIMALS = 6;

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
  @Cron(CronExpression.EVERY_WEEK)
  async executeWeeklyDistribution() {
    this.logger.log('Starting weekly treasury distribution...');

    if (!this.treasuryKeypair) {
      this.logger.warn('Treasury keypair not configured, skipping distribution');
      return;
    }

    try {
      // Calculate period
      const periodEnd = new Date();
      const periodStart = new Date(periodEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Get uncollected fees
      const uncollectedFees = await this.prisma.feeCollection.findMany({
        where: { collected: false },
      });

      if (uncollectedFees.length === 0) {
        this.logger.log('No fees to distribute this period');
        return;
      }

      // Calculate totals by source
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
        return;
      }

      // Burn 5% before distribution
      const burnAmount = (totalAmount * BigInt(BURN_PERCENT)) / BigInt(100);
      const distributable = totalAmount - burnAmount;

      // Calculate distribution amounts from the remaining 95%
      const liquidityAmount = (distributable * BigInt(LIQUIDITY_PERCENT)) / BigInt(100);
      const stakingAmount = (distributable * BigInt(STAKING_PERCENT)) / BigInt(100);
      const grantsAmount = (distributable * BigInt(GRANTS_PERCENT)) / BigInt(100);

      // Create distribution record
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
        },
      });

      // Execute burn + transfers
      let burnTx: string | null = null;
      let liquidityTx: string | null = null;
      let stakingTx: string | null = null;
      let grantsTx: string | null = null;

      try {
        // Burn 5% of fees
        if (burnAmount > BigInt(0)) {
          try {
            burnTx = await this.burnService.executeBurn(burnAmount, 'WEEKLY');
            this.logger.log(
              `Burn: ${Number(burnAmount) / 10 ** MVGA_DECIMALS} MVGA — tx: ${burnTx}`
            );
          } catch (burnError) {
            this.logger.error('Weekly burn failed, continuing with distribution:', burnError);
          }
        }

        // Transfer to liquidity wallet
        if (liquidityAmount > BigInt(0)) {
          liquidityTx = await this.transferMVGA(this.liquidityWallet, liquidityAmount);
          this.logger.log(`Liquidity transfer: ${liquidityTx}`);
        }

        // Split staking amount: 50% to vault refill, 50% to fee sharing pool
        const feeShareAmount = (stakingAmount * BigInt(FEE_SHARE_PERCENT)) / BigInt(100);
        const vaultRefillAmount = stakingAmount - feeShareAmount;

        // Transfer vault refill to staking vault
        if (vaultRefillAmount > BigInt(0)) {
          stakingTx = await this.transferMVGA(this.stakingWallet, vaultRefillAmount);
          this.logger.log(`Staking vault refill: ${stakingTx}`);
        }

        // Transfer to grants treasury
        if (grantsAmount > BigInt(0)) {
          grantsTx = await this.transferMVGA(this.grantsWallet, grantsAmount);
          this.logger.log(`Grants transfer: ${grantsTx}`);
        }

        // Create FeeSnapshot for pro-rata staker fee sharing
        if (feeShareAmount > BigInt(0)) {
          try {
            const totalWeight = await this.stakingService.getTotalStakeWeight();
            if (totalWeight > BigInt(0)) {
              const feePerWeight = Number(feeShareAmount) / Number(totalWeight);
              await this.prisma.feeSnapshot.create({
                data: {
                  totalFees: feeShareAmount,
                  totalWeight,
                  feePerWeight,
                  periodEnd: periodEnd,
                },
              });
              this.logger.log(
                `Fee snapshot created: ${Number(feeShareAmount) / 10 ** MVGA_DECIMALS} MVGA shared across ${totalWeight} weight`
              );
            } else {
              this.logger.log('No active stakes — fee share amount stays in treasury');
            }
          } catch (feeError) {
            this.logger.error('Fee snapshot creation failed:', feeError);
          }
        }

        // Mark fees as collected
        await this.prisma.feeCollection.updateMany({
          where: { id: { in: uncollectedFees.map((f) => f.id) } },
          data: { collected: true, collectedAt: new Date() },
        });

        // Update distribution record
        await this.prisma.treasuryDistribution.update({
          where: { id: distribution.id },
          data: {
            burnTx,
            liquidityTx,
            stakingTx,
            grantsTx,
            status: 'COMPLETED',
            executedAt: new Date(),
          },
        });

        // Update treasury balance snapshot
        await this.updateBalanceSnapshot();

        this.logger.log(
          `Weekly distribution completed! Total: ${Number(totalAmount) / 10 ** MVGA_DECIMALS} MVGA`
        );
      } catch (txError) {
        this.logger.error('Distribution transfer failed:', txError);
        await this.prisma.treasuryDistribution.update({
          where: { id: distribution.id },
          data: { status: 'FAILED' },
        });
      }
    } catch (error) {
      this.logger.error('Weekly distribution failed:', error);
    }
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
    this.logger.log('Manual distribution triggered');
    await this.executeWeeklyDistribution();
    return { success: true, message: 'Distribution triggered' };
  }
}
