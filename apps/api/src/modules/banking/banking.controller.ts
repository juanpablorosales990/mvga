import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { BankingService } from './banking.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth.decorator';
import { JoinWaitlistDto } from './banking.dto';
import { SubmitKycDto } from './dto/kyc.dto';

@Controller('banking')
export class BankingController {
  constructor(private readonly bankingService: BankingService) {}

  // ─── Waitlist ──────────────────────────────────────────────────────

  @Post('card-waitlist')
  @UseGuards(AuthGuard)
  async joinWaitlist(@CurrentUser('wallet') wallet: string, @Body() dto: JoinWaitlistDto) {
    return this.bankingService.joinCardWaitlist(wallet, dto.email);
  }

  @Get('card-waitlist/status')
  @UseGuards(AuthGuard)
  async getWaitlistStatus(@CurrentUser('wallet') wallet: string) {
    return this.bankingService.getWaitlistStatus(wallet);
  }

  // ─── KYC ───────────────────────────────────────────────────────────

  @Post('kyc/submit')
  @UseGuards(AuthGuard)
  async submitKyc(@CurrentUser('wallet') wallet: string, @Body() dto: SubmitKycDto) {
    return this.bankingService.submitKyc(wallet, {
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      birthDate: dto.dateOfBirth,
      nationalId: dto.nationalId,
      countryOfIssue: dto.address.countryCode,
      address: dto.address,
    });
  }

  @Get('kyc/status/:wallet')
  @UseGuards(AuthGuard)
  async getKycStatus(@CurrentUser('wallet') wallet: string) {
    return this.bankingService.getKycStatus(wallet);
  }

  // ─── Card ──────────────────────────────────────────────────────────

  @Post('card/issue')
  @UseGuards(AuthGuard)
  async issueCard(@CurrentUser('wallet') wallet: string) {
    return this.bankingService.issueCard(wallet);
  }

  @Get('card/:wallet')
  @UseGuards(AuthGuard)
  async getCard(@CurrentUser('wallet') wallet: string) {
    return this.bankingService.getCard(wallet);
  }

  @Get('card/:wallet/balance')
  @UseGuards(AuthGuard)
  async getCardBalance(@CurrentUser('wallet') wallet: string) {
    return this.bankingService.getCardBalance(wallet);
  }

  @Post('card/:wallet/freeze')
  @UseGuards(AuthGuard)
  async freezeCard(@CurrentUser('wallet') wallet: string) {
    return this.bankingService.freezeCard(wallet);
  }

  @Post('card/:wallet/unfreeze')
  @UseGuards(AuthGuard)
  async unfreezeCard(@CurrentUser('wallet') wallet: string) {
    return this.bankingService.unfreezeCard(wallet);
  }

  @Post('card/:wallet/fund')
  @UseGuards(AuthGuard)
  async getFundingAddress(@CurrentUser('wallet') wallet: string) {
    return this.bankingService.getFundingAddress(wallet);
  }
}
