import { IsString, IsNumber, IsPositive, IsOptional, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAlertDto {
  @ApiProperty({ description: 'Alert type: TOKEN_PRICE or VES_RATE' })
  @IsString()
  @Matches(/^(TOKEN_PRICE|VES_RATE)$/, { message: 'alertType must be TOKEN_PRICE or VES_RATE' })
  alertType: 'TOKEN_PRICE' | 'VES_RATE';

  @ApiProperty({ description: 'Token symbol (required for TOKEN_PRICE)', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^(SOL|USDC|USDT|MVGA)$/, { message: 'token must be SOL, USDC, USDT, or MVGA' })
  token?: string;

  @ApiProperty({ description: 'VES rate type (required for VES_RATE)', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^(BCV_OFFICIAL|PARALLEL_MARKET)$/, {
    message: 'vesRateType must be BCV_OFFICIAL or PARALLEL_MARKET',
  })
  vesRateType?: string;

  @ApiProperty({ description: 'Condition: ABOVE or BELOW' })
  @IsString()
  @Matches(/^(ABOVE|BELOW)$/, { message: 'condition must be ABOVE or BELOW' })
  condition: 'ABOVE' | 'BELOW';

  @ApiProperty({ description: 'Target price to trigger alert' })
  @IsNumber()
  @IsPositive()
  targetPrice: number;
}
