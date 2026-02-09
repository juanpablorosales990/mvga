import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CardAppStatus, CardProvider } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { RainAdapter, KycData, RainTransaction } from './rain.adapter';
import { LithicAdapter } from './lithic.adapter';

@Injectable()
export class BankingService {
  private readonly logger = new Logger(BankingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rain: RainAdapter,
    private readonly lithic: LithicAdapter
  ) {}

  /** Lithic preferred > Rain fallback > none (mock in dev, throw in prod). */
  private get cardProvider(): 'lithic' | 'rain' | 'none' {
    if (this.lithic.isEnabled) return 'lithic';
    if (this.rain.isEnabled) return 'rain';
    return 'none';
  }

  // ─── Card Waitlist (unchanged) ────────────────────────────────────

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

  async submitKyc(walletAddress: string, data: Omit<KycData, 'walletAddress'>) {
    if (this.cardProvider === 'none') {
      if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException('Banking service not configured');
      }
      const app = await this.prisma.cardApplication.create({
        data: { walletAddress, provider: 'NONE' as CardProvider, status: 'KYC_APPROVED' },
      });
      return { status: app.status, applicationId: app.id };
    }

    if (this.cardProvider === 'lithic') {
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

      return { status: app.status, applicationId: app.id, lithicAccountToken: result.accountToken };
    }

    // Rain path
    const result = await this.rain.submitKyc({ ...data, walletAddress });
    const statusMap: Record<string, string> = {
      approved: 'KYC_APPROVED',
      pending: 'KYC_PENDING',
      rejected: 'KYC_REJECTED',
    };
    const status = statusMap[result.applicationStatus] || 'KYC_PENDING';

    const app = await this.prisma.cardApplication.create({
      data: {
        walletAddress,
        provider: 'RAIN' as CardProvider,
        rainUserId: result.id,
        status: status as CardAppStatus,
      },
    });

