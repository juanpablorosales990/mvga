import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CardAppStatus, CardProvider } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { LithicAdapter } from './lithic.adapter';

/** Map Prisma CardAppStatus → wallet-expected lowercase string. */
function walletStatus(prismaStatus: string): string {
  const map: Record<string, string> = {
    WAITLISTED: 'waitlisted',
    KYC_PENDING: 'kyc_pending',
    KYC_APPROVED: 'kyc_approved',
    CARD_ISSUED: 'active',
    FROZEN: 'frozen',
  };
  return map[prismaStatus] || prismaStatus.toLowerCase();
}

@Injectable()
export class BankingService {
  private readonly logger = new Logger(BankingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly lithic: LithicAdapter
  ) {}

  /** Lithic preferred > none (mock in dev, throw in prod). */
  private get cardProvider(): 'lithic' | 'none' {
    if (this.lithic.isEnabled) return 'lithic';
    return 'none';
  }

  // ─── Card Waitlist ──────────────────────────────────────────────────

  async joinCardWaitlist(walletAddress: string, email?: string) {
    const existing = await this.prisma.cardWaitlist.findFirst({
      where: { walletAddress },
    });
    if (existing) {
      return { waitlisted: true, alreadyJoined: true };
    }
    await this.prisma.cardWaitlist.create({
      data: { walletAddress, email },
    });
    return { waitlisted: true, alreadyJoined: false };
  }

  async getWaitlistStatus(walletAddress: string) {
    const entry = await this.prisma.cardWaitlist.findFirst({
      where: { walletAddress },
    });
    return { waitlisted: !!entry };
  }

  // ─── KYC ───────────────────────────────────────────────────────────

  async submitKyc(
    walletAddress: string,
    data: {
      firstName: string;
      lastName: string;
      email?: string;
      birthDate?: string;
      nationalId?: string;
      countryOfIssue?: string;
      address?: {
        line1: string;
        city: string;
        region: string;
        postalCode: string;
        countryCode: string;
      };
    }
  ) {
    if (this.cardProvider === 'none') {
      if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException('Banking service not configured');
      }
      const app = await this.prisma.cardApplication.create({
        data: { walletAddress, provider: 'NONE' as CardProvider, status: 'KYC_APPROVED' },
      });
      return { status: walletStatus(app.status), applicationId: app.id };
    }

