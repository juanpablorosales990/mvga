import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
  IsInt,
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
  amount?: number;

  @ApiProperty()
  @IsString()
  token: string;

  @ApiProperty({ required: false, description: 'Items from catalog. Omit if using quick amount.' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckoutItem)
  items?: CheckoutItem[];
}
