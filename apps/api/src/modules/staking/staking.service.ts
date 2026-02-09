import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { TransactionLoggerService } from '../../common/transaction-logger.service';
import { CronLockService } from '../../common/cron-lock.service';
import { SolanaService } from '../wallet/solana.service';
import { StakeDto, UnstakeDto } from './staking.dto';
import { Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  getAccount,
} from '@solana/spl-token';

export interface StakingTier {
  name: string;
  minStake: number;
  multiplier: number;
  benefits: string[];
}

const BASE_APY = 12; // 12% base APY
const MVGA_DECIMALS = 9;
const TOTAL_SUPPLY = 1_000_000_000; // 1B MVGA total supply
const AUTO_COMPOUND_MIN = 100; // Minimum 100 MVGA to auto-compound
const REFERRAL_BONUS_RATE = 0.05; // 5% of claimed rewards go to referrer
// Raw query result type for SELECT ... FOR UPDATE queries
interface RawStakeRow {
  id: string;
  userId: string;
  amount: bigint;
  lockPeriod: number;
  lockedUntil: Date | null;
  createdAt: Date;
  lastClaimedAt: Date | null;
  status: string;
  autoCompound: boolean;
  stakeTx: string | null;
  unstakeTx: string | null;
  unstakedAt: Date | null;
}

// Dynamic APY multipliers based on staking participation rate
const DYNAMIC_APY_TIERS: { maxRate: number; multiplier: number }[] = [
  { maxRate: 0.1, multiplier: 1.3 }, // <10% staked → 1.3x
  { maxRate: 0.3, multiplier: 1.0 }, // 10-30% → 1.0x (base)
  { maxRate: 0.5, multiplier: 0.85 }, // 30-50% → 0.85x
  { maxRate: Infinity, multiplier: 0.7 }, // >50% → 0.7x
];

@Injectable()
export class StakingService {
  private readonly logger = new Logger(StakingService.name);
  private vaultKeypair: Keypair | null = null;
  private mintPubkey: PublicKey;

  private readonly tiers: StakingTier[] = [
    {
      name: 'Bronze',
      minStake: 0,
      multiplier: 1.0,
      benefits: ['Basic wallet access', 'Community access'],
    },
    {
      name: 'Silver',
      minStake: 10000,
      multiplier: 1.2,
      benefits: ['0.5% cashback on swaps', 'Priority support'],
    },
    {
      name: 'Gold',
      minStake: 50000,
      multiplier: 1.5,
      benefits: ['1% cashback on swaps', 'Governance voting', 'Early feature access'],
    },
    {
      name: 'Diamond',
      minStake: 200000,
      multiplier: 2.0,
      benefits: ['2% cashback', 'Zero fees', 'VIP support', 'Exclusive events'],
    },
  ];

