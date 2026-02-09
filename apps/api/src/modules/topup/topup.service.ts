import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma.service';
import { randomUUID } from 'crypto';

interface ReloadlyToken {
  accessToken: string;
  expiresAt: number;
}

export interface ReloadlyOperator {
  operatorId: number;
  name: string;
  denominationType: string;
  minAmount: number | null;
  maxAmount: number | null;
  fixedAmounts: number[];
  suggestedAmounts: number[];
  country: { isoName: string; name: string };
}

@Injectable()
export class TopUpService {
  private readonly logger = new Logger(TopUpService.name);
  private token: ReloadlyToken | null = null;
  private readonly baseUrl: string;
  private readonly authUrl = 'https://auth.reloadly.com/oauth/token';

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {
    const isSandbox = this.config.get('RELOADLY_SANDBOX') !== 'false';
    this.baseUrl = isSandbox
      ? 'https://topups-sandbox.reloadly.com'
      : 'https://topups.reloadly.com';
  }

  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 5min buffer)
    if (this.token && this.token.expiresAt > Date.now() + 300_000) {
      return this.token.accessToken;
    }

    const clientId = this.config.get('RELOADLY_CLIENT_ID');
    const clientSecret = this.config.get('RELOADLY_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new BadRequestException('Reloadly not configured');
    }

    const isSandbox = this.config.get('RELOADLY_SANDBOX') !== 'false';
    const audience = isSandbox
      ? 'https://topups-sandbox.reloadly.com'
      : 'https://topups.reloadly.com';

    const res = await fetch(this.authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
        audience,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`Reloadly auth failed: ${err}`);
      throw new BadRequestException('Failed to authenticate with Reloadly');
    }

    const data = await res.json();
    this.token = {
      accessToken: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };

    this.logger.log('Reloadly token refreshed');
    return this.token.accessToken;
  }

  private async reloadlyGet(path: string) {
    const token = await this.getAccessToken();
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/com.reloadly.topups-v1+json',
      },
    });

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`Reloadly GET ${path} failed: ${err}`);
      throw new BadRequestException('Reloadly request failed');
    }

    return res.json();
  }

  private async reloadlyPost(path: string, body: Record<string, unknown>) {
    const token = await this.getAccessToken();
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/com.reloadly.topups-v1+json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`Reloadly POST ${path} failed: ${err}`);
      throw new BadRequestException('Reloadly request failed');
    }

    return res.json();
  }

  /** Get all operators for a country */
  async getOperators(countryCode: string): Promise<ReloadlyOperator[]> {
    return this.reloadlyGet(`/operators/countries/${countryCode}`);
  }

  /** Auto-detect operator by phone number */
  async detectOperator(phone: string, countryCode: string): Promise<ReloadlyOperator> {
    return this.reloadlyGet(
      `/operators/auto-detect/phone/${phone}/countries/${countryCode}?suggestedAmounts=true`
    );
  }

  /** Execute a top-up */
  async topUp(
    walletAddress: string,
    phone: string,
    countryCode: string,
    operatorId: number,
    amountUsd: number
  ) {
    const customIdentifier = `mvga-${randomUUID()}`;

    // Create DB record first (PENDING)
    const topup = await this.prisma.topUp.create({
      data: {
        userId: walletAddress,
        recipientPhone: phone,
        countryCode,
        operatorId,
        operatorName: '', // Will be updated after Reloadly response
        amountUsd,
        customIdentifier,
      },
    });

    try {
      const result = await this.reloadlyPost('/topups', {
        operatorId,
        amount: amountUsd,
        useLocalAmount: false,
        customIdentifier,
        recipientPhone: {
          countryCode,
          number: phone,
        },
      });

      // Update with success data
      await this.prisma.topUp.update({
        where: { id: topup.id },
        data: {
          status: 'SUCCESSFUL',
          reloadlyTxId: String(result.transactionId),
          operatorName: result.operatorName || '',
          deliveredAmount: result.deliveredAmount,
          deliveredCurrency: result.deliveredAmountCurrencyCode,
        },
      });

      this.logger.log(
        `Top-up successful: ${amountUsd} USD → ${result.deliveredAmount} ${result.deliveredAmountCurrencyCode} to ${phone}`
      );

      return {
        id: topup.id,
        status: 'SUCCESSFUL',
        operatorName: result.operatorName,
        amountUsd,
        deliveredAmount: result.deliveredAmount,
        deliveredCurrency: result.deliveredAmountCurrencyCode,
        reloadlyTxId: result.transactionId,
      };
    } catch (error) {
      // Mark as failed
      await this.prisma.topUp.update({
        where: { id: topup.id },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      throw error;
    }
  }

  /** Get top-up history for a user */
  async getHistory(walletAddress: string) {
    return this.prisma.topUp.findMany({
      where: { userId: walletAddress },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  /** Get Reloadly account balance */
  async getBalance() {
    return this.reloadlyGet('/accounts/balance');
  }
}
