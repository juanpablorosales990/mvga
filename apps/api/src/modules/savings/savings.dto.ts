import {
  IsString,
  IsNumber,
  IsPositive,
  IsOptional,
  IsIn,
  IsUUID,
  MinLength,
  MaxLength,
} from 'class-validator';
import { IsSolanaAddress } from '../../common/validators/solana-address.validator';

export class DepositDto {
  @IsString()
  @IsSolanaAddress()
  walletAddress: string;

  @IsNumber()
  @IsPositive()
  amount: number; // In token units (e.g. 100.5 USDC)

  @IsString()
  @IsOptional()
  @IsIn(['USDC', 'USDT'])
  token?: string = 'USDC';
}

export class ConfirmDepositDto {
  @IsString()
  @IsSolanaAddress()
  walletAddress: string;

  @IsString()
  @MinLength(64)
  @MaxLength(128)
  signature: string;
}

export class WithdrawDto {
  @IsString()
  @IsSolanaAddress()
  walletAddress: string;

  @IsString()
  @IsUUID()
  positionId: string;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  amount?: number; // Partial withdrawal; omit for full
}

export class ConfirmWithdrawDto {
  @IsString()
  @IsSolanaAddress()
  walletAddress: string;

  @IsString()
  @IsUUID()
  positionId: string;

  @IsString()
  @MinLength(64)
  @MaxLength(128)
  signature: string;
}
