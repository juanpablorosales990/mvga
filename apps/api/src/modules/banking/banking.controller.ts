import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { BankingService } from './banking.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth.decorator';

@Controller('banking')
export class BankingController {
  constructor(private readonly bankingService: BankingService) {}

  @Post('card-waitlist')
  @UseGuards(AuthGuard)
  async joinWaitlist(@CurrentUser('wallet') wallet: string, @Body() body: { email?: string }) {
    return this.bankingService.joinCardWaitlist(wallet, body.email);
  }

  @Get('card-waitlist/status')
  @UseGuards(AuthGuard)
  async getWaitlistStatus(@CurrentUser('wallet') wallet: string) {
    return this.bankingService.getWaitlistStatus(wallet);
  }
}
