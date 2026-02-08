import {
  IsString,
  IsNumber,
  IsPositive,
  IsOptional,
  IsObject,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { JupiterQuote } from './swap.service';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsSolanaAddress } from '../../common/validators/solana-address.validator';

export class QuoteDto {
  @ApiProperty({ description: 'Input token mint address' })
  @IsSolanaAddress()
  inputMint: string;

  @ApiProperty({ description: 'Output token mint address' })
  @IsSolanaAddress()
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
  quoteResponse: JupiterQuote;

  @ApiProperty({ description: 'User wallet public key' })
  @IsSolanaAddress()
  userPublicKey: string;
}

export class RecordSwapDto {
  @ApiProperty({ description: 'User wallet address' })
  @IsSolanaAddress()
  walletAddress: string;

  @ApiProperty({ description: 'Transaction signature' })
  @IsString()
  @MinLength(64)
  @MaxLength(128)
  signature: string;

  @ApiProperty({ description: 'Input token mint address' })
  @IsSolanaAddress()
  inputMint: string;

  @ApiProperty({ description: 'Output token mint address' })
  @IsSolanaAddress()
  outputMint: string;

  @ApiProperty({ description: 'Input amount in smallest unit' })
  @IsString()
  @Matches(/^\d+$/, { message: 'inputAmount must be a numeric string' })
  @MaxLength(20)
  inputAmount: string;

  @ApiProperty({ description: 'Output amount in smallest unit' })
  @IsString()
  @Matches(/^\d+$/, { message: 'outputAmount must be a numeric string' })
  @MaxLength(20)
  outputAmount: string;
}
