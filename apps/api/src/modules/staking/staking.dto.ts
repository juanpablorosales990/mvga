import {
  IsNumber,
  IsPositive,
  IsIn,
  IsString,
  MinLength,
  IsBoolean,
  IsUUID,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsSolanaAddress } from '../../common/validators/solana-address.validator';

export class StakeDto {
  @ApiProperty({ description: 'Wallet address' })
  @IsSolanaAddress()
  address: string;

  @ApiProperty({ description: 'Amount of MVGA to stake' })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({ description: 'Lock period in days', enum: [0, 30, 90, 180] })
  @IsNumber()
  @IsIn([0, 30, 90, 180])
  lockPeriod: number;
}

export class UnstakeDto {
  @ApiProperty({ description: 'Wallet address' })
  @IsSolanaAddress()
  address: string;

  @ApiProperty({ description: 'Amount of MVGA to unstake' })
  @IsNumber()
  @IsPositive()
  amount: number;
}

export class ConfirmStakeDto {
  @ApiProperty({ description: 'Transaction signature' })
  @IsString()
  @MinLength(64)
  signature: string;

  @ApiProperty({ description: 'Amount of MVGA staked' })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({ description: 'Lock period in days', enum: [0, 30, 90, 180] })
  @IsNumber()
  @IsIn([0, 30, 90, 180])
  lockPeriod: number;
}

export class ToggleAutoCompoundDto {
  @ApiProperty({ description: 'Stake ID' })
  @IsString()
  @IsUUID()
  stakeId: string;

  @ApiProperty({ description: 'Enable or disable auto-compound' })
  @IsBoolean()
  enabled: boolean;
}
