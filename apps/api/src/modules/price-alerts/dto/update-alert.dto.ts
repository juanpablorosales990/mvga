import { IsString, IsNumber, IsPositive, IsOptional, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateAlertDto {
  @ApiProperty({ description: 'Alert status', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^(ACTIVE|DISABLED)$/, { message: 'status must be ACTIVE or DISABLED' })
  status?: 'ACTIVE' | 'DISABLED';

  @ApiProperty({ description: 'New target price', required: false })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  targetPrice?: number;
}
