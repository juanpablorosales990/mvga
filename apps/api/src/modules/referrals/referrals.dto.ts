import { IsString, Length } from 'class-validator';

export class ClaimReferralDto {
  @IsString()
  @Length(6, 6)
  code: string;
}
