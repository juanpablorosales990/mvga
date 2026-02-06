import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

export interface TierDefinition {
  name: string;
  minStake: number;
  multiplier: number;
  cashbackRate: number;
  feeDiscount: number;
  benefits: string[];
}

export interface UserTierInfo {
  tier: TierDefinition;
  totalStaked: number;
  nextTier: TierDefinition | null;
  amountToNextTier: number;
}

@Injectable()
export class TiersService {
  readonly tiers: TierDefinition[] = [
    {
      name: 'Bronze',
      minStake: 0,
      multiplier: 1.0,
      cashbackRate: 0,
      feeDiscount: 0,
      benefits: ['Basic wallet access', 'Community access'],
    },
    {
      name: 'Silver',
      minStake: 10_000,
      multiplier: 1.2,
      cashbackRate: 0.005,
      feeDiscount: 0.1,
      benefits: ['0.5% cashback on swaps', 'Priority support', '10% fee discount'],
    },
    {
      name: 'Gold',
      minStake: 50_000,
      multiplier: 1.5,
      cashbackRate: 0.01,
      feeDiscount: 0.25,
      benefits: [
        '1% cashback on swaps',
        'Governance voting',
        'Early feature access',
        '25% fee discount',
      ],
    },
    {
      name: 'Diamond',
      minStake: 200_000,
      multiplier: 2.0,
      cashbackRate: 0.02,
      feeDiscount: 1.0,
      benefits: ['2% cashback', 'Zero fees', 'VIP support', 'Exclusive events'],
    },
  ];

  constructor(private readonly prisma: PrismaService) {}

  getTiers(): TierDefinition[] {
    return this.tiers;
  }

  getTierForAmount(amount: number): TierDefinition {
    for (let i = this.tiers.length - 1; i >= 0; i--) {
      if (amount >= this.tiers[i].minStake) {
        return this.tiers[i];
      }
    }
    return this.tiers[0];
  }

  getNextTier(currentTier: TierDefinition): TierDefinition | null {
    const idx = this.tiers.findIndex((t) => t.name === currentTier.name);
    return idx < this.tiers.length - 1 ? this.tiers[idx + 1] : null;
  }

  async getUserTier(walletAddress: string): Promise<UserTierInfo> {
    const stakes = await this.prisma.stake.findMany({
      where: {
        user: { walletAddress },
        status: 'ACTIVE',
      },
      select: { amount: true },
    });

    const totalStaked = stakes.reduce((sum, s) => sum + Number(s.amount), 0);
    const tier = this.getTierForAmount(totalStaked);
    const nextTier = this.getNextTier(tier);

    return {
      tier,
      totalStaked,
      nextTier,
      amountToNextTier: nextTier ? Math.max(0, nextTier.minStake - totalStaked) : 0,
    };
  }

  async getCashbackRate(walletAddress: string): Promise<number> {
    const { tier } = await this.getUserTier(walletAddress);
    return tier.cashbackRate;
  }

  async getFeeDiscount(walletAddress: string): Promise<number> {
    const { tier } = await this.getUserTier(walletAddress);
    return tier.feeDiscount;
  }
}
