import { IsString, IsOptional, IsEmail, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class UpdateProfileDto {
  @ApiPropertyOptional({ description: 'User email address' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Display name' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  displayName?: string;

  @ApiPropertyOptional({ description: 'Unique username (letters, numbers, underscores)' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username must contain only letters, numbers, and underscores',
  })
  username?: string;
}
