import { IsString, IsNumber, IsPositive, IsOptional, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class QuoteDto {
  @ApiProperty({ description: 'Input token mint address' })
  @IsString()
  inputMint: string;

  @ApiProperty({ description: 'Output token mint address' })
  @IsString()
  outputMint: string;

  @ApiProperty({ description: 'Amount in smallest unit' })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({ description: 'Slippage in basis points', required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  slippageBps?: number;
}

export class SwapDto {
  @ApiProperty({ description: 'Quote response from Jupiter' })
  @IsObject()
  quoteResponse: any;

  @ApiProperty({ description: 'User wallet public key' })
  @IsString()
  userPublicKey: string;
}
