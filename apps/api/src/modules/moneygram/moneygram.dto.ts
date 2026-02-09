import { IsNumber, Min, Max, IsUUID, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InitiateOfframpDto {
  @ApiProperty({ description: 'Amount in USD (5-2500)', example: 100 })
  @IsNumber()
  @Min(5)
  @Max(2500)
  amountUsd: number;
}

export class InitiateOnrampDto {
  @ApiProperty({ description: 'Amount in USD (5-950)', example: 50 })
  @IsNumber()
  @Min(5)
  @Max(950)
  amountUsd: number;
}

export class ConfirmTransactionDto {
  @ApiProperty({ description: 'Transaction ID' })
  @IsUUID()
  transactionId: string;
}

export enum MoneygramDirectionQuery {
  ONRAMP = 'ONRAMP',
  OFFRAMP = 'OFFRAMP',
}

export class EstimateFeesDto {
  @ApiProperty({ description: 'Amount in USD', example: 100 })
  @IsNumber()
  @Min(1)
  amountUsd: number;

  @ApiProperty({ enum: MoneygramDirectionQuery, description: 'ONRAMP or OFFRAMP' })
  @IsEnum(MoneygramDirectionQuery)
  direction: MoneygramDirectionQuery;
}

export class ListTransactionsDto {
  @ApiPropertyOptional({ enum: MoneygramDirectionQuery })
  @IsOptional()
  @IsEnum(MoneygramDirectionQuery)
  direction?: MoneygramDirectionQuery;
}
