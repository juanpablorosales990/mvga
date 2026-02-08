import { IsString, IsIn, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsSolanaAddress } from '../../../common/validators/solana-address.validator';

export class CastVoteDto {
  @ApiProperty({ description: 'Voter wallet address' })
  @IsSolanaAddress()
  voterAddress: string;

  @ApiProperty({ enum: ['FOR', 'AGAINST'], description: 'Vote direction' })
  @IsIn(['FOR', 'AGAINST'])
  direction: 'FOR' | 'AGAINST';
}

export class PostUpdateDto {
  @ApiProperty({ description: 'Update title' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @ApiProperty({ description: 'Update content' })
  @IsString()
  @MinLength(10)
  @MaxLength(10000)
  content: string;
}
