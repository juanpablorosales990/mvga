import {
  IsString,
  IsNumber,
  IsPositive,
  IsIn,
  IsOptional,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePaymentRequestDto {
  @ApiProperty({ enum: ['USDC', 'USDT', 'MVGA'], description: 'Token to request payment in' })
  @IsIn(['USDC', 'USDT', 'MVGA'])
  token: 'USDC' | 'USDT' | 'MVGA';

  @ApiProperty({ description: 'Amount in human-readable units (e.g. 10.50)' })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({ description: 'Optional memo for the payment', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  memo?: string;
}

export class VerifyPaymentDto {
  @ApiProperty({ description: 'On-chain transaction signature (base58, 64-88 chars)' })
  @IsString()
  @MinLength(64)
  @MaxLength(88)
  @Matches(/^[1-9A-HJ-NP-Za-km-z]+$/, { message: 'Invalid base58 signature' })
  signature: string;
}
