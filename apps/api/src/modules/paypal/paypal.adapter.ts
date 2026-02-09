import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PayPalOrder {
  id: string;
  status: string;
  links: Array<{ href: string; rel: string; method: string }>;
}

export interface PayPalCapture {
  id: string;
  status: string;
  purchase_units: Array<{
    payments: {
      captures: Array<{
        id: string;
        status: string;
        amount: { currency_code: string; value: string };
      }>;
    };
  }>;
}

@Injectable()
export class PayPalAdapter {
  private readonly logger = new Logger(PayPalAdapter.name);
  private readonly clientId: string | undefined;
  private readonly clientSecret: string | undefined;
  private readonly isSandbox: boolean;
  private readonly baseUrl: string;
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(private readonly config: ConfigService) {
    this.clientId = this.config.get<string>('PAYPAL_CLIENT_ID');
    this.clientSecret = this.config.get<string>('PAYPAL_CLIENT_SECRET');
    this.isSandbox = this.config.get<string>('PAYPAL_SANDBOX', 'true') !== 'false';
    this.baseUrl = this.isSandbox ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
  }

  get isEnabled(): boolean {
    return !!this.clientId && !!this.clientSecret;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    if (!this.clientId || !this.clientSecret) {
      throw new Error('PayPal credentials not configured');
    }

    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const res = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.logger.error(`PayPal OAuth failed ${res.status}: ${body}`);
      throw new Error('PayPal authentication failed');
    }

    const data = await res.json();
    this.accessToken = data.access_token;
    // Expire 5 min early for safety
    this.tokenExpiresAt = Date.now() + (data.expires_in - 300) * 1000;
    return this.accessToken!;
  }

  private async fetch<T>(path: string, options?: RequestInit): Promise<T> {
    const token = await this.getAccessToken();
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options?.headers,
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.logger.error(`PayPal API ${res.status} ${path}: ${body}`);
      throw new Error(`PayPal API error: ${res.status}`);
    }

    return res.json();
  }

  async createOrder(amountUsd: string, description?: string): Promise<PayPalOrder> {
    if (!this.isEnabled) {
      return {
        id: `MOCK_${Date.now()}`,
        status: 'CREATED',
        links: [{ href: '#', rel: 'approve', method: 'GET' }],
      };
    }

    return this.fetch<PayPalOrder>('/v2/checkout/orders', {
      method: 'POST',
      headers: {
        'PayPal-Request-Id': `mvga-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: { currency_code: 'USD', value: amountUsd },
            description: description || 'MVGA Payment',
          },
        ],
      }),
    });
  }

  async captureOrder(orderId: string): Promise<PayPalCapture> {
    if (!this.isEnabled) {
      return {
        id: orderId,
        status: 'COMPLETED',
        purchase_units: [
          {
            payments: {
              captures: [
                {
                  id: `MOCK_CAP_${Date.now()}`,
                  status: 'COMPLETED',
                  amount: { currency_code: 'USD', value: '0.00' },
                },
              ],
            },
          },
        ],
      };
    }

    return this.fetch<PayPalCapture>(`/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
    });
  }

  async getOrder(orderId: string): Promise<PayPalOrder> {
    if (!this.isEnabled) {
      return { id: orderId, status: 'CREATED', links: [] };
    }

    return this.fetch<PayPalOrder>(`/v2/checkout/orders/${orderId}`);
  }

  verifyWebhookSignature(
    headers: Record<string, string>,
    body: string,
    webhookId: string
  ): Promise<boolean> {
    if (!this.isEnabled) return Promise.resolve(true);

    return this.fetch<{ verification_status: string }>(
      '/v1/notifications/verify-webhook-signature',
      {
        method: 'POST',
        body: JSON.stringify({
          auth_algo: headers['paypal-auth-algo'],
          cert_url: headers['paypal-cert-url'],
          transmission_id: headers['paypal-transmission-id'],
          transmission_sig: headers['paypal-transmission-sig'],
          transmission_time: headers['paypal-transmission-time'],
          webhook_id: webhookId,
          webhook_event: JSON.parse(body),
        }),
      }
    ).then((r) => r.verification_status === 'SUCCESS');
  }
}
