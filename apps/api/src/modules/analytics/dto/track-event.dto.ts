import { IsString, IsOptional, IsObject, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TrackEventDto {
  @ApiProperty({ example: 'send_completed' })
  @IsString()
  @MaxLength(100)
  event: string;

  @ApiProperty({ required: false, example: { token: 'USDC', amount: 10 } })
  @IsOptional()
  @IsObject()
  properties?: Record<string, unknown>;
}
