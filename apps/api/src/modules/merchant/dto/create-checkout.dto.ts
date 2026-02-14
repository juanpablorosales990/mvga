import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  IsIn,
  ValidateNested,
  Min,
  Max,
  IsInt,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class CheckoutItem {
  @ApiProperty()
  @IsString()
  productId: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateCheckoutDto {
  @ApiProperty({ required: false, description: 'Quick amount (USD). Omit if using items.' })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(1000000, { message: 'Amount must be under $1,000,000' })
  amount?: number;

  @ApiProperty()
  @IsIn(['USDC', 'USDT', 'MVGA', 'SOL'])
  token: string;

  @ApiProperty({ required: false, description: 'Items from catalog. Omit if using quick amount.' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50, { message: 'Maximum 50 items per checkout' })
  @ValidateNested({ each: true })
  @Type(() => CheckoutItem)
  items?: CheckoutItem[];
}