    try {
      this.logger.log(`Lithic submitKyc for wallet ${walletAddress}`);
      const result = await this.lithic.submitKyc({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        walletAddress,
        birthDate: data.birthDate,
        governmentId: data.nationalId,
        address: data.address,
      });
      const status: CardAppStatus = result.status === 'ACCEPTED' ? 'KYC_APPROVED' : 'KYC_PENDING';

      const app = await this.prisma.cardApplication.create({
        data: {
          walletAddress,
          provider: 'LITHIC' as CardProvider,
          lithicAccountHolderToken: result.token,
          lithicAccountToken: result.accountToken,
          status,
        },
      });
      this.logger.log(`Card application created: ${app.id}`);

      return {
        status: walletStatus(app.status),
        applicationId: app.id,
        lithicAccountToken: result.accountToken,
      };
    } catch (err) {
      this.logger.error(`Lithic card flow failed: ${err?.message || err}`, err?.stack);
      throw err;
    }
  }

  async getKycStatus(walletAddress: string) {
    const app = await this.prisma.cardApplication.findFirst({
      where: { walletAddress },
      orderBy: { createdAt: 'desc' },
    });

    if (!app) return { status: 'none' };

    // Poll Lithic if pending
    if (
      app.provider === 'LITHIC' &&
      app.lithicAccountHolderToken &&
      app.status === 'KYC_PENDING' &&
      this.lithic.isEnabled
    ) {
      try {
        const lithicStatus = await this.lithic.getUserStatus(app.lithicAccountHolderToken);
        const newStatus: CardAppStatus =
          lithicStatus.status === 'ACCEPTED'
            ? 'KYC_APPROVED'
            : lithicStatus.status === 'REJECTED'
              ? 'KYC_REJECTED'
              : 'KYC_PENDING';

        if (newStatus !== app.status) {
          await this.prisma.cardApplication.update({
            where: { id: app.id },
            data: { status: newStatus },
          });
          return { status: walletStatus(newStatus) };
        }
      } catch (err) {
        this.logger.warn(`Failed to poll Lithic KYC status: ${err}`);
      }
    }

    return { status: walletStatus(app.status) };
  }

  // ─── Card Issuance ─────────────────────────────────────────────────

  async issueCard(walletAddress: string) {
    const app = await this.prisma.cardApplication.findFirst({
      where: { walletAddress, status: 'KYC_APPROVED' },
      orderBy: { createdAt: 'desc' },
    });

    if (!app) throw new BadRequestException('KYC must be approved before issuing a card');

    // Already issued
    if (app.lithicCardToken) return { cardId: app.lithicCardToken, status: 'active' };

    // Lithic path
    if (app.provider === 'LITHIC' && app.lithicAccountToken && this.lithic.isEnabled) {
      const card = await this.lithic.issueCard(app.lithicAccountToken);

      // Fetch financial account token for balance queries
      let financialAccountToken: string | null = null;
      try {
        financialAccountToken = await this.lithic.getFinancialAccountToken(app.lithicAccountToken);
      } catch (err) {
        this.logger.warn(`Failed to fetch Lithic financial account: ${err}`);
      }

      await this.prisma.cardApplication.update({
        where: { id: app.id },
        data: {
          status: 'CARD_ISSUED',
          lithicCardToken: card.token,
          ...(financialAccountToken ? { lithicFinancialAccountToken: financialAccountToken } : {}),
        },
      });

      return { cardId: card.token, last4: card.last4, status: 'active' };
    }

    // Mock path
    if (process.env.NODE_ENV === 'production') {
      throw new ServiceUnavailableException('Card issuance not configured');
    }
    await this.prisma.cardApplication.update({
      where: { id: app.id },
      data: { status: 'CARD_ISSUED' },
    });
    return { cardId: 'mock_card_001', status: 'active' };
  }

  // ─── Card Operations ───────────────────────────────────────────────

  async getCard(walletAddress: string) {
    const app = await this.prisma.cardApplication.findFirst({
      where: { walletAddress, status: { in: ['CARD_ISSUED', 'FROZEN'] } },
    });
    if (!app) return null;

    if (app.provider === 'LITHIC' && app.lithicAccountToken && this.lithic.isEnabled) {
      const card = await this.lithic.getCard(app.lithicAccountToken);
      if (!card) return null;
      return {
        id: card.token,
        type: card.type.toLowerCase() as 'virtual' | 'physical',
        status: card.state === 'PAUSED' ? 'frozen' : card.state === 'OPEN' ? 'active' : card.state,
        last4: card.last4,
        expirationMonth: card.expMonth,
        expirationYear: card.expYear,
        limit: { frequency: 'allTime', amount: 10000 },
        displayName: 'MVGA Card',
      };
    }

    return null;
  }

  async getCardBalance(walletAddress: string) {
    const app = await this.prisma.cardApplication.findFirst({
      where: { walletAddress, status: { in: ['CARD_ISSUED', 'FROZEN'] } },
    });

    if (app?.provider === 'LITHIC' && this.lithic.isEnabled) {
      const token = app.lithicFinancialAccountToken || app.lithicAccountToken;
      if (token) {
        try {
          const balance = await this.lithic.getBalance(token);
          return { available: balance.availableAmount / 100, pending: balance.pendingAmount / 100 };
        } catch (err) {
          this.logger.warn(`Failed to fetch Lithic balance: ${err}`);
          return { available: 0, pending: 0 };
        }
      }
    }

    return { available: 0, pending: 0 };
  }

  async getCardTransactions(walletAddress: string, limit = 20) {
    const app = await this.prisma.cardApplication.findFirst({
      where: { walletAddress, status: { in: ['CARD_ISSUED', 'FROZEN'] } },
    });

    if (app?.provider === 'LITHIC' && app.lithicAccountToken && this.lithic.isEnabled) {
      const txs = await this.lithic.getTransactions(app.lithicAccountToken, limit);
      return txs.map((tx) => ({
        id: tx.token,
        merchantName: tx.merchantName || 'Unknown',
        merchantCategory: this.mapMerchantCategory(tx.merchantCategory),
        amount: tx.amount / 100,
        currency: tx.currency || 'USD',
        date: tx.created,
        status: this.mapTxStatus(tx.status),
      }));
    }

    return [];
  }

  private mapMerchantCategory(
    category?: string
  ): 'online' | 'restaurant' | 'transport' | 'entertainment' | 'grocery' | 'other' {
    if (!category) return 'other';
    const lower = category.toLowerCase();
    if (lower.includes('restaurant') || lower.includes('food')) return 'restaurant';
    if (lower.includes('transport') || lower.includes('travel')) return 'transport';
    if (lower.includes('entertainment') || lower.includes('media')) return 'entertainment';
    if (lower.includes('grocery') || lower.includes('supermarket')) return 'grocery';
    if (lower.includes('online') || lower.includes('ecommerce')) return 'online';
    return 'other';
  }

  private mapTxStatus(status: string): 'completed' | 'pending' | 'declined' {
    const lower = status.toLowerCase();
    if (lower === 'settled' || lower === 'completed' || lower === 'approved') return 'completed';
    if (
      lower === 'declined' ||
      lower === 'reversed' ||
      lower === 'failed' ||
      lower === 'voided' ||
      lower === 'expired'
    )
      return 'declined';
    return 'pending';
  }

  private async buildCardDetails(
    app: {
      lithicCardToken: string | null;
      lithicAccountToken: string | null;
      provider: CardProvider;
    },
    status: 'frozen' | 'active'
  ) {
    if (app.provider === 'LITHIC' && app.lithicAccountToken && this.lithic.isEnabled) {
      const card = await this.lithic.getCard(app.lithicAccountToken);
      if (card) {
        return {
          id: card.token,
          last4: card.last4,
          expirationMonth: card.expMonth,
          expirationYear: card.expYear,
          brand: 'visa' as const,
          status,
          cardholderName: 'MVGA USER',
          type: card.type.toLowerCase() as 'virtual' | 'physical',
        };
      }
    }

    return {
      id: app.lithicCardToken,
      last4: '****',
      expirationMonth: 0,
      expirationYear: 0,
      brand: 'visa' as const,
      status,
      cardholderName: 'MVGA USER',
      type: 'virtual' as const,
    };
  }

  async freezeCard(walletAddress: string) {
    const app = await this.prisma.cardApplication.findFirst({
      where: { walletAddress, status: 'CARD_ISSUED' },
    });
    if (!app?.lithicCardToken) throw new NotFoundException('No active card found');

    if (app.provider === 'LITHIC' && this.lithic.isEnabled) {
      await this.lithic.freezeCard(app.lithicCardToken);
    } else {
      throw new ServiceUnavailableException('Card service unavailable');
    }

    await this.prisma.cardApplication.update({
      where: { id: app.id },
      data: { status: 'FROZEN' },
    });

    return this.buildCardDetails(app, 'frozen');
  }

  async unfreezeCard(walletAddress: string) {
    const app = await this.prisma.cardApplication.findFirst({
      where: { walletAddress, status: 'FROZEN' },
    });
    if (!app?.lithicCardToken) throw new NotFoundException('No frozen card found');

    if (app.provider === 'LITHIC' && this.lithic.isEnabled) {
      await this.lithic.unfreezeCard(app.lithicCardToken);
    } else {
      throw new ServiceUnavailableException('Card service unavailable');
    }

    await this.prisma.cardApplication.update({
      where: { id: app.id },
      data: { status: 'CARD_ISSUED' },
    });

    return this.buildCardDetails(app, 'active');
  }

  async fundCard(walletAddress: string) {
    const app = await this.prisma.cardApplication.findFirst({
      where: { walletAddress, status: { in: ['CARD_ISSUED', 'FROZEN'] } },
    });
    if (!app) throw new NotFoundException('No card found');

    // Lithic: no on-chain collateral — return balance only
    let balance = { available: 0, pending: 0 };
    const token = app.lithicFinancialAccountToken || app.lithicAccountToken;
    if (token && this.lithic.isEnabled) {
      try {
        const b = await this.lithic.getBalance(token);
        balance = { available: b.availableAmount / 100, pending: b.pendingAmount / 100 };
      } catch (err) {
        this.logger.warn(`Failed to fetch Lithic balance: ${err}`);
      }
    }
    return { success: true, depositAddress: null, chainId: null, newBalance: balance };
  }

  // ─── Digital Wallet Provisioning ──────────────────────────────────

  async provisionCard(walletAddress: string, digitalWallet: 'APPLE_PAY' | 'GOOGLE_PAY') {
    const app = await this.prisma.cardApplication.findFirst({
      where: { walletAddress, status: { in: ['CARD_ISSUED', 'FROZEN'] } },
    });
    if (!app) throw new NotFoundException('No card found');

    if (app.provider !== 'LITHIC' || !app.lithicCardToken) {
      throw new BadRequestException('Digital wallet provisioning requires a Lithic-issued card');
    }
    if (!this.lithic.isEnabled) {
      throw new ServiceUnavailableException('Lithic service unavailable');
    }

    return this.lithic.webProvision(app.lithicCardToken, digitalWallet);
  }
}
