import {
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
  MaxLength,
  Matches,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateStoreDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name: string;

  @ApiProperty({ description: 'URL slug (lowercase, hyphens, no spaces)' })
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  @Matches(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, {
    message: 'Slug must be lowercase alphanumeric with hyphens, no leading/trailing hyphens',
  })
  slug: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ enum: ['FOOD', 'RETAIL', 'SERVICES', 'DIGITAL', 'FREELANCE', 'OTHER'] })
  @IsEnum(['FOOD', 'RETAIL', 'SERVICES', 'DIGITAL', 'FREELANCE', 'OTHER'] as const)
  category: string;

  @ApiProperty({ type: [String], default: ['USDC'] })
  @IsArray()
  @IsString({ each: true })
  acceptedTokens: string[];
}
