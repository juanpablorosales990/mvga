import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsSolanaAddress } from '../../common/validators/solana-address.validator';

export class NonceDto {
  @ApiProperty({ description: 'Solana wallet address' })
  @IsSolanaAddress()
  walletAddress: string;
}

export class VerifyDto {
  @ApiProperty({ description: 'Solana wallet address' })
  @IsSolanaAddress()
  walletAddress: string;

  @ApiProperty({ description: 'Base58-encoded signature' })
  @IsString()
  @MinLength(64)
  signature: string;
}
