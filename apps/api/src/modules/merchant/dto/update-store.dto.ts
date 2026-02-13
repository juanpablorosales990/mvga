import {
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
  MaxLength,
  IsBoolean,
  MinLength,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateStoreDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  @Matches(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/)
  slug?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEnum(['FOOD', 'RETAIL', 'SERVICES', 'DIGITAL', 'FREELANCE', 'OTHER'] as const)
  category?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  logoBase64?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  acceptedTokens?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
