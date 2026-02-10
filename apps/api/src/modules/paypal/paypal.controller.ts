import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Headers,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth.decorator';
import { PayPalService } from './paypal.service';
import { CreatePayPalOrderDto, CapturePayPalOrderDto, CreatePayPalDepositDto } from './paypal.dto';
import { PayPalAdapter } from './paypal.adapter';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@ApiTags('PayPal')
@Controller('paypal')
export class PayPalController {
  constructor(
    private readonly paypalService: PayPalService,
    private readonly adapter: PayPalAdapter,
    private readonly config: ConfigService
  ) {}

  @Get('status')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  getStatus() {
    return { enabled: this.paypalService.isEnabled };
  }

  @Post('order/payment')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async createOrderForPayment(@Body() dto: CreatePayPalOrderDto) {
    if (!dto.paymentRequestId) {
      throw new Error('paymentRequestId is required');
    }
    return this.paypalService.createOrderForPayment(
      dto.paymentRequestId,
      dto.amountUsd,
      dto.description
    );
  }

  @Post('capture/payment')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async captureOrderForPayment(@Body() dto: CapturePayPalOrderDto) {
    if (!dto.paymentRequestId) {
      throw new Error('paymentRequestId is required');
    }
    return this.paypalService.captureOrderForPayment(dto.paymentRequestId, dto.orderId);
  }

  @Post('order/deposit')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async createOrderForDeposit(
    @CurrentUser('wallet') wallet: string,
    @Body() dto: CreatePayPalDepositDto
  ) {
    return this.paypalService.createOrderForDeposit(wallet, dto.amountUsd, dto.token);
  }

  @Post('capture/deposit')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async captureOrderForDeposit(
    @CurrentUser('wallet') wallet: string,
    @Body() dto: CapturePayPalOrderDto & { token: string }
  ) {
    return this.paypalService.captureOrderForDeposit(wallet, dto.orderId, dto.token || 'USDC');
  }

  @Post('webhook')
  @Throttle({ default: { limit: 50, ttl: 60000 } })
  async handleWebhook(
    @Headers() headers: Record<string, string>,
    @Req() req: RawBodyRequest<Request>
  ) {
    const webhookId = this.config.get<string>('PAYPAL_WEBHOOK_ID');
    if (!webhookId) return { received: true };

    const rawBody = req.rawBody?.toString() || JSON.stringify(req.body);
    const verified = await this.adapter.verifyWebhookSignature(headers, rawBody, webhookId);
    if (!verified) {
      return { error: 'Invalid webhook signature' };
    }

    // Webhook events are a safety net — primary capture happens via client-driven flow
    return { received: true };
  }
}
