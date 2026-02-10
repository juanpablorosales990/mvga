import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface BitrefillProduct {
  id: string;
  name: string;
  category: string;
  denominations: number[];
  currency: string;
  country: string;
}

export interface BitrefillOrderResponse {
  orderId: string;
  code: string | null;
  pin: string | null;
  status: 'SUCCESS' | 'PENDING' | 'FAILURE';
}

const MOCK_PRODUCTS: BitrefillProduct[] = [
  {
    id: 'amazon-us',
    name: 'Amazon US',
    category: 'shopping',
    denominations: [10, 25, 50, 100],
    currency: 'USD',
    country: 'US',
  },
  {
    id: 'netflix',
    name: 'Netflix',
    category: 'entertainment',
    denominations: [15, 30, 60],
    currency: 'USD',
    country: 'US',
  },
  {
    id: 'google-play',
    name: 'Google Play',
    category: 'entertainment',
    denominations: [10, 25, 50],
    currency: 'USD',
    country: 'US',
  },
  {
    id: 'spotify',
    name: 'Spotify',
    category: 'entertainment',
    denominations: [10, 30],
    currency: 'USD',
    country: 'US',
  },
  {
    id: 'steam',
    name: 'Steam',
    category: 'gaming',
    denominations: [20, 50],
    currency: 'USD',
    country: 'US',
  },
  {
    id: 'uber-eats',
    name: 'Uber Eats',
    category: 'food',
    denominations: [15, 25],
    currency: 'USD',
    country: 'US',
  },
  {
    id: 'playstation',
    name: 'PlayStation Store',
    category: 'gaming',
    denominations: [10, 25, 50],
    currency: 'USD',
    country: 'US',
  },
  {
    id: 'xbox',
    name: 'Xbox',
    category: 'gaming',
    denominations: [15, 25],
    currency: 'USD',
    country: 'US',
  },
];

@Injectable()
export class BitrefillAdapter {
  private readonly logger = new Logger(BitrefillAdapter.name);
  private readonly apiKey: string | undefined;
  private readonly apiSecret: string | undefined;
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('BITREFILL_API_KEY');
    this.apiSecret = this.config.get<string>('BITREFILL_API_SECRET');
    const isSandbox = this.config.get<string>('BITREFILL_SANDBOX', 'true') !== 'false';
    this.baseUrl = isSandbox
      ? 'https://api-sandbox.bitrefill.com/v2'
      : 'https://api.bitrefill.com/v2';
  }

  get isEnabled(): boolean {
    return !!this.apiKey && !!this.apiSecret;
  }

  private getAuthHeader(): string {
    return 'Basic ' + Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64');
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    if (!this.isEnabled) {
      throw new BadRequestException('Bitrefill not configured');
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.getAuthHeader(),
        ...options?.headers,
      },
    });

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`Bitrefill ${options?.method || 'GET'} ${path} failed: ${err}`);
      throw new BadRequestException(`Bitrefill request failed: ${res.status}`);
    }

    return res.json();
  }

  async getProducts(category?: string): Promise<BitrefillProduct[]> {
    if (!this.isEnabled) {
      return category ? MOCK_PRODUCTS.filter((p) => p.category === category) : MOCK_PRODUCTS;
    }

    const path = category ? `/products?category=${encodeURIComponent(category)}` : '/products';
    return this.request<BitrefillProduct[]>(path);
  }

  async purchaseGiftCard(
    productId: string,
    amount: number,
    customId: string
  ): Promise<BitrefillOrderResponse> {
    if (!this.isEnabled) {
      this.logger.log(`[MOCK] Gift card purchase: ${productId} $${amount}`);
      const mockCode = `MOCK-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      return {
        orderId: `mock_${Date.now()}`,
        code: mockCode,
        pin: null,
        status: 'SUCCESS',
      };
    }

    return this.request<BitrefillOrderResponse>('/orders', {
      method: 'POST',
      body: JSON.stringify({
        product_id: productId,
        amount,
        custom_id: customId,
      }),
    });
  }

  async getOrderStatus(orderId: string): Promise<BitrefillOrderResponse> {
    if (!this.isEnabled) {
      return {
        orderId,
        code: 'MOCK-XXXX-XXXX',
        pin: null,
        status: 'SUCCESS',
      };
    }

    return this.request<BitrefillOrderResponse>(`/orders/${encodeURIComponent(orderId)}`);
  }
}
