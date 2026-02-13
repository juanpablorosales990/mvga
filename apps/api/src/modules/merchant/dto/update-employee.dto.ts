import { IsOptional, IsString, IsEnum, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateEmployeeDto {
  @ApiProperty({ enum: ['MANAGER', 'CASHIER', 'VIEWER'], required: false })
  @IsOptional()
  @IsEnum(['MANAGER', 'CASHIER', 'VIEWER'] as const)
  role?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  nickname?: string;
}
