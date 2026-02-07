import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Rain API types (matching wallet/src/services/cardService.types.ts)
export interface RainUserApplication {
  id: string;
  applicationStatus: string;
  email?: string;
  isActive?: boolean;
}

export interface RainCard {
  id: string;
  type: 'virtual' | 'physical';
  status: string;
  last4: string;
  expirationMonth: number;
  expirationYear: number;
  limit: { frequency: string; amount: number };
  displayName?: string;
}

export interface RainBalance {
  creditLimit: number;
  spendingPower: number;
  balanceDue: number;
}

export interface RainContract {
  id: string;
  chainId: number;
  depositAddress: string;
  tokens: Array<{ address: string; balance: string }>;
}

export interface KycData {
  firstName: string;
  lastName: string;
  email: string;
  walletAddress: string;
  birthDate: string;
  nationalId: string;
  countryOfIssue: string;
  address: {
    line1: string;
    city: string;
    region: string;
    postalCode: string;
    countryCode: string;
  };
}

@Injectable()
export class RainAdapter {
  private readonly logger = new Logger(RainAdapter.name);
  private readonly apiKey: string | undefined;
  private readonly apiUrl: string;
  private readonly chainId: number;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('RAIN_API_KEY');
    this.apiUrl = this.config.get<string>('RAIN_API_URL') || 'https://api-dev.raincards.xyz/v1';
    this.chainId = parseInt(this.config.get<string>('RAIN_CHAIN_ID') || '84532', 10);
  }

  get isEnabled(): boolean {
    return !!this.apiKey;
  }

  private async fetch<T>(path: string, options?: RequestInit): Promise<T> {
    if (!this.apiKey) {
      throw new Error('Rain API key not configured');
    }

    const res = await fetch(`${this.apiUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': this.apiKey,
        ...options?.headers,
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.logger.error(`Rain API ${res.status} ${path}: ${body}`);
      throw new Error(`Rain API error: ${res.status}`);
    }

    return res.json();
  }

  /** Submit KYC application to Rain. */
  async submitKyc(data: KycData): Promise<RainUserApplication> {
    return this.fetch<RainUserApplication>('/issuing/applications/user', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        isTermsOfServiceAccepted: true,
      }),
    });
  }

  /** Check user's KYC status. */
  async getUserStatus(userId: string): Promise<RainUserApplication> {
    return this.fetch<RainUserApplication>(`/issuing/applications/user/${userId}`);
  }

  /** Deploy collateral smart contract for card funding. */
  async deployContract(userId: string): Promise<RainContract> {
    return this.fetch<RainContract>(`/issuing/users/${userId}/contracts`, {
      method: 'POST',
      body: JSON.stringify({ chainId: this.chainId }),
    });
  }

  /** Issue a virtual Visa card. */
  async issueCard(userId: string): Promise<RainCard> {
    return this.fetch<RainCard>(`/issuing/users/${userId}/cards`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'virtual',
        limit: { frequency: 'allTime', amount: 10000 },
        displayName: 'MVGA Card',
        status: 'active',
      }),
    });
  }

  /** Get card details for a user. */
  async getCard(userId: string): Promise<RainCard | null> {
    const cards = await this.fetch<RainCard[]>(`/issuing/cards?userId=${userId}&limit=1`);
    return cards.length > 0 ? cards[0] : null;
  }

  /** Get card balance. */
  async getBalance(userId: string): Promise<RainBalance> {
    return this.fetch<RainBalance>(`/issuing/users/${userId}/balances`);
  }

  /** Freeze a card. */
  async freezeCard(cardId: string): Promise<void> {
    await this.fetch(`/issuing/cards/${cardId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'frozen' }),
    });
  }

  /** Unfreeze a card. */
  async unfreezeCard(cardId: string): Promise<void> {
    await this.fetch(`/issuing/cards/${cardId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'active' }),
    });
  }

  /** Get collateral contracts for a user. */
  async getContracts(userId: string): Promise<RainContract[]> {
    return this.fetch<RainContract[]>(`/issuing/users/${userId}/contracts`);
  }
}
