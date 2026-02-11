import { Controller, Post, Get, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth.decorator';
import { PaymentsService } from './payments.service';
import {
  CreatePaymentRequestDto,
  RequestFromUserDto,
  VerifyPaymentDto,
} from './dto/create-payment-request.dto';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('request')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  async createRequest(@CurrentUser('wallet') wallet: string, @Body() dto: CreatePaymentRequestDto) {
    return this.paymentsService.createRequest(wallet, dto.token, dto.amount, dto.memo);
  }

  @Get('request/:id')
  async getRequest(@Param('id') id: string) {
    return this.paymentsService.getRequest(id);
  }

  @Post('request/:id/verify')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async verifyPayment(@Param('id') id: string, @Body() dto: VerifyPaymentDto) {
    return this.paymentsService.verifyPayment(id, dto.signature);
  }

  // ── Social Requests (Phase 2) ────────────────────────────────────

  @Post('request-from-user')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  async requestFromUser(
    @CurrentUser('id') userId: string,
    @CurrentUser('wallet') wallet: string,
    @Body() dto: RequestFromUserDto
  ) {
    return this.paymentsService.requestFromUser(userId, wallet, dto);
  }

  @Get('my-requests')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  async getMyRequests(@CurrentUser('wallet') wallet: string) {
    return this.paymentsService.getMyRequests(wallet);
  }

  @Get('requests-for-me')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  async getRequestsForMe(@CurrentUser('wallet') wallet: string) {
    return this.paymentsService.getRequestsForMe(wallet);
  }

  @Patch('request/:id/decline')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  async declineRequest(@Param('id') id: string, @CurrentUser('wallet') wallet: string) {
    return this.paymentsService.declineRequest(id, wallet);
  }
}
