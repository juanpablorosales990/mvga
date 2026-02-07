import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsSolanaAddress } from '../../../common/validators/solana-address.validator';

export class SubscribeDto {
  @ApiProperty({ description: 'Wallet address to subscribe notifications for' })
  @IsSolanaAddress()
  walletAddress: string;

  @ApiProperty({ description: 'Push subscription endpoint URL' })
  @IsString()
  endpoint: string;

  @ApiProperty({ description: 'Push encryption key (p256dh)' })
  @IsString()
  p256dh: string;

  @ApiProperty({ description: 'Push auth secret' })
  @IsString()
  auth: string;

  @ApiProperty({ description: 'User agent string', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  userAgent?: string;
}

export class UnsubscribeDto {
  @ApiProperty({ description: 'Push subscription endpoint URL to remove' })
  @IsString()
  endpoint: string;
}
