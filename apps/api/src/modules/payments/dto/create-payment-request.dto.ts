import { IsString, IsNumber, IsPositive, IsIn, IsOptional, MaxLength } from 'class-validator';
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
  @ApiProperty({ description: 'On-chain transaction signature' })
  @IsString()
  signature: string;
}
