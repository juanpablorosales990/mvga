import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma.service';
import { TransactionLoggerService } from '../../common/transaction-logger.service';
import { SolanaService } from '../wallet/solana.service';
import { StakeDto, UnstakeDto } from './staking.dto';
import {
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
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

@Injectable()
export class StakingService {
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
      name: 'Platinum',
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
    private readonly solana: SolanaService,
    private readonly config: ConfigService,
  ) {
    this.mintPubkey = new PublicKey(
      this.config.get('MVGA_TOKEN_MINT', 'DRX65kM2n5CLTpdjJCemZvkUwE98ou4RpHrd8Z3GH5Qh'),
    );

    // Load vault keypair from env (base64-encoded JSON array)
    const vaultKeypairStr = this.config.get<string>('STAKING_VAULT_KEYPAIR');
    if (vaultKeypairStr) {
      try {
        const decoded = Buffer.from(vaultKeypairStr, 'base64');
        this.vaultKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(decoded.toString())));
      } catch (e) {
        console.warn('Failed to load STAKING_VAULT_KEYPAIR:', e);
      }
    }
  }

  async getStakingInfo() {
    const [aggregation, stakerCount] = await Promise.all([
      this.prisma.stake.aggregate({
        where: { status: 'ACTIVE' },
        _sum: { amount: true },
      }),
      this.prisma.stake.groupBy({
        by: ['userId'],
        where: { status: 'ACTIVE' },
      }),
    ]);

    const totalStakedRaw = aggregation._sum.amount ?? BigInt(0);
    const totalStaked = Number(totalStakedRaw) / 10 ** MVGA_DECIMALS;

    // Get vault on-chain balance
    let rewardPool = 0;
    const vaultWallet = this.config.get('STAKING_VAULT_WALLET', 'GNhLCjqThNJAJAdDYvRTr2EfWyGXAFUymaPuKaL1duEh');
    try {
      const vaultAta = await getAssociatedTokenAddress(this.mintPubkey, new PublicKey(vaultWallet));
      const account = await getAccount(this.solana.getConnection(), vaultAta);
      const vaultBalance = Number(account.amount) / 10 ** MVGA_DECIMALS;
      rewardPool = Math.max(0, vaultBalance - totalStaked);
    } catch {
      // Vault ATA may not exist yet
    }

    return {
      totalStaked,
      totalStakers: stakerCount.length,
      rewardPool,
      baseApy: BASE_APY,
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
        currentTier: 'Bronze',
        apy: BASE_APY,
      };
    }

    const stakes = await this.prisma.stake.findMany({
      where: { userId: user.id, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });

    const totalStaked = stakes.reduce(
      (sum, s) => sum + Number(s.amount) / 10 ** MVGA_DECIMALS,
      0,
    );

    // Calculate earned rewards for each stake
    let totalRewards = 0;
    const formattedStakes = stakes.map((stake) => {
      const amount = Number(stake.amount) / 10 ** MVGA_DECIMALS;
      const tier = this.getTierForAmount(totalStaked);
      const lockMult = this.lockPeriodMultipliers[stake.lockPeriod] || 1.0;
      const effectiveApy = BASE_APY * tier.multiplier * lockMult;

      // Days since staked
      const daysSinceStake =
        (Date.now() - stake.createdAt.getTime()) / (1000 * 60 * 60 * 24);
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
      };
    });

    const tier = this.getTierForAmount(totalStaked);

    return {
      stakes: formattedStakes,
      totalStaked,
      earnedRewards: totalRewards,
      currentTier: tier.name,
      apy: BASE_APY * tier.multiplier,
    };
  }

  async createStakeTransaction(dto: StakeDto) {
    const vaultWallet = this.config.get(
      'STAKING_VAULT_WALLET',
      'GNhLCjqThNJAJAdDYvRTr2EfWyGXAFUymaPuKaL1duEh',
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

  async confirmStake(
    walletAddress: string,
    signature: string,
    amount: number,
    lockPeriod: number,
  ) {
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

    // Upsert user + create stake record
    const user = await this.prisma.user.upsert({
      where: { walletAddress },
      update: {},
      create: { walletAddress },
    });

    const amountRaw = BigInt(Math.round(amount * 10 ** MVGA_DECIMALS));
    const lockedUntil =
      lockPeriod > 0
        ? new Date(Date.now() + lockPeriod * 24 * 60 * 60 * 1000)
        : null;

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
    const user = await this.prisma.user.findUnique({
      where: { walletAddress: dto.address },
    });
    if (!user) throw new NotFoundException('No staking position found');

    // Find active stake
    const stake = await this.prisma.stake.findFirst({
      where: { userId: user.id, status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
    });

    if (!stake) {
      throw new BadRequestException('No active stake found');
    }

    // Check lock period
    if (stake.lockedUntil && new Date() < stake.lockedUntil) {
      throw new BadRequestException(
        `Stake locked until ${stake.lockedUntil.toISOString()}`,
      );
    }

    if (!this.vaultKeypair) {
      throw new BadRequestException(
        'Staking vault not configured. Contact support.',
      );
    }

    const amountToUnstake = Number(stake.amount) / 10 ** MVGA_DECIMALS;
    const requestedAmount = Math.min(dto.amount, amountToUnstake);
    const rawAmount = BigInt(Math.round(requestedAmount * 10 ** MVGA_DECIMALS));

    // Build transfer: vault → user
    const connection = this.solana.getConnection();
    const userPubkey = new PublicKey(dto.address);
    const vaultAta = await getAssociatedTokenAddress(
      this.mintPubkey,
      this.vaultKeypair.publicKey,
    );
    const userAta = await getAssociatedTokenAddress(this.mintPubkey, userPubkey);

    const tx = new Transaction().add(
      createTransferInstruction(vaultAta, userAta, this.vaultKeypair.publicKey, rawAmount),
    );

    const sig = await sendAndConfirmTransaction(connection, tx, [this.vaultKeypair]);

    // Update stake in database
    await this.prisma.stake.update({
      where: { id: stake.id },
      data: {
        status: 'UNSTAKED',
        unstakeTx: sig,
        unstakedAt: new Date(),
      },
    });

    // Log the transaction
    await this.txLogger.log({
      walletAddress: dto.address,
      type: 'UNSTAKE',
      signature: sig,
      amount: requestedAmount,
      token: 'MVGA',
    });
    await this.txLogger.confirm(sig);

    return {
      signature: sig,
      amount: requestedAmount,
      stakeId: stake.id,
    };
  }

  async createClaimTransaction(walletAddress: string) {
    const position = await this.getStakingPosition(walletAddress);

    if (position.earnedRewards <= 0) {
      throw new BadRequestException('No rewards to claim');
    }

    if (!this.vaultKeypair) {
      throw new BadRequestException(
        'Staking vault not configured. Contact support.',
      );
    }

    const rawRewards = BigInt(
      Math.round(position.earnedRewards * 10 ** MVGA_DECIMALS),
    );

    // Build transfer: vault → user (rewards)
    const connection = this.solana.getConnection();
    const userPubkey = new PublicKey(walletAddress);
    const vaultAta = await getAssociatedTokenAddress(
      this.mintPubkey,
      this.vaultKeypair.publicKey,
    );
    const userAta = await getAssociatedTokenAddress(this.mintPubkey, userPubkey);

    const tx = new Transaction().add(
      createTransferInstruction(vaultAta, userAta, this.vaultKeypair.publicKey, rawRewards),
    );

    const sig = await sendAndConfirmTransaction(connection, tx, [this.vaultKeypair]);

    return {
      signature: sig,
      rewards: position.earnedRewards,
    };
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
