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

  /** Persona webhook — uses persona-signature header for HMAC. */
  @Post('webhook/persona')
  @Throttle({ default: { ttl: 60000, limit: 50 } })
  async handlePersonaWebhook(@Req() req: RawBodyRequest<Request>) {
    if (!req.rawBody) {
      throw new BadRequestException('Missing request body');
    }
    const rawBody = req.rawBody.toString('utf-8');
    const signatureHeader = (req.headers['persona-signature'] as string) || '';
    return this.kycService.handlePersonaWebhook(rawBody, signatureHeader);
  }
}
