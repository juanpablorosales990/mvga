import { IsString, IsOptional, IsUrl, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsSolanaAddress } from '../../../common/validators/solana-address.validator';

export class SubscribeDto {
  @ApiProperty({ description: 'Wallet address to subscribe notifications for' })
  @IsSolanaAddress()
  walletAddress: string;

  @ApiProperty({ description: 'Push subscription endpoint URL' })
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  endpoint: string;

  @ApiProperty({ description: 'Push encryption key (p256dh)' })
  @IsString()
  @MaxLength(128)
  p256dh: string;

  @ApiProperty({ description: 'Push auth secret' })
  @IsString()
  @MaxLength(64)
  auth: string;

  @ApiProperty({ description: 'User agent string', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  userAgent?: string;
}

export class UnsubscribeDto {
  @ApiProperty({ description: 'Push subscription endpoint URL to remove' })
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  endpoint: string;
}
