import {
  IsString,
  IsEmail,
  IsIn,
  IsObject,
  IsOptional,
  ValidateNested,
  MaxLength,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AddressDto {
  @IsString() @MaxLength(255) line1: string;
  @IsString() @MaxLength(100) city: string;
  @IsString() @MaxLength(100) region: string;
  @IsString() @MaxLength(20) postalCode: string;
  @IsString() @MaxLength(3) countryCode: string;
}

export class SubmitKycDto {
  @IsString() @MaxLength(100) firstName: string;
  @IsString() @MaxLength(100) lastName: string;
  @IsOptional() @IsEmail() @MaxLength(254) email?: string;
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) dateOfBirth: string; // YYYY-MM-DD
  @IsString() @IsIn(['cedula', 'passport', 'drivers_license']) nationalIdType: string;
  @IsString() @MaxLength(50) nationalId: string;

  @IsObject()
  @ValidateNested()
  @Type(() => AddressDto)
  address: AddressDto;
}
