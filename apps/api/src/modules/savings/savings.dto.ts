import { IsString, IsNumber, IsPositive, IsOptional, IsIn } from 'class-validator';
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
  signature: string;
}

export class WithdrawDto {
  @IsString()
  @IsSolanaAddress()
  walletAddress: string;

  @IsString()
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
  positionId: string;

  @IsString()
  signature: string;
}
