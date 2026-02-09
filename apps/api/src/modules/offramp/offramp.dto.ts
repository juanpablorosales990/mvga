import {
  IsString,
  IsNumber,
  IsPositive,
  IsEmail,
  IsOptional,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePayoutDto {
  @ApiProperty({ description: 'Recipient Airtm email address' })
  @IsEmail()
  recipientEmail: string;

  @ApiProperty({ description: 'Amount in USD', minimum: 1, maximum: 1800 })
  @IsNumber()
  @IsPositive()
  @Min(1)
  @Max(1800)
  amountUsd: number;

  @ApiProperty({ description: 'Optional description/memo', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}

export class CommitPayoutDto {
  @ApiProperty({ description: 'Payout ID to commit' })
  @IsString()
  payoutId: string;
}
