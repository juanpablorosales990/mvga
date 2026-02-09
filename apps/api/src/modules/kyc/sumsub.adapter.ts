import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';

export interface SumsubAccessToken {
  token: string;
  userId: string;
}

export interface SumsubApplicantStatus {
  id: string;
  reviewStatus: string;
  reviewResult?: {
    reviewAnswer: 'GREEN' | 'RED' | 'ERROR';
    rejectLabels?: string[];
    reviewRejectType?: string;
  };
}

@Injectable()
export class SumsubAdapter {
  private readonly logger = new Logger(SumsubAdapter.name);
  private readonly appToken: string | undefined;
  private readonly secretKey: string | undefined;
  private readonly levelName: string;
  private readonly webhookSecret: string | undefined;
  private readonly apiUrl = 'https://api.sumsub.com';

  constructor(private readonly config: ConfigService) {
    this.appToken = this.config.get<string>('SUMSUB_APP_TOKEN');
    this.secretKey = this.config.get<string>('SUMSUB_SECRET_KEY');
    this.levelName = this.config.get<string>('SUMSUB_LEVEL_NAME') || 'basic-kyc-level';
    this.webhookSecret = this.config.get<string>('SUMSUB_WEBHOOK_SECRET');
  }

  get isEnabled(): boolean {
    return !!(this.appToken && this.secretKey);
  }

  private sign(ts: number, method: string, path: string, body?: string): string {
    const data = `${ts}${method.toUpperCase()}${path}${body || ''}`;
    return createHmac('sha256', this.secretKey!).update(data).digest('hex');
  }

  private async fetch<T>(method: string, path: string, body?: object): Promise<T> {
    if (!this.appToken || !this.secretKey) {
      throw new Error('Sumsub credentials not configured');
    }

    const ts = Math.floor(Date.now() / 1000);
    const bodyStr = body ? JSON.stringify(body) : undefined;
    const signature = this.sign(ts, method, path, bodyStr);

    const res = await fetch(`${this.apiUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-App-Token': this.appToken,
        'X-App-Access-Ts': String(ts),
        'X-App-Access-Sig': signature,
      },
      body: bodyStr,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(`Sumsub API ${res.status} ${path}: ${text}`);
      throw new Error(`Sumsub API error: ${res.status}`);
    }

    return res.json();
  }

  /** Create an applicant and return their ID. */
  async createApplicant(externalUserId: string): Promise<string> {
    const result = await this.fetch<{ id: string }>('POST', '/resources/applicants', {
      externalUserId,
      levelName: this.levelName,
    });
    return result.id;
  }

  /** Get an access token for the WebSDK. */
  async getAccessToken(externalUserId: string): Promise<SumsubAccessToken> {
    const ts = Math.floor(Date.now() / 1000);
    const path = `/resources/accessTokens?userId=${externalUserId}&levelName=${this.levelName}`;
    const signature = this.sign(ts, 'POST', path);

    const res = await fetch(`${this.apiUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Token': this.appToken!,
        'X-App-Access-Ts': String(ts),
        'X-App-Access-Sig': signature,
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(`Sumsub accessToken ${res.status}: ${text}`);
      throw new Error(`Sumsub accessToken error: ${res.status}`);
    }

    const data = await res.json();
    return { token: data.token, userId: externalUserId };
  }

  /** Get applicant verification status. */
  async getApplicantStatus(applicantId: string): Promise<SumsubApplicantStatus> {
    return this.fetch<SumsubApplicantStatus>(
      'GET',
      `/resources/applicants/${applicantId}/requiredIdDocsStatus`
    );
  }

  /** Verify a webhook payload using HMAC-SHA256. Returns parsed body or null if invalid. */
  parseWebhookPayload(rawBody: string, signature: string): Record<string, unknown> | null {
    if (!this.webhookSecret) {
      this.logger.warn('Webhook secret not configured');
      return null;
    }

    const expected = createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
    if (expected !== signature) {
      this.logger.warn('Invalid webhook signature');
      return null;
    }

    return JSON.parse(rawBody);
  }
}
