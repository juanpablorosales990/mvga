import {
  IsString,
  IsNumber,
  IsPositive,
  IsIn,
  Min,
  Max,
  IsOptional,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsSolanaAddress } from '../../../common/validators/solana-address.validator';

export class CreateOfferDto {
  @ApiProperty({ description: 'Seller wallet address' })
  @IsSolanaAddress()
  sellerAddress: string;

  @ApiProperty({ enum: ['BUY', 'SELL'], description: 'BUY = buying crypto, SELL = selling crypto' })
  @IsIn(['BUY', 'SELL'])
  type: 'BUY' | 'SELL';

  @ApiProperty({ description: 'Amount of crypto' })
  @IsNumber()
  @IsPositive()
  cryptoAmount: number;

  @ApiProperty({ enum: ['USDC', 'MVGA'], description: 'Cryptocurrency' })
  @IsIn(['USDC', 'MVGA'])
  cryptoCurrency: 'USDC' | 'MVGA';

  @ApiProperty({ enum: ['ZELLE', 'VENMO', 'PAYPAL', 'BANK_TRANSFER'] })
  @IsIn(['ZELLE', 'VENMO', 'PAYPAL', 'BANK_TRANSFER'])
  paymentMethod: 'ZELLE' | 'VENMO' | 'PAYPAL' | 'BANK_TRANSFER';

  @ApiProperty({ description: 'Exchange rate (e.g., 0.99 = 1% below market)' })
  @IsNumber()
  @Min(0.8)
  @Max(1.2)
  rate: number;

  @ApiProperty({ description: 'Minimum trade amount in USD' })
  @IsNumber()
  @IsPositive()
  minAmount: number;

  @ApiProperty({ description: 'Maximum trade amount in USD' })
  @IsNumber()
  @IsPositive()
  maxAmount: number;

  @ApiProperty({ description: 'Payment instructions', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  paymentInstructions?: string;
}

export class AcceptOfferDto {
  @ApiProperty({ description: 'Buyer wallet address' })
  @IsSolanaAddress()
  buyerAddress: string;

  @ApiProperty({ description: 'Amount in USD' })
  @IsNumber()
  @IsPositive()
  amount: number;
}

export class UpdateTradeStatusDto {
  @ApiProperty({ enum: ['PAID', 'CONFIRMED', 'DISPUTED', 'CANCELLED'] })
  @IsIn(['PAID', 'CONFIRMED', 'DISPUTED', 'CANCELLED'])
  status: 'PAID' | 'CONFIRMED' | 'DISPUTED' | 'CANCELLED';

  @ApiProperty({ description: 'Evidence/notes', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class MarkPaidDto {
  @ApiProperty({ description: 'Payment notes', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class OpenDisputeDto {
  @ApiProperty({ description: 'Reason for dispute' })
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason: string;

  @ApiProperty({ description: 'Supporting evidence', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  evidence?: string;
}

export class ConfirmEscrowDto {
  @ApiProperty({ description: 'Transaction signature' })
  @IsString()
  @MinLength(64)
  signature: string;
}

export class ResolveDisputeDto {
  @ApiProperty({ enum: ['RELEASE_TO_BUYER', 'REFUND_TO_SELLER'] })
  @IsIn(['RELEASE_TO_BUYER', 'REFUND_TO_SELLER'])
  resolution: 'RELEASE_TO_BUYER' | 'REFUND_TO_SELLER';

  @ApiProperty({ description: 'Resolution notes' })
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  notes: string;
}