    return { status: app.status, applicationId: app.id, rainUserId: result.id };
  }

  async getKycStatus(walletAddress: string) {
    const app = await this.prisma.cardApplication.findFirst({
      where: { walletAddress },
      orderBy: { createdAt: 'desc' },
    });

    if (!app) return { status: 'NONE' };

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
          return { status: newStatus };
        }
      } catch (err) {
        this.logger.warn(`Failed to poll Lithic KYC status: ${err}`);
      }
    }

    // Poll Rain if pending
    if (
      app.provider === 'RAIN' &&
      app.rainUserId &&
      app.status === 'KYC_PENDING' &&
      this.rain.isEnabled
    ) {
      try {
        const rainStatus = await this.rain.getUserStatus(app.rainUserId);
        const newStatus: CardAppStatus =
          rainStatus.applicationStatus === 'approved'
            ? 'KYC_APPROVED'
            : rainStatus.applicationStatus === 'rejected'
              ? 'KYC_REJECTED'
              : 'KYC_PENDING';

        if (newStatus !== app.status) {
          await this.prisma.cardApplication.update({
            where: { id: app.id },
            data: { status: newStatus },
          });
          return { status: newStatus };
        }
      } catch (err) {
        this.logger.warn(`Failed to poll Rain KYC status: ${err}`);
      }
    }

    return { status: app.status };
  }

  // ─── Card Issuance ─────────────────────────────────────────────────

  async issueCard(walletAddress: string) {
    const app = await this.prisma.cardApplication.findFirst({
      where: { walletAddress, status: 'KYC_APPROVED' },
      orderBy: { createdAt: 'desc' },
    });

    if (!app) throw new BadRequestException('KYC must be approved before issuing a card');

    // Already issued
    if (app.rainCardId) return { cardId: app.rainCardId, status: 'CARD_ISSUED' };
    if (app.lithicCardToken) return { cardId: app.lithicCardToken, status: 'CARD_ISSUED' };

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

      return { cardId: card.token, last4: card.last4, status: 'CARD_ISSUED' };
    }

    // Rain path
    if (app.provider === 'RAIN' && app.rainUserId && this.rain.isEnabled) {
      const contract = await this.rain.deployContract(app.rainUserId);
      const card = await this.rain.issueCard(app.rainUserId);

      await this.prisma.cardApplication.update({
        where: { id: app.id },
        data: {
          status: 'CARD_ISSUED',
          rainCardId: card.id,
          chainId: contract.chainId,
          depositAddr: contract.depositAddress,
        },
      });

      return {
        cardId: card.id,
        last4: card.last4,
        depositAddress: contract.depositAddress,
        status: 'CARD_ISSUED',
      };
    }

    // Mock path
    if (process.env.NODE_ENV === 'production') {
      throw new ServiceUnavailableException('Card issuance not configured');
    }
    await this.prisma.cardApplication.update({
      where: { id: app.id },
      data: { status: 'CARD_ISSUED', rainCardId: 'mock_card_001' },
    });
    return { cardId: 'mock_card_001', status: 'CARD_ISSUED' };
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

    if (app.rainUserId && this.rain.isEnabled) {
      return this.rain.getCard(app.rainUserId);
    }

    return null;
  }

  async getCardBalance(walletAddress: string) {
    const app = await this.prisma.cardApplication.findFirst({
      where: { walletAddress, status: { in: ['CARD_ISSUED', 'FROZEN'] } },
    });

    if (app?.provider === 'LITHIC' && app.lithicFinancialAccountToken && this.lithic.isEnabled) {
      try {
        const balance = await this.lithic.getBalance(app.lithicFinancialAccountToken);
        return { available: balance.availableAmount / 100, pending: balance.pendingAmount / 100 };
      } catch (err) {
        this.logger.warn(`Failed to fetch Lithic balance: ${err}`);
        return { available: 0, pending: 0 };
      }
    }

    if (app?.rainUserId && this.rain.isEnabled) {
      const balance = await this.rain.getBalance(app.rainUserId);
      return { available: balance.spendingPower / 100, pending: balance.balanceDue / 100 };
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

    if (app?.rainUserId && this.rain.isEnabled) {
      const txs = await this.rain.getTransactions(app.rainUserId, limit);
      return txs.map((tx: RainTransaction) => ({
        id: tx.id,
        merchantName: tx.merchantName || 'Unknown',
        merchantCategory: this.mapMerchantCategory(tx.merchantCategory),
        amount: tx.amount / 100,
        currency: tx.currency || 'USD',
        date: tx.createdAt,
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
      rainCardId: string | null;
      rainUserId: string | null;
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

    if (this.rain.isEnabled && app.rainUserId) {
      const card = await this.rain.getCard(app.rainUserId);
      if (card) {
        return {
          ...card,
          status,
          brand: 'visa' as const,
          cardholderName: 'MVGA USER',
          type: card.type,
          pan: undefined,
        };
      }
    }

    return {
      id: app.rainCardId || app.lithicCardToken,
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
    if (!app?.rainCardId && !app?.lithicCardToken)
      throw new NotFoundException('No active card found');

    if (app.provider === 'LITHIC' && app.lithicCardToken && this.lithic.isEnabled) {
      await this.lithic.freezeCard(app.lithicCardToken);
    } else if (app.provider === 'LITHIC' && app.lithicCardToken) {
      throw new ServiceUnavailableException('Lithic service unavailable');
    } else if (app.rainCardId && this.rain.isEnabled) {
      await this.rain.freezeCard(app.rainCardId);
    } else if (app.rainCardId) {
      throw new ServiceUnavailableException('Rain service unavailable');
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
    if (!app?.rainCardId && !app?.lithicCardToken)
      throw new NotFoundException('No frozen card found');

    if (app.provider === 'LITHIC' && app.lithicCardToken && this.lithic.isEnabled) {
      await this.lithic.unfreezeCard(app.lithicCardToken);
    } else if (app.provider === 'LITHIC' && app.lithicCardToken) {
      throw new ServiceUnavailableException('Lithic service unavailable');
    } else if (app.rainCardId && this.rain.isEnabled) {
      await this.rain.unfreezeCard(app.rainCardId);
    } else if (app.rainCardId) {
      throw new ServiceUnavailableException('Rain service unavailable');
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
    if (app.provider === 'LITHIC') {
      let balance = { available: 0, pending: 0 };
      if (app.lithicFinancialAccountToken && this.lithic.isEnabled) {
        try {
          const b = await this.lithic.getBalance(app.lithicFinancialAccountToken);
          balance = { available: b.availableAmount / 100, pending: b.pendingAmount / 100 };
        } catch (err) {
          this.logger.warn(`Failed to fetch Lithic balance: ${err}`);
        }
      }
      return { success: true, depositAddress: null, chainId: null, newBalance: balance };
    }

    // Rain: on-chain collateral contract
    let depositAddress = app.depositAddr;
    let chainId = app.chainId;

    if (!depositAddress && app.rainUserId && this.rain.isEnabled) {
      const contracts = await this.rain.getContracts(app.rainUserId);
      if (contracts.length > 0) {
        depositAddress = contracts[0].depositAddress;
        chainId = contracts[0].chainId;
        await this.prisma.cardApplication.update({
          where: { id: app.id },
          data: { depositAddr: depositAddress, chainId },
        });
      }
    }

    const balance =
      app.rainUserId && this.rain.isEnabled
        ? await this.rain.getBalance(app.rainUserId).catch((err) => {
            this.logger.warn(`Failed to fetch card balance for ${app.rainUserId}: ${err}`);
            return { spendingPower: 0, balanceDue: 0 };
          })
        : { spendingPower: 0, balanceDue: 0 };

    return {
      success: !!depositAddress,
      depositAddress: depositAddress || null,
      chainId: chainId || null,
      newBalance: {
        available: balance.spendingPower / 100,
        pending: balance.balanceDue / 100,
      },
    };
  }
}
