import {
  IsString,
  IsNumber,
  IsPositive,
  IsOptional,
  Min,
  Max,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GetProductsDto {
  @ApiProperty({ description: 'Filter by category', required: false })
  @IsString()
  @IsOptional()
  category?: string;
}

export class PurchaseGiftCardDto {
  @ApiProperty({ description: 'Bitrefill product ID', example: 'amazon-us' })
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({ description: 'Amount in USD', minimum: 5, maximum: 500 })
  @IsNumber()
  @IsPositive()
  @Min(5)
  @Max(500)
  amount: number;

  @ApiProperty({
    description: 'Solana transaction signature proving a USDC transfer to the MVGA treasury',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  paymentSignature: string;
}
