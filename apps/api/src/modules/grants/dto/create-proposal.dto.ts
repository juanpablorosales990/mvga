import {
  IsString,
  IsNumber,
  IsPositive,
  IsOptional,
  IsUrl,
  MinLength,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsSolanaAddress } from '../../../common/validators/solana-address.validator';

export class CreateProposalDto {
  @ApiProperty({ description: 'Applicant wallet address' })
  @IsSolanaAddress()
  applicantAddress: string;

  @ApiProperty({ description: 'Business name' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  businessName: string;

  @ApiProperty({ description: 'Business location (city, state)' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  businessLocation: string;

  @ApiProperty({ description: 'Business description and plan' })
  @IsString()
  @MinLength(50)
  @MaxLength(5000)
  description: string;

  @ApiProperty({ description: 'Requested amount in USD' })
  @IsNumber()
  @IsPositive()
  requestedAmount: number;

  @ApiProperty({ description: 'Video URL (optional)', required: false })
  @IsOptional()
  @IsUrl()
  videoUrl?: string;

  @ApiProperty({ description: 'Voting duration in days (3-30)', default: 7 })
  @IsNumber()
  @Min(3)
  @Max(30)
  votingDays: number;
}
