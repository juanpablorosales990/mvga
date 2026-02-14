import {
  IsString,
  IsOptional,
  IsArray,
  IsIn,
  ValidateNested,
  IsNumber,
  Min,
  Max,
  MaxLength,
  IsDateString,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class InvoiceItem {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  description: string;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  @Max(1000000, { message: 'Unit price must be under $1,000,000' })
  unitPrice: number;
}

export class CreateInvoiceDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  customerName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  customerEmail?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  customerAddress?: string;

  @ApiProperty({ type: [InvoiceItem] })
  @IsArray()
  @ArrayMaxSize(50, { message: 'Maximum 50 items per invoice' })
  @ValidateNested({ each: true })
  @Type(() => InvoiceItem)
  items: InvoiceItem[];

  @ApiProperty({ default: 'USDC' })
  @IsIn(['USDC', 'USDT', 'MVGA', 'SOL'])
  token: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  memo?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
