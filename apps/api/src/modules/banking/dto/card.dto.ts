import { IsString, IsNumber, IsPositive, IsOptional } from 'class-validator';

export class IssueCardDto {
  @IsString() walletAddress: string;
}

export class FundCardDto {
  @IsNumber()
  @IsPositive()
  amountUsdc: number;
}

export class CardActionDto {
  @IsString()
  @IsOptional()
  reason?: string;
}
