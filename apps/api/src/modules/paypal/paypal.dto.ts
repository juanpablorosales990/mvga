import { IsString, IsNumber, IsPositive, IsOptional, MaxLength, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePayPalOrderDto {
  @ApiProperty({ description: 'Amount in USD (e.g. 10.50)' })
  @IsNumber()
  @IsPositive()
  amountUsd: number;

  @ApiProperty({ description: 'Optional description', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @ApiProperty({ description: 'Payment request ID to link this order to', required: false })
  @IsOptional()
  @IsString()
  paymentRequestId?: string;
}

export class CapturePayPalOrderDto {
  @ApiProperty({ description: 'PayPal order ID to capture' })
  @IsString()
  orderId: string;

  @ApiProperty({ description: 'Payment request ID to mark as paid', required: false })
  @IsOptional()
  @IsString()
  paymentRequestId?: string;
}

export class CreatePayPalDepositDto {
  @ApiProperty({ description: 'Amount in USD (e.g. 25.00)' })
  @IsNumber()
  @IsPositive()
  amountUsd: number;

  @ApiProperty({ description: 'Token to receive', enum: ['USDC', 'USDT'] })
  @IsIn(['USDC', 'USDT'])
  token: 'USDC' | 'USDT';
}
