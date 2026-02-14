import { IsString, IsOptional, IsNumber, MaxLength, Min, Max, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  @Max(1000000, { message: 'Price must be under $1,000,000' })
  priceUsd: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(350000, { message: 'Product image must be under 250KB' })
  imageBase64?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
