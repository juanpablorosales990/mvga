import {
  IsString,
  IsNumber,
  IsPositive,
  IsIn,
  IsOptional,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
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

export class RequestFromUserDto {
  @ApiProperty({ description: '@username, #citizen, or raw Solana address' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  recipientIdentifier: string;

  @ApiProperty({ enum: ['USDC', 'USDT', 'MVGA'], description: 'Token to request payment in' })
  @IsIn(['USDC', 'USDT', 'MVGA'])
  token: 'USDC' | 'USDT' | 'MVGA';

  @ApiProperty({ description: 'Amount in human-readable units (e.g. 10.50)' })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({ description: 'Optional note (e.g. "for arepas")', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}

export class ParticipantShareDto {
  @ApiProperty({ description: '@username, #citizen, or raw Solana address' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  recipientIdentifier: string;

  @ApiProperty({ description: "This participant's share amount" })
  @IsNumber()
  @IsPositive()
  amount: number;
}

export class CreateSplitDto {
  @ApiProperty({ enum: ['USDC', 'USDT', 'MVGA'], description: 'Token for split payment' })
  @IsIn(['USDC', 'USDT', 'MVGA'])
  token: 'USDC' | 'USDT' | 'MVGA';

  @ApiProperty({ description: 'Total bill amount (e.g. 50.00)' })
  @IsNumber()
  @IsPositive()
  totalAmount: number;

  @ApiProperty({ description: 'Description (e.g. "Dinner at restaurant")' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  description: string;

  @ApiProperty({ description: 'Participants with their shares', type: [ParticipantShareDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ParticipantShareDto)
  participants: ParticipantShareDto[];
}

export class VerifyPaymentDto {
  @ApiProperty({ description: 'On-chain transaction signature (base58, 64-88 chars)' })
  @IsString()
  @MinLength(64)
  @MaxLength(88)
  @Matches(/^[1-9A-HJ-NP-Za-km-z]+$/, { message: 'Invalid base58 signature' })
  signature: string;
}
