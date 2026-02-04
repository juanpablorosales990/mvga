import { IsString, IsNumber, IsPositive, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class StakeDto {
  @ApiProperty({ description: 'Wallet address' })
  @IsString()
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
  @IsString()
  address: string;

  @ApiProperty({ description: 'Amount of MVGA to unstake' })
  @IsNumber()
  @IsPositive()
  amount: number;
}
