import { IsString, IsNumber, IsPositive, IsIn, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateOfferDto {
  @ApiProperty({ description: 'Seller wallet address' })
  @IsString()
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
  @IsString()
  paymentInstructions?: string;
}

export class AcceptOfferDto {
  @ApiProperty({ description: 'Buyer wallet address' })
  @IsString()
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
  @IsString()
  notes?: string;
}
