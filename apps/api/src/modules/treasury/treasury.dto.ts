import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ManualDistributionDto {
  @ApiPropertyOptional({ description: 'Override amount to distribute (in MVGA)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;
}

export class TreasuryStatsResponseDto {
  @ApiProperty()
  mainBalance: number;

  @ApiProperty()
  liquidityBalance: number;

  @ApiProperty()
  stakingBalance: number;

  @ApiProperty()
  grantsBalance: number;

  @ApiProperty()
  totalRevenue: number;

  @ApiProperty()
  totalDistributed: number;

  @ApiProperty()
  pendingDistribution: number;

  @ApiProperty()
  nextDistributionAt: string;

  @ApiProperty()
  lastDistributionAt: string | null;

  @ApiProperty()
  distributionBreakdown: {
    liquidityPercent: number;
    stakingPercent: number;
    grantsPercent: number;
  };
}

export class DistributionHistoryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  totalAmount: number;

  @ApiProperty()
  liquidityAmount: number;

  @ApiProperty()
  stakingAmount: number;

  @ApiProperty()
  grantsAmount: number;

  @ApiProperty()
  status: string;

  @ApiProperty()
  periodStart: string;

  @ApiProperty()
  periodEnd: string;

  @ApiProperty()
  executedAt: string | null;

  @ApiProperty()
  transactions: {
    liquidity: string | null;
    staking: string | null;
    grants: string | null;
  };
}

export class RecordFeeDto {
  @ApiProperty({ enum: ['SWAP', 'MOBILE_TOPUP', 'GIFT_CARD', 'YIELD', 'P2P'] })
  @IsString()
  source: 'SWAP' | 'MOBILE_TOPUP' | 'GIFT_CARD' | 'YIELD' | 'P2P';

  @ApiProperty({ description: 'Fee amount in smallest unit' })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ description: 'Token symbol' })
  @IsString()
  token: string;

  @ApiPropertyOptional({ description: 'Transaction signature' })
  @IsOptional()
  @IsString()
  signature?: string;

  @ApiPropertyOptional({ description: 'Related transaction' })
  @IsOptional()
  @IsString()
  relatedTx?: string;
}
