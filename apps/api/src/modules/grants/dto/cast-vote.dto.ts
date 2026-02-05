import { IsString, IsIn } from 'class-validator';
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
  title: string;

  @ApiProperty({ description: 'Update content' })
  @IsString()
  content: string;
}
