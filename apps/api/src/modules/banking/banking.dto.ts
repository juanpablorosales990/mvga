import { IsOptional, IsEmail, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class JoinWaitlistDto {
  @ApiProperty({ description: 'Email for waitlist notifications', required: false })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;
}
