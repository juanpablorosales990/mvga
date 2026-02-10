import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth.decorator';
import { SchedulerService } from './scheduler.service';
import {
  CreateRecurringPaymentDto,
  CreateDCAOrderDto,
  CompleteExecutionDto,
} from './scheduler.dto';

@ApiTags('Scheduler')
@Controller('scheduler')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class SchedulerController {
  constructor(private readonly schedulerService: SchedulerService) {}

  // ── Recurring Payments ──────────────────────────────────────────────

  @Post('payments')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async createPayment(
    @CurrentUser('wallet') wallet: string,
    @Body() dto: CreateRecurringPaymentDto
  ) {
    return this.schedulerService.createRecurringPayment(wallet, dto);
  }

  @Get('payments')
  async listPayments(@CurrentUser('wallet') wallet: string, @Query('status') status?: string) {
    return this.schedulerService.getRecurringPayments(wallet, status);
  }

  @Patch('payments/:id/pause')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async pausePayment(@CurrentUser('wallet') wallet: string, @Param('id') id: string) {
    return this.schedulerService.pauseRecurringPayment(wallet, id);
  }

  @Patch('payments/:id/resume')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async resumePayment(@CurrentUser('wallet') wallet: string, @Param('id') id: string) {
    return this.schedulerService.resumeRecurringPayment(wallet, id);
  }

  @Delete('payments/:id')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async cancelPayment(@CurrentUser('wallet') wallet: string, @Param('id') id: string) {
    return this.schedulerService.cancelRecurringPayment(wallet, id);
  }

  // ── DCA Orders ──────────────────────────────────────────────────────

  @Post('dca')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async createDCA(@CurrentUser('wallet') wallet: string, @Body() dto: CreateDCAOrderDto) {
    return this.schedulerService.createDCAOrder(wallet, dto);
  }

  @Get('dca')
  async listDCA(@CurrentUser('wallet') wallet: string, @Query('status') status?: string) {
    return this.schedulerService.getDCAOrders(wallet, status);
  }

  @Patch('dca/:id/pause')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async pauseDCA(@CurrentUser('wallet') wallet: string, @Param('id') id: string) {
    return this.schedulerService.pauseDCAOrder(wallet, id);
  }

  @Patch('dca/:id/resume')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async resumeDCA(@CurrentUser('wallet') wallet: string, @Param('id') id: string) {
    return this.schedulerService.resumeDCAOrder(wallet, id);
  }

  @Delete('dca/:id')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async cancelDCA(@CurrentUser('wallet') wallet: string, @Param('id') id: string) {
    return this.schedulerService.cancelDCAOrder(wallet, id);
  }

  // ── Executions ──────────────────────────────────────────────────────

  @Get('executions')
  async listExecutions(@CurrentUser('wallet') wallet: string) {
    return this.schedulerService.getPendingExecutions(wallet);
  }

  @Get('executions/:id')
  async getExecution(@CurrentUser('wallet') wallet: string, @Param('id') id: string) {
    return this.schedulerService.getExecution(wallet, id);
  }

  @Post('executions/:id/complete')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async completeExecution(
    @CurrentUser('wallet') wallet: string,
    @Param('id') id: string,
    @Body() dto: CompleteExecutionDto
  ) {
    return this.schedulerService.completeExecution(wallet, id, dto);
  }

  @Post('executions/:id/skip')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async skipExecution(@CurrentUser('wallet') wallet: string, @Param('id') id: string) {
    return this.schedulerService.skipExecution(wallet, id);
  }

  @Get('executions/:id/dca-tx')
  async buildDCATx(@CurrentUser('wallet') wallet: string, @Param('id') id: string) {
    return this.schedulerService.buildDCASwapTransaction(wallet, id);
  }
}
