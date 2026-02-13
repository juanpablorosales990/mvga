import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InviteEmployeeDto {
  @ApiProperty({ description: 'Username or wallet address of the user to invite' })
  @IsString()
  identifier: string;

  @ApiProperty({ enum: ['MANAGER', 'CASHIER', 'VIEWER'], default: 'CASHIER' })
  @IsEnum(['MANAGER', 'CASHIER', 'VIEWER'] as const)
  role: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  nickname?: string;
}
