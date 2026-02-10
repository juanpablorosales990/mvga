import { Controller, Post, Get, Body, Param, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { KycGuard } from '../kyc/kyc.guard';
import { CurrentUser } from '../auth/auth.decorator';
import { MoneygramService } from './moneygram.service';
import {
  InitiateOfframpDto,
  InitiateOnrampDto,
  ConfirmTransactionDto,
  EstimateFeesDto,
  ListTransactionsDto,
} from './moneygram.dto';

@ApiTags('MoneyGram')
@Controller('moneygram')
export class MoneygramController {
  constructor(private readonly moneygramService: MoneygramService) {}

  @Get('status')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Check if MoneyGram is enabled and get limits' })
  status() {
    return {
      enabled: this.moneygramService.isEnabled,
      limits: {
        offramp: { min: 5, max: 2500 },
        onramp: { min: 5, max: 950 },
      },
    };
  }

  @Post('offramp/initiate')
  @UseGuards(AuthGuard, KycGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({ summary: 'Start MoneyGram cash-out (off-ramp)' })
  async initiateOfframp(@CurrentUser('wallet') wallet: string, @Body() dto: InitiateOfframpDto) {
    return this.moneygramService.initiateOfframp(wallet, dto.amountUsd);
  }

  @Post('offramp/confirm')
  @UseGuards(AuthGuard, KycGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Confirm off-ramp after MoneyGram webview completion' })
  async confirmOfframp(@CurrentUser('wallet') wallet: string, @Body() dto: ConfirmTransactionDto) {
    return this.moneygramService.confirmOfframp(wallet, dto.transactionId);
  }

  @Post('onramp/initiate')
  @UseGuards(AuthGuard, KycGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({ summary: 'Start MoneyGram cash deposit (on-ramp)' })
  async initiateOnramp(@CurrentUser('wallet') wallet: string, @Body() dto: InitiateOnrampDto) {
    return this.moneygramService.initiateOnramp(wallet, dto.amountUsd);
  }

  @Get('transaction/:id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get MoneyGram transaction details' })
  async getTransaction(@CurrentUser('wallet') wallet: string, @Param('id') id: string) {
    return this.moneygramService.getTransaction(wallet, id);
  }

  @Get('transactions')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List MoneyGram transactions' })
  async getTransactions(
    @CurrentUser('wallet') wallet: string,
    @Query() query: ListTransactionsDto
  ) {
    return this.moneygramService.getTransactions(wallet, query.direction);
  }

  @Post('transaction/:id/cancel')
  @UseGuards(AuthGuard, KycGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Cancel a MoneyGram transaction' })
  async cancelTransaction(@CurrentUser('wallet') wallet: string, @Param('id') id: string) {
    return this.moneygramService.cancelTransaction(wallet, id);
  }

  @Get('estimate')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Estimate fees for MoneyGram transaction' })
  async estimateFees(@Query() query: EstimateFeesDto) {
    return this.moneygramService.estimateFees(query.amountUsd, query.direction);
  }
}
