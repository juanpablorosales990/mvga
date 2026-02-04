import { Injectable } from '@nestjs/common';
import { StakeDto, UnstakeDto } from './staking.dto';

export interface StakingTier {
  name: string;
  minStake: number;
  multiplier: number;
  benefits: string[];
}

export interface StakingPosition {
  stakedAmount: number;
  lockPeriod: number;
  lockEndDate: Date | null;
  earnedRewards: number;
  currentTier: string;
  apy: number;
}

export interface StakingInfo {
  totalStaked: number;
  totalStakers: number;
  rewardPool: number;
  baseApy: number;
}

@Injectable()
export class StakingService {
  // In production, these would come from database/blockchain
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

  async getStakingInfo(): Promise<StakingInfo> {
    // In production, fetch from database/blockchain
    return {
      totalStaked: 0,
      totalStakers: 0,
      rewardPool: 0,
      baseApy: 12,
    };
  }

  getTiers(): StakingTier[] {
    return this.tiers;
  }

  async getStakingPosition(address: string): Promise<StakingPosition> {
    // In production, fetch from database/blockchain
    // For now, return empty position
    return {
      stakedAmount: 0,
      lockPeriod: 0,
      lockEndDate: null,
      earnedRewards: 0,
      currentTier: 'Bronze',
      apy: 12,
    };
  }

  async createStakeTransaction(dto: StakeDto) {
    // In production:
    // 1. Create Solana transaction to transfer MVGA to staking vault
    // 2. Record staking position in database
    // 3. Return transaction for user to sign

    const tier = this.getTierForAmount(dto.amount);
    const multiplier = this.lockPeriodMultipliers[dto.lockPeriod] || 1.0;
    const effectiveApy = 12 * tier.multiplier * multiplier;

    return {
      success: true,
      message: 'Staking transaction created',
      data: {
        amount: dto.amount,
        lockPeriod: dto.lockPeriod,
        tier: tier.name,
        estimatedApy: effectiveApy,
        // transaction: serializedTransaction (would include actual Solana tx)
      },
    };
  }

  async createUnstakeTransaction(dto: UnstakeDto) {
    // In production:
    // 1. Check if lock period has ended
    // 2. Create Solana transaction to return MVGA + rewards
    // 3. Update database

    return {
      success: true,
      message: 'Unstake transaction created',
      data: {
        amount: dto.amount,
        // transaction: serializedTransaction
      },
    };
  }

  async createClaimTransaction(address: string) {
    // In production:
    // 1. Calculate pending rewards
    // 2. Create transaction to send rewards
    // 3. Update database

    return {
      success: true,
      message: 'Claim transaction created',
      data: {
        pendingRewards: 0,
        // transaction: serializedTransaction
      },
    };
  }

  private getTierForAmount(amount: number): StakingTier {
    // Find the highest tier the user qualifies for
    for (let i = this.tiers.length - 1; i >= 0; i--) {
      if (amount >= this.tiers[i].minStake) {
        return this.tiers[i];
      }
    }
    return this.tiers[0];
  }
}
