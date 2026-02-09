import {
  IsString,
  IsNumber,
  IsPositive,
  IsIn,
  IsOptional,
  IsInt,
  Min,
  Max,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const VALID_TOKENS = ['SOL', 'USDC', 'USDT', 'MVGA'] as const;
const VALID_FREQUENCIES = ['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY'] as const;

export class CreateRecurringPaymentDto {
  @ApiProperty({ description: 'Recipient Solana address (base58)' })
  @IsString()
  @MinLength(32)
  @MaxLength(44)
  @Matches(/^[1-9A-HJ-NP-Za-km-z]+$/, { message: 'Invalid base58 address' })
  recipientAddress: string;

  @ApiProperty({ description: 'Optional label for the recipient' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  recipientLabel?: string;

  @ApiProperty({ enum: VALID_TOKENS })
  @IsIn(VALID_TOKENS)
  token: string;

  @ApiProperty({ description: 'Amount in human-readable units (e.g. 10.50)' })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({ enum: VALID_FREQUENCIES })
  @IsIn(VALID_FREQUENCIES)
  frequency: string;

  @ApiProperty({ description: 'Optional memo', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  memo?: string;
}

export class CreateDCAOrderDto {
  @ApiProperty({ enum: VALID_TOKENS, description: 'Token to spend' })
  @IsIn(VALID_TOKENS)
  inputToken: string;

  @ApiProperty({ enum: VALID_TOKENS, description: 'Token to buy' })
  @IsIn(VALID_TOKENS)
  outputToken: string;

  @ApiProperty({ description: 'Amount to spend per cycle in human-readable units' })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({ enum: VALID_FREQUENCIES })
  @IsIn(VALID_FREQUENCIES)
  frequency: string;

  @ApiProperty({ description: 'Slippage in basis points (default 50 = 0.5%)', required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  slippageBps?: number;
}

export class CompleteExecutionDto {
  @ApiProperty({ description: 'On-chain transaction signature (base58, 64-88 chars)' })
  @IsString()
  @MinLength(64)
  @MaxLength(88)
  @Matches(/^[1-9A-HJ-NP-Za-km-z]+$/, { message: 'Invalid base58 signature' })
  signature: string;

  @ApiProperty({ description: 'Output amount received (for DCA tracking)', required: false })
  @IsOptional()
  @IsString()
  outputAmount?: string;
}
