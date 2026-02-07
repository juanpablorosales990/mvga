import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SavingsService } from './savings.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth.decorator';
import { DepositDto, ConfirmDepositDto, WithdrawDto, ConfirmWithdrawDto } from './savings.dto';

@Throttle({ default: { ttl: 60000, limit: 20 } })
@Controller('savings')
export class SavingsController {
  constructor(private readonly savingsService: SavingsService) {}

  /** Get current yield rates from all protocols. */
  @Get('rates')
  async getRates() {
    return this.savingsService.getRates();
  }

  /** Get a user's savings positions and earnings. */
  @Get(':wallet')
  async getPositions(@Param('wallet') wallet: string) {
    return this.savingsService.getPositions(wallet);
  }

  /** Initiate a deposit — returns vault info for the client to build the tx. */
  @Post('deposit')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @UseGuards(AuthGuard)
  async deposit(@CurrentUser('wallet') wallet: string, @Body() dto: DepositDto) {
    return this.savingsService.initiateDeposit(wallet, dto.amount, dto.token);
  }

  /** Confirm a deposit after the user has signed the transaction. */
  @Post('confirm-deposit')
  @UseGuards(AuthGuard)
  async confirmDeposit(@CurrentUser('wallet') wallet: string, @Body() dto: ConfirmDepositDto) {
    return this.savingsService.confirmDeposit(wallet, dto.signature);
  }

  /** Initiate a withdrawal from a savings position. */
  @Post('withdraw')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @UseGuards(AuthGuard)
  async withdraw(@CurrentUser('wallet') wallet: string, @Body() dto: WithdrawDto) {
    return this.savingsService.initiateWithdraw(wallet, dto.positionId, dto.amount);
  }

  /** Confirm a withdrawal after the user has signed the transaction. */
  @Post('confirm-withdraw')
  @UseGuards(AuthGuard)
  async confirmWithdraw(@CurrentUser('wallet') wallet: string, @Body() dto: ConfirmWithdrawDto) {
    return this.savingsService.confirmWithdraw(wallet, dto.positionId, dto.signature);
  }
}
