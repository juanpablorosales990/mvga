import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ReferralsService } from './referrals.service';
import { ClaimReferralDto } from './referrals.dto';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth.decorator';

@Controller('referrals')
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Get('code')
  @UseGuards(AuthGuard)
  async getCode(@CurrentUser('wallet') wallet: string) {
    return this.referralsService.getOrCreateCode(wallet);
  }

  @Post('claim')
  @UseGuards(AuthGuard)
  async claim(@CurrentUser('wallet') wallet: string, @Body() dto: ClaimReferralDto) {
    return this.referralsService.claimReferral(wallet, dto.code);
  }

  @Get('stats')
  @UseGuards(AuthGuard)
  async getStats(@CurrentUser('wallet') wallet: string) {
    return this.referralsService.getStats(wallet);
  }
}
