import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Lithic from 'lithic';

export interface LithicAccountHolder {
  token: string;
  accountToken: string;
  status: string;
}

export interface LithicCard {
  token: string;
  type: string;
  state: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

export interface LithicBalance {
  availableAmount: number;
  pendingAmount: number;
}

export interface LithicTransaction {
  token: string;
  cardToken: string;
  merchantName: string;
  merchantCategory: string;
  amount: number;
  currency: string;
  status: string;
  created: string;
}

@Injectable()
export class LithicAdapter {
  private readonly logger = new Logger(LithicAdapter.name);
  private readonly apiKey: string | undefined;
  private readonly environment: 'sandbox' | 'production';
  private client: Lithic | null = null;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('LITHIC_API_KEY');
    const env = this.config.get<string>('LITHIC_ENVIRONMENT') || 'sandbox';
    this.environment = env === 'production' ? 'production' : 'sandbox';

    if (this.apiKey) {
      this.client = new Lithic({
        apiKey: this.apiKey,
        environment: this.environment,
      });
    }
  }

  get isEnabled(): boolean {
    return !!this.apiKey && !!this.client;
  }

  private getClient(): Lithic {
    if (!this.client) throw new ServiceUnavailableException('Lithic API key not configured');
    return this.client;
  }

  /** Register user with Lithic using KYC_BYO (pre-verified via Persona/Sumsub). */
  async submitKyc(data: {
    firstName: string;
    lastName: string;
    email: string;
    walletAddress: string;
    birthDate: string;
    phoneNumber?: string;
    governmentId?: string;
    address: {
      line1: string;
      city: string;
      region: string;
      postalCode: string;
      countryCode: string;
    };
  }): Promise<LithicAccountHolder> {
    const client = this.getClient();
    const result = await client.accountHolders.create({
      workflow: 'KYC_BYO',
      individual: {
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email,
        dob: data.birthDate,
        government_id: data.governmentId || '000-00-0000',
        address: {
          address1: data.address.line1,
          city: data.address.city,
          state: data.address.region,
          postal_code: data.address.postalCode,
          country: data.address.countryCode,
        },
        phone_number: data.phoneNumber || '+10000000000',
      },
      tos_timestamp: new Date().toISOString(),
      kyc_passed_timestamp: new Date().toISOString(),
      external_id: data.walletAddress,
    });
    return {
      token: result.token ?? '',
      accountToken: result.account_token ?? '',
      status: result.status ?? 'PENDING',
    };
  }

  /** Get account holder status. */
  async getUserStatus(accountHolderToken: string): Promise<LithicAccountHolder> {
    const client = this.getClient();
    const result = await client.accountHolders.retrieve(accountHolderToken);
    return {
      token: result.token ?? '',
      accountToken: result.account_token ?? '',
      status: result.status ?? 'PENDING',
    };
  }

  /** Issue a virtual Visa card. */
  async issueCard(accountToken: string): Promise<LithicCard> {
    const client = this.getClient();
    const card = await client.cards.create({
      type: 'VIRTUAL',
      account_token: accountToken,
      spend_limit: 1000000,
      spend_limit_duration: 'FOREVER',
    });
    return {
      token: card.token ?? '',
      type: card.type ?? 'VIRTUAL',
      state: card.state ?? 'OPEN',
      last4: card.last_four ?? '****',
      expMonth:
        typeof card.exp_month === 'string' ? parseInt(card.exp_month, 10) : (card.exp_month ?? 0),
      expYear:
        typeof card.exp_year === 'string' ? parseInt(card.exp_year, 10) : (card.exp_year ?? 0),
    };
  }

  /** Get first card for an account. */
  async getCard(accountToken: string): Promise<LithicCard | null> {
    const client = this.getClient();
    const page = await client.cards.list({ account_token: accountToken, page_size: 1 });
    const cards = page.data;
    if (!cards || cards.length === 0) return null;
    const c = cards[0];
    return {
      token: c.token ?? '',
      type: c.type ?? 'VIRTUAL',
      state: c.state ?? 'OPEN',
      last4: c.last_four ?? '****',
      expMonth: typeof c.exp_month === 'string' ? parseInt(c.exp_month, 10) : (c.exp_month ?? 0),
      expYear: typeof c.exp_year === 'string' ? parseInt(c.exp_year, 10) : (c.exp_year ?? 0),
    };
  }

  /** Get the ISSUING financial account token for a given account. */
  async getFinancialAccountToken(accountToken: string): Promise<string | null> {
    const client = this.getClient();
    const page = await client.financialAccounts.list({ account_token: accountToken });
    const accounts = page.data || [];
    const issuing = accounts.find((a) => a.type === 'ISSUING');
    return issuing?.token ?? null;
  }

  /** Get balance for a financial account. */
  async getBalance(financialAccountToken: string): Promise<LithicBalance> {
    const client = this.getClient();
    const page = await client.financialAccounts.balances.list(financialAccountToken);
    const balances = page.data;
    if (!balances || balances.length === 0) {
      return { availableAmount: 0, pendingAmount: 0 };
    }
    const b = balances[0];
    return {
      availableAmount: b.available_amount ?? 0,
      pendingAmount: b.pending_amount ?? 0,
    };
  }

  /** Freeze a card (PAUSED state). */
  async freezeCard(cardToken: string): Promise<void> {
    const client = this.getClient();
    await client.cards.update(cardToken, { state: 'PAUSED' });
  }

  /** Unfreeze a card (OPEN state). */
  async unfreezeCard(cardToken: string): Promise<void> {
    const client = this.getClient();
    await client.cards.update(cardToken, { state: 'OPEN' });
  }

  /** Get recent transactions for an account. */
  async getTransactions(accountToken: string, limit = 20): Promise<LithicTransaction[]> {
    const client = this.getClient();
    const page = await client.transactions.list({
      account_token: accountToken,
      page_size: limit,
    });
    return (page.data || []).map((tx) => ({
      token: tx.token ?? '',
      cardToken: tx.card_token ?? '',
      merchantName: tx.merchant?.descriptor || 'Unknown',
      merchantCategory: tx.merchant?.mcc || '',
      amount: tx.amount ?? 0,
      currency: tx.merchant?.currency || 'USD',
      status: tx.status ?? 'PENDING',
      created: tx.created ?? new Date().toISOString(),
    }));
  }
}
