import {
  IsString,
  IsNumber,
  IsPositive,
  IsOptional,
  MaxLength,
  MinLength,
  Min,
  Max,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// ── LP Offer DTOs ──────────────────────────────────────────────

export class CreateVesOfferDto {
  @ApiProperty({ description: 'VES per 1 USDC (e.g., 42.5)' })
  @IsNumber()
  @IsPositive()
  @Max(1000)
  vesRate: number;

  @ApiProperty({ description: 'LP fee percentage (e.g., 1.5 = 1.5%)' })
  @IsNumber()
  @Min(0)
  @Max(10)
  feePercent: number;

  @ApiProperty({ description: 'Available USDC amount (human units, e.g., 500)' })
  @IsNumber()
  @IsPositive()
  availableUsdc: number;

  @ApiProperty({ description: 'Minimum order in USDC (human units)' })
  @IsNumber()
  @IsPositive()
  minOrderUsdc: number;

  @ApiProperty({ description: 'Maximum order in USDC (human units)' })
  @IsNumber()
  @IsPositive()
  maxOrderUsdc: number;

  @ApiProperty({ description: 'Venezuelan bank code (e.g., "0105")' })
  @IsString()
  @Matches(/^\d{4}$/, { message: 'Bank code must be 4 digits' })
  bankCode: string;

  @ApiProperty({ description: 'Bank name (e.g., "Banco Mercantil")' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  bankName: string;

  @ApiProperty({ description: 'Pago Movil phone number (e.g., "04163334455")' })
  @IsString()
  @Matches(/^04\d{9}$/, { message: 'Phone must be Venezuelan format (04XXXXXXXXX)' })
  phoneNumber: string;

  @ApiProperty({ description: 'Cedula de identidad (e.g., "V12345678")' })
  @IsString()
  @Matches(/^[VEJPGvejpg]\d{5,10}$/, { message: 'CI must be in format V12345678' })
  ciNumber: string;
}

// ── Order DTOs ─────────────────────────────────────────────────

export class CreateVesOrderDto {
  @ApiProperty({ description: 'Offer ID to buy from' })
  @IsString()
  offerId: string;

  @ApiProperty({ description: 'VES amount to send' })
  @IsNumber()
  @IsPositive()
  amountVes: number;
}

export class ConfirmLockDto {
  @ApiProperty({ description: 'Solana transaction signature for escrow lock' })
  @IsString()
  @MinLength(64)
  signature: string;
}

export class DisputeOrderDto {
  @ApiProperty({ description: 'Reason for dispute' })
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason: string;
}

export class ResolveDisputeDto {
  @ApiProperty({ description: 'Resolution: release USDC to buyer or refund to LP' })
  @IsString()
  @Matches(/^(RELEASE_TO_BUYER|REFUND_TO_LP)$/)
  resolution: 'RELEASE_TO_BUYER' | 'REFUND_TO_LP';

  @ApiProperty({ description: 'Resolution notes' })
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  notes: string;
}

export class MarkPaidDto {
  @ApiProperty({ description: 'Optional payment reference', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reference?: string;
}
