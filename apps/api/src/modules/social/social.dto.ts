import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  MinLength,
  MaxLength,
  Matches,
  ValidateNested,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

// ── Lookup ───────────────────────────────────────────────────────────

export class LookupUserDto {
  @ApiProperty({ description: 'Username to lookup (without @)', required: false })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  @Matches(/^[a-z0-9_]+$/, { message: 'Username must be lowercase alphanumeric + underscore' })
  username?: string;

  @ApiProperty({ description: 'Citizen number to lookup', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: 'Citizen number must be numeric' })
  citizen?: string;
}

// ── Contacts ─────────────────────────────────────────────────────────

export class ContactItemDto {
  @ApiProperty({ description: 'Display label for the contact' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  label: string;

  @ApiProperty({ description: 'Solana wallet address' })
  @IsString()
  @MinLength(32)
  @MaxLength(44)
  address: string;

  @ApiProperty({ description: 'Whether this contact is a favorite', required: false })
  @IsOptional()
  @IsBoolean()
  isFavorite?: boolean;
}

export class SyncContactsDto {
  @ApiProperty({ description: 'Array of contacts to sync', type: [ContactItemDto] })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ContactItemDto)
  contacts: ContactItemDto[];
}

export class ResolveAddressesDto {
  @ApiProperty({ description: 'Array of wallet addresses to resolve', type: [String] })
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  addresses: string[];
}
