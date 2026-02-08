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

export class DepositDto {
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
  @MinLength(64)
  @MaxLength(128)
  signature: string;
}

export class WithdrawDto {
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
  @IsUUID()
  positionId: string;

  @IsString()
  @MinLength(64)
  @MaxLength(128)
  signature: string;
}
