import {
  IsString,
  IsNumber,
  IsPositive,
  IsOptional,
  IsUrl,
  Matches,
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
  @Max(1_000_000)
  requestedAmount: number;

  @ApiProperty({ description: 'Video URL (optional, YouTube or Vimeo)', required: false })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(500)
  @Matches(/^https:\/\/(www\.)?(youtube\.com|youtu\.be|vimeo\.com)\//, {
    message: 'Only YouTube and Vimeo URLs are allowed',
  })
  videoUrl?: string;

  @ApiProperty({ description: 'Voting duration in days (3-30)', default: 7 })
  @IsNumber()
  @Min(3)
  @Max(30)
  votingDays: number;
}
