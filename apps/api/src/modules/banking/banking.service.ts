import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CardAppStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { RainAdapter, KycData, RainTransaction } from './rain.adapter';

@Injectable()
export class BankingService {
  private readonly logger = new Logger(BankingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rain: RainAdapter
  ) {}

  // ─── Card Waitlist (existing) ──────────────────────────────────────

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
    if (!this.rain.isEnabled) {
      if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException('Banking service not configured');
      }
      // Mock mode — simulate approval (dev only)
      const app = await this.prisma.cardApplication.create({
        data: { walletAddress, status: 'KYC_APPROVED' },
      });
      return { status: app.status, applicationId: app.id };
    }

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

    // If pending and Rain is enabled, poll for updates
    if (app.rainUserId && app.status === 'KYC_PENDING' && this.rain.isEnabled) {
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
    if (app.rainCardId) return { cardId: app.rainCardId, status: 'CARD_ISSUED' };

    if (!this.rain.isEnabled || !app.rainUserId) {
      if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException('Card issuance not configured');
      }
      await this.prisma.cardApplication.update({
        where: { id: app.id },
        data: { status: 'CARD_ISSUED', rainCardId: 'mock_card_001' },
      });
      return { cardId: 'mock_card_001', status: 'CARD_ISSUED' };
    }

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

  // ─── Card Operations ───────────────────────────────────────────────

  async getCard(walletAddress: string) {
    const app = await this.prisma.cardApplication.findFirst({
      where: { walletAddress, status: { in: ['CARD_ISSUED', 'FROZEN'] } },
    });
    if (!app?.rainUserId || !this.rain.isEnabled) return null;
    return this.rain.getCard(app.rainUserId);
  }

  async getCardBalance(walletAddress: string) {
    const app = await this.prisma.cardApplication.findFirst({
      where: { walletAddress, status: { in: ['CARD_ISSUED', 'FROZEN'] } },
    });
    if (!app?.rainUserId || !this.rain.isEnabled) {
      return { available: 0, pending: 0 };
    }
    const balance = await this.rain.getBalance(app.rainUserId);
    return { available: balance.spendingPower / 100, pending: balance.balanceDue / 100 };
  }

  async getCardTransactions(walletAddress: string, limit = 20) {
    const app = await this.prisma.cardApplication.findFirst({
      where: { walletAddress, status: { in: ['CARD_ISSUED', 'FROZEN'] } },
    });
    if (!app?.rainUserId || !this.rain.isEnabled) {
      return [];
    }

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
    if (lower === 'declined' || lower === 'reversed' || lower === 'failed') return 'declined';
    return 'pending';
  }

  async freezeCard(walletAddress: string) {
    const app = await this.prisma.cardApplication.findFirst({
      where: { walletAddress, status: 'CARD_ISSUED' },
    });
    if (!app?.rainCardId) throw new NotFoundException('No active card found');

    if (this.rain.isEnabled) await this.rain.freezeCard(app.rainCardId);

    await this.prisma.cardApplication.update({
      where: { id: app.id },
      data: { status: 'FROZEN' },
    });
    return { status: 'FROZEN' };
  }

  async unfreezeCard(walletAddress: string) {
    const app = await this.prisma.cardApplication.findFirst({
      where: { walletAddress, status: 'FROZEN' },
    });
    if (!app?.rainCardId) throw new NotFoundException('No frozen card found');

    if (this.rain.isEnabled) await this.rain.unfreezeCard(app.rainCardId);

    await this.prisma.cardApplication.update({
      where: { id: app.id },
      data: { status: 'CARD_ISSUED' },
    });
    return { status: 'CARD_ISSUED' };
  }

  async getFundingAddress(walletAddress: string) {
    const app = await this.prisma.cardApplication.findFirst({
      where: { walletAddress, status: { in: ['CARD_ISSUED', 'FROZEN'] } },
    });
    if (!app) throw new NotFoundException('No card found');

    if (app.depositAddr) {
      return { depositAddress: app.depositAddr, chainId: app.chainId };
    }

    if (!app.rainUserId || !this.rain.isEnabled) return { depositAddress: null };

    const contracts = await this.rain.getContracts(app.rainUserId);
    if (contracts.length > 0) {
      await this.prisma.cardApplication.update({
        where: { id: app.id },
        data: { depositAddr: contracts[0].depositAddress, chainId: contracts[0].chainId },
      });
      return { depositAddress: contracts[0].depositAddress, chainId: contracts[0].chainId };
    }

    return { depositAddress: null };
  }
}
