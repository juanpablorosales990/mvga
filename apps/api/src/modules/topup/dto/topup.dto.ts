import { IsString, IsNumber, IsPositive, IsIn, MaxLength, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DetectOperatorDto {
  @ApiProperty({ description: 'Phone number without country code (e.g. 4121234567)' })
  @IsString()
  @MaxLength(15)
  phone: string;

  @ApiProperty({ description: 'ISO country code', default: 'VE' })
  @IsString()
  @IsIn(['VE'])
  countryCode: string;
}

export class CreateTopUpDto {
  @ApiProperty({ description: 'Phone number without country code' })
  @IsString()
  @MaxLength(15)
  phone: string;

  @ApiProperty({ description: 'ISO country code', default: 'VE' })
  @IsString()
  @IsIn(['VE'])
  countryCode: string;

  @ApiProperty({ description: 'Reloadly operator ID' })
  @IsNumber()
  operatorId: number;

  @ApiProperty({ description: 'Amount in USD' })
  @IsNumber()
  @IsPositive()
  @Min(0.01)
  @Max(50)
  amount: number;

  @ApiProperty({
    description:
      'Solana transaction signature proving a USDC transfer to the MVGA treasury (prevents free top-ups)',
  })
  @IsString()
  @MaxLength(128)
  paymentSignature: string;
}
