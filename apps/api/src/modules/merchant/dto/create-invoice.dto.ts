import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  MaxLength,
  IsDateString,
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
  @ValidateNested({ each: true })
  @Type(() => InvoiceItem)
  items: InvoiceItem[];

  @ApiProperty({ default: 'USDC' })
  @IsString()
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
