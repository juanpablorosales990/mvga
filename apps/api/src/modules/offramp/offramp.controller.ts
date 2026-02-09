import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth.decorator';
import { OfframpService } from './offramp.service';
import { CreatePayoutDto, CommitPayoutDto } from './offramp.dto';

@ApiTags('Offramp')
@Controller('offramp')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class OfframpController {
  constructor(private readonly offrampService: OfframpService) {}

  @Post('payout')
  async createPayout(@CurrentUser('wallet') wallet: string, @Body() dto: CreatePayoutDto) {
    return this.offrampService.createPayout(
      wallet,
      dto.recipientEmail,
      dto.amountUsd,
      dto.description
    );
  }

  @Post('payout/one-step')
  async createOneStepPayout(@CurrentUser('wallet') wallet: string, @Body() dto: CreatePayoutDto) {
    return this.offrampService.createOneStepPayout(
      wallet,
      dto.recipientEmail,
      dto.amountUsd,
      dto.description
    );
  }

  @Post('payout/commit')
  async commitPayout(@CurrentUser('wallet') wallet: string, @Body() dto: CommitPayoutDto) {
    return this.offrampService.commitPayout(wallet, dto.payoutId);
  }

  @Post('payout/:id/cancel')
  async cancelPayout(@CurrentUser('wallet') wallet: string, @Param('id') id: string) {
    return this.offrampService.cancelPayout(wallet, id);
  }

  @Get('payout/:id')
  async getPayoutStatus(@CurrentUser('wallet') wallet: string, @Param('id') id: string) {
    return this.offrampService.getPayoutStatus(wallet, id);
  }

  @Get('payouts')
  async getPayouts(@CurrentUser('wallet') wallet: string) {
    return this.offrampService.getPayouts(wallet);
  }

  @Get('balance')
  async getBalance() {
    return this.offrampService.getBalance();
  }
}
