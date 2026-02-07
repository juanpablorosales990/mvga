import { IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePreferencesDto {
  @ApiProperty({ description: 'Receive P2P trade notifications', required: false })
  @IsOptional()
  @IsBoolean()
  p2pTrades?: boolean;

  @ApiProperty({ description: 'Receive staking notifications', required: false })
  @IsOptional()
  @IsBoolean()
  staking?: boolean;

  @ApiProperty({ description: 'Receive referral notifications', required: false })
  @IsOptional()
  @IsBoolean()
  referrals?: boolean;

  @ApiProperty({ description: 'Receive grant notifications', required: false })
  @IsOptional()
  @IsBoolean()
  grants?: boolean;
}