  private readonly lockPeriodMultipliers: Record<number, number> = {
    0: 1.0,
    30: 1.25,
    90: 1.5,
    180: 2.0,
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly txLogger: TransactionLoggerService,
    private readonly cronLockService: CronLockService,
    private readonly solana: SolanaService,
    private readonly config: ConfigService,
    private readonly eventEmitter: EventEmitter2
  ) {
    this.mintPubkey = new PublicKey(
      this.config.get('MVGA_TOKEN_MINT', 'DRX65kM2n5CLTpdjJCemZvkUwE98ou4RpHrd8Z3GH5Qh')
    );

    // Load vault keypair from env (base64-encoded JSON array)
    const vaultKeypairStr = this.config.get<string>('STAKING_VAULT_KEYPAIR');
    if (vaultKeypairStr) {
      try {
        const decoded = Buffer.from(vaultKeypairStr, 'base64');
        this.vaultKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(decoded.toString())));
        this.logger.log('Staking vault keypair loaded');
      } catch (e) {
        throw new Error(`STAKING_VAULT_KEYPAIR is set but invalid: ${(e as Error).message}`);
      }
    } else {
      this.logger.warn('STAKING_VAULT_KEYPAIR not set — unstake/claim will be unavailable');
    }
  }

  async getStakingInfo() {
    const [aggregation, stakerCount, latestFeeSnapshot, totalBurnedAgg] = await Promise.all([
      this.prisma.stake.aggregate({
        where: { status: 'ACTIVE' },
        _sum: { amount: true },
      }),
      this.prisma.stake.groupBy({
        by: ['userId'],
        where: { status: 'ACTIVE' },
      }),
      this.prisma.feeSnapshot.findFirst({
        orderBy: { periodEnd: 'desc' },
      }),
      this.prisma.tokenBurn.aggregate({
        _sum: { amount: true },
      }),
    ]);

    const totalStakedRaw = aggregation._sum.amount ?? BigInt(0);
    const totalStaked = Number(totalStakedRaw) / 10 ** MVGA_DECIMALS;
    const totalBurned = Number(totalBurnedAgg._sum.amount ?? BigInt(0)) / 10 ** MVGA_DECIMALS;
    const circulatingSupply = TOTAL_SUPPLY - totalBurned;

    // Dynamic APY based on staking rate
    const stakingRate = circulatingSupply > 0 ? totalStaked / circulatingSupply : 0;
    const { dynamicApy, apyMultiplier } = this.calculateDynamicApy(stakingRate);

    // Get vault on-chain balance
    let rewardPool = 0;
    const vaultWallet = this.config.get(
      'STAKING_VAULT_WALLET',
      'GNhLCjqThNJAJAdDYvRTr2EfWyGXAFUymaPuKaL1duEh'
    );
    try {
      const vaultAta = await getAssociatedTokenAddress(this.mintPubkey, new PublicKey(vaultWallet));
      const account = await getAccount(this.solana.getConnection(), vaultAta);
      const vaultBalance = Number(account.amount) / 10 ** MVGA_DECIMALS;
      rewardPool = Math.max(0, vaultBalance - totalStaked);
    } catch {
      // Vault ATA may not exist yet
    }

    // Weekly fee pool for stakers
    const weeklyFeePool = latestFeeSnapshot
      ? Number(latestFeeSnapshot.totalFees) / 10 ** MVGA_DECIMALS
      : 0;

    return {
      totalStaked,
      totalStakers: stakerCount.length,
      rewardPool,
      baseApy: BASE_APY,
      dynamicApy,
      apyMultiplier,
      stakingRate,
      weeklyFeePool,
    };
  }

  getTiers(): StakingTier[] {
    return this.tiers;
  }

  async getStakingPosition(walletAddress: string) {
    const user = await this.prisma.user.findUnique({
      where: { walletAddress },
    });

    if (!user) {
      return {
        stakes: [],
        totalStaked: 0,
        earnedRewards: 0,
        feeRewards: 0,
        currentTier: 'Bronze',
        apy: BASE_APY,
        effectiveApy: BASE_APY,
      };
    }

    const stakes = await this.prisma.stake.findMany({
      where: { userId: user.id, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });

    const totalStaked = stakes.reduce((sum, s) => sum + Number(s.amount) / 10 ** MVGA_DECIMALS, 0);

    // Get dynamic APY
    const info = await this.getStakingInfo();
    const dynamicBase = info.dynamicApy;

    // Calculate earned rewards for each stake using dynamic APY
    let totalRewards = 0;
    const formattedStakes = stakes.map((stake) => {
      const amount = Number(stake.amount) / 10 ** MVGA_DECIMALS;
      const tier = this.getTierForAmount(totalStaked);
      const lockMult = this.lockPeriodMultipliers[stake.lockPeriod] || 1.0;
      const effectiveApy = dynamicBase * tier.multiplier * lockMult;

      // Days since last claimed (or since staked if never claimed)
      const since = stake.lastClaimedAt || stake.createdAt;
      const daysSinceStake = (Date.now() - since.getTime()) / (1000 * 60 * 60 * 24);
      const rewards = amount * (effectiveApy / 100) * (daysSinceStake / 365);
      totalRewards += rewards;

      return {
        id: stake.id,
        amount,
        lockPeriod: stake.lockPeriod,
        lockedUntil: stake.lockedUntil,
        createdAt: stake.createdAt,
        apy: effectiveApy,
        rewards,
        status: stake.status,
        autoCompound: stake.autoCompound,
      };
    });

    // Calculate fee rewards (only unclaimed — since last claim)
    const lastClaim = await this.prisma.stakingClaim.findFirst({
      where: { userId: user.id },
      orderBy: { claimedAt: 'desc' },
    });
    const feeRewards = await this.calculateFeeRewards(stakes, lastClaim?.claimedAt);

    const tier = this.getTierForAmount(totalStaked);
    const baseApy = dynamicBase * tier.multiplier;

    // Effective APY = base APY + annualized fee rewards
    let effectiveApy = baseApy;
    if (totalStaked > 0 && feeRewards > 0) {
      const annualizedFeeYield = (feeRewards / totalStaked) * 52 * 100; // weekly → annual %
      effectiveApy = baseApy + annualizedFeeYield;
    }

    return {
      stakes: formattedStakes,
      totalStaked,
      earnedRewards: totalRewards,
      feeRewards,
      currentTier: tier.name,
      apy: baseApy,
      effectiveApy,
    };
  }

  async createStakeTransaction(dto: StakeDto) {
    const vaultWallet = this.config.get(
      'STAKING_VAULT_WALLET',
      'GNhLCjqThNJAJAdDYvRTr2EfWyGXAFUymaPuKaL1duEh'
    );

    const tier = this.getTierForAmount(dto.amount);
    const multiplier = this.lockPeriodMultipliers[dto.lockPeriod] || 1.0;
    const effectiveApy = BASE_APY * tier.multiplier * multiplier;

    return {
      vaultAddress: vaultWallet,
      mintAddress: this.mintPubkey.toBase58(),
      amount: dto.amount,
      lockPeriod: dto.lockPeriod,
      tier: tier.name,
      estimatedApy: effectiveApy,
    };
  }

  async confirmStake(walletAddress: string, signature: string, amount: number, lockPeriod: number) {
    // Verify the transaction on-chain
    const connection = this.solana.getConnection();
    const tx = await connection.getParsedTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) {
      throw new BadRequestException('Transaction not found. It may not be confirmed yet.');
    }

    if (tx.meta?.err) {
      throw new BadRequestException('Transaction failed on-chain');
    }

    // Verify the transaction signer matches the authenticated wallet
    const signers = tx.transaction.message.accountKeys
      .filter((k) => k.signer)
      .map((k) => k.pubkey.toBase58());
    if (!signers.includes(walletAddress)) {
      throw new BadRequestException('Transaction signer does not match authenticated wallet');
    }

    // Verify the SPL transfer: correct recipient (vault), amount, and token mint
    const expectedRaw = Math.round(amount * 10 ** MVGA_DECIMALS);
    const vaultAta = this.vaultKeypair
      ? await getAssociatedTokenAddress(this.mintPubkey, this.vaultKeypair.publicKey)
      : null;

    const innerInstructions = tx.meta?.innerInstructions ?? [];
    const allInstructions = [
      ...tx.transaction.message.instructions,
      ...innerInstructions.flatMap((ix: { instructions: unknown[] }) => ix.instructions),
    ];

    let transferVerified = false;
    for (const ix of allInstructions) {
      const parsed = (ix as Record<string, unknown>).parsed as Record<string, unknown> | undefined;
      if (!parsed) continue;
      if ((parsed.type === 'transfer' || parsed.type === 'transferChecked') && parsed.info) {
        const info = parsed.info as Record<string, unknown>;
        const tokenAmount = info.tokenAmount as Record<string, unknown> | undefined;
        const transferAmount = Number(info.amount || tokenAmount?.amount || 0);
        const dest = String(info.destination || '');
        const mint = String(info.mint || tokenAmount?.mint || '');

        // Verify amount matches (1% tolerance for rounding)
        const amountMatch =
          expectedRaw > 0 && Math.abs(transferAmount - expectedRaw) / expectedRaw < 0.01;
        // Verify destination is the vault ATA (if known)
        const destMatch = !vaultAta || dest === vaultAta.toBase58();
        // Verify mint is MVGA (if present in parsed data)
        const mintMatch = !mint || mint === this.mintPubkey.toBase58();

        if (amountMatch && destMatch && mintMatch) {
          transferVerified = true;
          break;
        }
      }
    }

    if (!transferVerified) {
      throw new BadRequestException(
        'Transaction does not contain a valid transfer to the staking vault with the expected amount'
      );
    }

    // Check for signature replay — reject if already used
    const existingStake = await this.prisma.stake.findFirst({
      where: { stakeTx: signature },
    });
    if (existingStake) {
      throw new BadRequestException('Transaction signature already used');
    }

    // Upsert user + create stake record
    const user = await this.prisma.user.upsert({
      where: { walletAddress },
      update: {},
      create: { walletAddress },
    });

    const amountRaw = BigInt(Math.round(amount * 10 ** MVGA_DECIMALS));
    const lockedUntil =
      lockPeriod > 0 ? new Date(Date.now() + lockPeriod * 24 * 60 * 60 * 1000) : null;

    const stake = await this.prisma.stake.create({
      data: {
        userId: user.id,
        amount: amountRaw,
        lockPeriod,
        lockedUntil,
        stakeTx: signature,
        status: 'ACTIVE',
      },
    });

    // Log the transaction
    await this.txLogger.log({
      walletAddress,
      type: 'STAKE',
      signature,
      amount,
      token: 'MVGA',
    });
    await this.txLogger.confirm(signature);

    return {
      stakeId: stake.id,
      amount,
      lockPeriod,
      lockedUntil,
      signature,
    };
  }

  async createUnstakeTransaction(dto: UnstakeDto) {
    return this.prisma.$transaction(
      async (tx) => {
        const user = await tx.user.findUnique({
          where: { walletAddress: dto.address },
        });
        if (!user) throw new NotFoundException('No staking position found');

        // Lock the stake row to prevent concurrent unstake
        const [stake] = await tx.$queryRaw<RawStakeRow[]>`
        SELECT * FROM "Stake"
        WHERE "userId" = ${user.id} AND "status" = 'ACTIVE'
        ORDER BY "createdAt" ASC
        LIMIT 1
        FOR UPDATE
      `;

        if (!stake) {
          throw new BadRequestException('No active stake found');
        }

        // Check lock period
        if (stake.lockedUntil && new Date() < new Date(stake.lockedUntil)) {
          throw new BadRequestException(
            `Stake locked until ${new Date(stake.lockedUntil).toISOString()}`
          );
        }

        if (!this.vaultKeypair) {
          throw new BadRequestException('Staking vault not configured. Contact support.');
        }

        const amountToUnstake = Number(stake.amount) / 10 ** MVGA_DECIMALS;
        const requestedAmount = Math.min(dto.amount, amountToUnstake);
        const rawAmount = BigInt(Math.round(requestedAmount * 10 ** MVGA_DECIMALS));

        // Build transfer: vault → user
        const connection = this.solana.getConnection();
        const userPubkey = new PublicKey(dto.address);
        const vaultAta = await getAssociatedTokenAddress(
          this.mintPubkey,
          this.vaultKeypair.publicKey
        );
        const userAta = await getAssociatedTokenAddress(this.mintPubkey, userPubkey);

        const solanaTx = new Transaction().add(
          createTransferInstruction(vaultAta, userAta, this.vaultKeypair.publicKey, rawAmount)
        );

        const sig = await sendAndConfirmTransaction(connection, solanaTx, [this.vaultKeypair]);

        // Update stake in database — handle partial vs full unstake
        const stakeAmount = Number(stake.amount) / 10 ** MVGA_DECIMALS;
        if (requestedAmount >= stakeAmount) {
          // Full unstake — mark entire position as UNSTAKED
          await tx.stake.update({
            where: { id: stake.id },
            data: {
              status: 'UNSTAKED',
              unstakeTx: sig,
              unstakedAt: new Date(),
            },
          });
        } else {
          // Partial unstake — reduce the existing position's amount
          const remainingRaw = BigInt(
            Math.round((stakeAmount - requestedAmount) * 10 ** MVGA_DECIMALS)
          );
          await tx.stake.update({
            where: { id: stake.id },
            data: { amount: remainingRaw },
          });
        }

        // Log the transaction (non-blocking)
        this.txLogger
          .log({
            walletAddress: dto.address,
            type: 'UNSTAKE',
            signature: sig,
            amount: requestedAmount,
            token: 'MVGA',
          })
          .then(() => this.txLogger.confirm(sig))
          .catch((e) => this.logger.error('Failed to log unstake:', e));

        this.eventEmitter.emit('staking.unstake.complete', {
          walletAddress: dto.address,
          amount: requestedAmount,
        });

        return {
          signature: sig,
          amount: requestedAmount,
          stakeId: stake.id,
        };
      },
      { maxWait: 10000, timeout: 60000 }
    );
  }

  async createClaimTransaction(walletAddress: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const user = await tx.user.findUnique({ where: { walletAddress } });
        if (!user) throw new NotFoundException('No staking position found');

        // Lock user's active stakes to prevent concurrent claims
        const stakes = await tx.$queryRaw<RawStakeRow[]>`
        SELECT * FROM "Stake"
        WHERE "userId" = ${user.id} AND "status" = 'ACTIVE'
        FOR UPDATE
      `;

        if (stakes.length === 0) {
          throw new BadRequestException('No active stakes found');
        }

        // Check cooldown: 24 hour minimum between claims
        const lastClaim = await tx.stakingClaim.findFirst({
          where: { userId: user.id },
          orderBy: { claimedAt: 'desc' },
        });

        if (lastClaim && Date.now() - lastClaim.claimedAt.getTime() < 86_400_000) {
          throw new BadRequestException('Please wait at least 24 hours between claims');
        }

        // Calculate rewards from lastClaimedAt (not createdAt) to prevent re-claiming
        const info = await this.getStakingInfo();
        const dynamicBase = info.dynamicApy;

        const totalStaked = stakes.reduce(
          (sum: number, s: RawStakeRow) => sum + Number(s.amount) / 10 ** MVGA_DECIMALS,
          0
        );

        let baseRewards = 0;
        for (const stake of stakes) {
          const amount = Number(stake.amount) / 10 ** MVGA_DECIMALS;
          const tier = this.getTierForAmount(totalStaked);
          const lockMult = this.lockPeriodMultipliers[stake.lockPeriod] || 1.0;
          const effectiveApy = dynamicBase * tier.multiplier * lockMult;

          // Calculate from lastClaimedAt if available, otherwise createdAt
          const since = stake.lastClaimedAt
            ? new Date(stake.lastClaimedAt)
            : new Date(stake.createdAt);
          const daysSinceLast = (Date.now() - since.getTime()) / (1000 * 60 * 60 * 24);
          baseRewards += amount * (effectiveApy / 100) * (daysSinceLast / 365);
        }

        // Calculate unclaimed fee rewards (only snapshots since last claim)
        const feeRewards = await this.calculateFeeRewards(
          stakes.map((s: RawStakeRow) => ({
            amount: s.amount,
            lockPeriod: s.lockPeriod,
            createdAt: new Date(s.createdAt),
          })),
          lastClaim?.claimedAt
        );

        const totalRewards = baseRewards + feeRewards;

        if (totalRewards < 10) {
          throw new BadRequestException('Minimum claim amount is 10 MVGA');
        }

        if (!this.vaultKeypair) {
          throw new BadRequestException('Staking vault not configured. Contact support.');
        }

        const rawRewards = BigInt(Math.round(totalRewards * 10 ** MVGA_DECIMALS));

        // Build transfer: vault → user (rewards)
        const connection = this.solana.getConnection();
        const userPubkey = new PublicKey(walletAddress);
        const vaultAta = await getAssociatedTokenAddress(
          this.mintPubkey,
          this.vaultKeypair.publicKey
        );

        // Pre-check vault balance to avoid failed transactions
        try {
          const vaultAccount = await getAccount(connection, vaultAta);
          if (BigInt(vaultAccount.amount.toString()) < rawRewards) {
            throw new BadRequestException('Reward pool temporarily depleted. Try again later.');
          }
        } catch (e) {
          if (e instanceof BadRequestException) throw e;
          throw new BadRequestException('Could not verify reward pool balance');
        }

        const userAta = await getAssociatedTokenAddress(this.mintPubkey, userPubkey);

        const solanaTx = new Transaction().add(
          createTransferInstruction(vaultAta, userAta, this.vaultKeypair.publicKey, rawRewards)
        );

        const sig = await sendAndConfirmTransaction(connection, solanaTx, [this.vaultKeypair]);

        // Record the claim for idempotency and audit (feeRewards prevents double-claiming)
        const rawFeeRewards = BigInt(Math.round(feeRewards * 10 ** MVGA_DECIMALS));
        await tx.stakingClaim.create({
          data: {
            userId: user.id,
            amount: rawRewards,
            feeRewards: rawFeeRewards,
            signature: sig,
          },
        });

        // Update lastClaimedAt on all stakes
        for (const stake of stakes) {
          await tx.stake.update({
            where: { id: stake.id },
            data: { lastClaimedAt: new Date() },
          });
        }

        // Pay referral bonus (non-blocking, outside transaction)
        this.payReferralBonus(walletAddress, totalRewards);

        this.eventEmitter.emit('staking.rewards.ready', {
          walletAddress,
          amount: totalRewards,
        });

        return {
          signature: sig,
          rewards: totalRewards,
        };
      },
      { maxWait: 10000, timeout: 60000 }
    );
  }

  /**
   * Calculate the dynamic APY multiplier based on staking participation rate
   */
  calculateDynamicApy(stakingRate: number): { dynamicApy: number; apyMultiplier: number } {
    let apyMultiplier = 1.0;
    for (const tier of DYNAMIC_APY_TIERS) {
      if (stakingRate < tier.maxRate) {
        apyMultiplier = tier.multiplier;
        break;
      }
    }
    return {
      dynamicApy: BASE_APY * apyMultiplier,
      apyMultiplier,
    };
  }

  /**
   * Calculate a user's weight for fee sharing: sum of (amount × tierMult × lockMult)
   */
  calculateStakeWeight(
    stakes: { amount: bigint; lockPeriod: number }[],
    totalStakedDecimal: number
  ): bigint {
    const tier = this.getTierForAmount(totalStakedDecimal);
    let totalWeight = BigInt(0);

    for (const stake of stakes) {
      const lockMult = this.lockPeriodMultipliers[stake.lockPeriod] || 1.0;
      // Weight = amount × tierMultiplier × lockMultiplier (scaled by 1000 for precision)
      const weight =
        (stake.amount * BigInt(Math.round(tier.multiplier * lockMult * 1000))) / BigInt(1000);
      totalWeight += weight;
    }

    return totalWeight;
  }

  /**
   * Get total weight of all active stakes in the protocol
   */
  async getTotalStakeWeight(): Promise<bigint> {
    const stakes = await this.prisma.stake.findMany({
      where: { status: 'ACTIVE' },
      include: { user: true },
    });

    // Group stakes by user
    const userStakes = new Map<string, { amount: bigint; lockPeriod: number }[]>();
    const userTotals = new Map<string, number>();

    for (const stake of stakes) {
      const userId = stake.userId;
      if (!userStakes.has(userId)) {
        userStakes.set(userId, []);
        userTotals.set(userId, 0);
      }
      userStakes.get(userId)!.push({ amount: stake.amount, lockPeriod: stake.lockPeriod });
      userTotals.set(
        userId,
        (userTotals.get(userId) || 0) + Number(stake.amount) / 10 ** MVGA_DECIMALS
      );
    }

    let totalWeight = BigInt(0);
    for (const [userId, stakeList] of userStakes) {
      const totalDecimal = userTotals.get(userId) || 0;
      totalWeight += this.calculateStakeWeight(stakeList, totalDecimal);
    }

    return totalWeight;
  }

  /**
   * Calculate a user's unclaimed fee rewards from FeeSnapshots.
   * Only counts snapshots after the user's last claim to prevent double-claiming.
   */
  private async calculateFeeRewards(
    stakes: { amount: bigint; lockPeriod: number; createdAt: Date }[],
    lastClaimDate?: Date | null
  ): Promise<number> {
    if (stakes.length === 0) return 0;

    // Only get snapshots AFTER the last claim — prevents double-claiming
    const snapshotWhere: Prisma.FeeSnapshotWhereInput = lastClaimDate
      ? { periodEnd: { gt: lastClaimDate } }
      : {};

    const snapshots = await this.prisma.feeSnapshot.findMany({
      where: snapshotWhere,
      orderBy: { periodEnd: 'desc' },
      take: 52,
    });

    if (snapshots.length === 0) return 0;

    const totalStakedDecimal = stakes.reduce(
      (sum, s) => sum + Number(s.amount) / 10 ** MVGA_DECIMALS,
      0
    );

    const userWeight = this.calculateStakeWeight(
      stakes.map((s) => ({ amount: s.amount, lockPeriod: s.lockPeriod })),
      totalStakedDecimal
    );

    if (userWeight === BigInt(0)) return 0;

    // Sum up fee rewards from each snapshot where user had active stakes
    let totalFeeRewards = 0;
    for (const snapshot of snapshots) {
      // Only count snapshots where at least one stake existed
      const activeStakes = stakes.filter((s) => s.createdAt <= snapshot.periodEnd);
      if (activeStakes.length === 0) continue;

      if (snapshot.totalWeight > BigInt(0)) {
        // Use BigInt multiplication before division to preserve precision
        // at scale (avoids Number overflow when weights exceed 2^53)
        const PRECISION = BigInt(10 ** 18);
        const scaledShare = (userWeight * PRECISION) / snapshot.totalWeight;
        const feeRewardRaw = (scaledShare * snapshot.totalFees) / PRECISION;
        totalFeeRewards += Number(feeRewardRaw) / 10 ** MVGA_DECIMALS;
      }
    }

    return totalFeeRewards;
  }

  /**
   * Toggle auto-compound for a specific stake
   */
  async toggleAutoCompound(walletAddress: string, stakeId: string, enabled: boolean) {
    const user = await this.prisma.user.findUnique({ where: { walletAddress } });
    if (!user) throw new NotFoundException('User not found');

    // Atomic check-and-update to prevent TOCTOU race
    const { count } = await this.prisma.stake.updateMany({
      where: { id: stakeId, userId: user.id, status: 'ACTIVE' },
      data: { autoCompound: enabled },
    });
    if (count === 0) throw new NotFoundException('Stake not found');

    return { stakeId, autoCompound: enabled };
  }

  /**
   * Auto-compound cron: every 6 hours, re-stake rewards for opted-in stakes >= 100 MVGA
   */
  @Cron('0 */6 * * *')
  async executeAutoCompound() {
    const lockId = await this.cronLockService.acquireLock('auto-compound', 600_000);
    if (!lockId) {
      this.logger.debug('Auto-compound: another instance holds the lock, skipping');
      return;
    }

    try {
      this.logger.log('Running auto-compound...');

      // Process in batches to avoid unbounded memory usage at scale
      const BATCH_SIZE = 100;
      let cursor: string | undefined;
      let compoundCount = 0;
      const info = await this.getStakingInfo();
      const dynamicBase = info.dynamicApy;

      while (true) {
        const autoCompoundStakes = await this.prisma.stake.findMany({
          where: { status: 'ACTIVE', autoCompound: true },
          include: { user: true },
          take: BATCH_SIZE,
          ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
          orderBy: { id: 'asc' },
        });

        if (autoCompoundStakes.length === 0) break;
        cursor = autoCompoundStakes[autoCompoundStakes.length - 1].id;

        // Group by user
        const userStakesMap = new Map<string, typeof autoCompoundStakes>();
        for (const stake of autoCompoundStakes) {
          const key = stake.userId;
          if (!userStakesMap.has(key)) userStakesMap.set(key, []);
          userStakesMap.get(key)!.push(stake);
        }

        for (const [_userId, stakes] of userStakesMap) {
          const walletAddress = stakes[0].user.walletAddress;

          const totalStaked = stakes.reduce(
            (sum, s) => sum + Number(s.amount) / 10 ** MVGA_DECIMALS,
            0
          );

          // Calculate rewards from lastClaimedAt (or createdAt) for each stake
          let totalRewards = 0;

          for (const stake of stakes) {
            const amount = Number(stake.amount) / 10 ** MVGA_DECIMALS;
            const tier = this.getTierForAmount(totalStaked);
            const lockMult = this.lockPeriodMultipliers[stake.lockPeriod] || 1.0;
            const effectiveApy = dynamicBase * tier.multiplier * lockMult;

            const since = stake.lastClaimedAt || stake.createdAt;
            const daysSince = (Date.now() - since.getTime()) / (1000 * 60 * 60 * 24);
            const rewards = amount * (effectiveApy / 100) * (daysSince / 365);

            totalRewards += rewards;
          }

          if (totalRewards < AUTO_COMPOUND_MIN) continue;

          // Calculate fee rewards to compound alongside APY rewards
          const lastClaimForFees = await this.prisma.stakingClaim.findFirst({
            where: { userId: stakes[0].userId },
            orderBy: { claimedAt: 'desc' },
          });
          const compoundFeeRewards = await this.calculateFeeRewards(
            stakes.map((s) => ({
              amount: s.amount,
              lockPeriod: s.lockPeriod,
              createdAt: s.createdAt,
            })),
            lastClaimForFees?.claimedAt
          );
          const totalCompound = totalRewards + compoundFeeRewards;

          // Verify vault has sufficient reward surplus before compounding
          if (!this.vaultKeypair) continue;
          const rewardRaw = BigInt(Math.round(totalCompound * 10 ** MVGA_DECIMALS));
          const rawFeeRewards = BigInt(Math.round(compoundFeeRewards * 10 ** MVGA_DECIMALS));

          try {
            const connection = this.solana.getConnection();
            const vaultAta = await getAssociatedTokenAddress(
              this.mintPubkey,
              this.vaultKeypair.publicKey
            );
            const vaultAccount = await getAccount(connection, vaultAta);
            if (BigInt(vaultAccount.amount.toString()) < rewardRaw) {
              this.logger.warn(
                `Auto-compound skipped for ${walletAddress.slice(0, 8)}...: vault balance insufficient`
              );
              continue;
            }
          } catch {
            this.logger.warn('Auto-compound: could not verify vault balance, skipping');
            continue;
          }

          const primaryStake = stakes[0];

          await this.prisma.$transaction(async (tx) => {
            // Lock the stake rows to prevent race with manual claim
            await tx.$queryRaw`
              SELECT id FROM "Stake"
              WHERE id IN (${Prisma.join(stakes.map((s) => s.id))})
              FOR UPDATE
            `;

            await tx.stake.update({
              where: { id: primaryStake.id },
              data: {
                amount: { increment: rewardRaw },
                lastClaimedAt: new Date(),
              },
            });

            for (const stake of stakes.slice(1)) {
              await tx.stake.update({
                where: { id: stake.id },
                data: { lastClaimedAt: new Date() },
              });
            }

            // Create StakingClaim record to prevent double-claim with manual claims
            await tx.stakingClaim.create({
              data: {
                userId: stakes[0].userId,
                amount: rewardRaw,
                feeRewards: rawFeeRewards,
                signature: `auto-compound-${Date.now()}-${stakes[0].userId.slice(0, 8)}`,
              },
            });
          });

          compoundCount++;
          this.logger.log(
            `Auto-compounded ${totalCompound.toFixed(2)} MVGA (${totalRewards.toFixed(2)} APY + ${compoundFeeRewards.toFixed(2)} fees) for ${walletAddress.slice(0, 8)}...`
          );
        }

        if (autoCompoundStakes.length < BATCH_SIZE) break;
      }

      this.logger.log(`Auto-compound complete: ${compoundCount} users compounded`);
    } catch (error) {
      this.logger.error('Auto-compound failed:', error);
      Sentry.captureException(error, { tags: { job: 'auto-compound' } });
    } finally {
      await this.cronLockService.releaseLock(lockId);
    }
  }

  /**
   * Pay referral bonus: 5% of claimed rewards go to the referrer
   */
  private async payReferralBonus(walletAddress: string, claimedAmount: number) {
    try {
      // Find if user was referred by someone
      const referral = await this.prisma.referral.findUnique({
        where: { refereeAddress: walletAddress },
      });

      if (!referral || !this.vaultKeypair) return;

      const bonusAmount = claimedAmount * REFERRAL_BONUS_RATE;
      if (bonusAmount < 1) return; // Skip if bonus < 1 MVGA

      const rawBonus = BigInt(Math.round(bonusAmount * 10 ** MVGA_DECIMALS));
      const connection = this.solana.getConnection();
      const referrerPubkey = new PublicKey(referral.referrerAddress);
      const vaultAta = await getAssociatedTokenAddress(
        this.mintPubkey,
        this.vaultKeypair.publicKey
      );

      // Pre-check vault balance to avoid unnecessary failed transactions
      try {
        const vaultAccount = await getAccount(connection, vaultAta);
        if (BigInt(vaultAccount.amount.toString()) < rawBonus) {
          this.logger.warn(
            `Vault balance insufficient for referral bonus (need ${bonusAmount} MVGA)`
          );
          return;
        }
      } catch {
        this.logger.warn('Could not check vault balance for referral bonus');
        return;
      }

      const referrerAta = await getAssociatedTokenAddress(this.mintPubkey, referrerPubkey);

      const tx = new Transaction().add(
        createTransferInstruction(vaultAta, referrerAta, this.vaultKeypair.publicKey, rawBonus)
      );

      const sig = await sendAndConfirmTransaction(connection, tx, [this.vaultKeypair]);

      await this.txLogger.log({
        walletAddress: referral.referrerAddress,
        type: 'REFERRAL_BONUS',
        signature: sig,
        amount: bonusAmount,
        token: 'MVGA',
      });
      await this.txLogger.confirm(sig);

      this.logger.log(
        `Referral bonus: ${bonusAmount.toFixed(2)} MVGA to ${referral.referrerAddress.slice(0, 8)}... (from ${walletAddress.slice(0, 8)}... claim)`
      );
    } catch (error) {
      this.logger.error(`Referral bonus failed for ${walletAddress}:`, error);
      // Non-critical — don't fail the claim
    }
  }

  /**
   * Daily vault reconciliation: compare on-chain balance vs DB sum
   */
  @Cron('0 0 * * *')
  async reconcileVault() {
    const lockId = await this.cronLockService.acquireLock('vault-reconciliation', 120_000);
    if (!lockId) return;

    try {
      const vaultWallet = this.config.get(
        'STAKING_VAULT_WALLET',
        'GNhLCjqThNJAJAdDYvRTr2EfWyGXAFUymaPuKaL1duEh'
      );

      const vaultAta = await getAssociatedTokenAddress(this.mintPubkey, new PublicKey(vaultWallet));
      const account = await getAccount(this.solana.getConnection(), vaultAta);
      const onChainBalance = BigInt(account.amount.toString());

      const agg = await this.prisma.stake.aggregate({
        where: { status: 'ACTIVE' },
        _sum: { amount: true },
      });
      const dbSum = agg._sum.amount ?? BigInt(0);

      const discrepancy = onChainBalance - dbSum;
      const discrepancyPercent =
        Number(dbSum) > 0 ? (Number(discrepancy) / Number(dbSum)) * 100 : 0;

      let status = 'OK';
      if (Math.abs(discrepancyPercent) > 5) status = 'CRITICAL';
      else if (Math.abs(discrepancyPercent) > 1) status = 'WARNING';

      await this.prisma.vaultReconciliation.create({
        data: {
          vaultType: 'STAKING',
          onChainBalance,
          dbSum,
          discrepancy,
          discrepancyPercent,
          status,
        },
      });

      if (status !== 'OK') {
        this.logger.warn(
          `VAULT RECONCILIATION ${status}: on-chain=${Number(onChainBalance) / 10 ** MVGA_DECIMALS}, ` +
            `db=${Number(dbSum) / 10 ** MVGA_DECIMALS}, diff=${discrepancyPercent.toFixed(2)}%`
        );
      } else {
        this.logger.log('Vault reconciliation: OK');
      }
    } catch (error) {
      this.logger.error('Vault reconciliation failed:', error);
    } finally {
      await this.cronLockService.releaseLock(lockId);
    }
  }

  private getTierForAmount(amount: number): StakingTier {
    for (let i = this.tiers.length - 1; i >= 0; i--) {
      if (amount >= this.tiers[i].minStake) {
        return this.tiers[i];
      }
    }
    return this.tiers[0];
  }
}
