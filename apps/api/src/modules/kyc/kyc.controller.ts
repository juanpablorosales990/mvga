import {
  Controller,
  Post,
  Get,
  Req,
  UseGuards,
  RawBodyRequest,
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth.decorator';
import { KycService } from './kyc.service';
import { Request } from 'express';

@Controller('kyc')
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Post('session')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @UseGuards(AuthGuard)
  async createSession(@CurrentUser('id') userId: string, @CurrentUser('wallet') wallet: string) {
    return this.kycService.createSession(userId, wallet);
  }

  @Get('status')
  @UseGuards(AuthGuard)
  async getStatus(@CurrentUser('id') userId: string) {
    return this.kycService.getStatus(userId);
  }

  @Post('webhook')
  @Throttle({ default: { ttl: 60000, limit: 50 } })
  async handleWebhook(@Req() req: RawBodyRequest<Request>) {
    // Use the raw body bytes for HMAC verification — JSON.stringify(req.body)
    // produces different bytes than what Sumsub signed (key ordering, whitespace).
    if (!req.rawBody) {
      throw new BadRequestException('Missing request body');
    }
    const rawBody = req.rawBody.toString('utf-8');
    const signature = (req.headers['x-payload-digest'] as string) || '';
    return this.kycService.handleWebhook(rawBody, signature);
  }
}
