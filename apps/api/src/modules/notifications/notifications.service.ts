import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma.service';
import * as webpush from 'web-push';

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

// Event payload types
interface P2PTradeEvent {
  tradeId: string;
  buyerWallet: string;
  sellerWallet: string;
  amount?: number;
  token?: string;
  reason?: string;
}

interface StakingEvent {
  walletAddress: string;
  amount: number;
}

interface ReferralEvent {
  walletAddress: string;
  amount: number;
}

interface PaymentRequestEvent {
  requestId: string;
  requesterWallet: string;
  requesterUsername?: string | null;
  requesteeAddress: string;
  amount: number;
  token: string;
  note?: string | null;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private vapidConfigured = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');
    const subject = this.config.get<string>('VAPID_SUBJECT') || 'mailto:push@mvga.io';

    if (publicKey && privateKey) {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      this.vapidConfigured = true;
      this.logger.log('VAPID keys configured');
    } else {
      this.logger.warn('VAPID keys not configured — push notifications disabled');
    }
  }

  async subscribe(params: {
    walletAddress: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    userAgent?: string;
  }) {
    return this.prisma.pushSubscription.upsert({
      where: { endpoint: params.endpoint },
      update: {
        walletAddress: params.walletAddress,
        p256dh: params.p256dh,
        auth: params.auth,
        userAgent: params.userAgent,
      },
      create: {
        walletAddress: params.walletAddress,
        endpoint: params.endpoint,
        p256dh: params.p256dh,
        auth: params.auth,
        userAgent: params.userAgent,
      },
    });
  }

  async unsubscribe(endpoint: string, walletAddress: string) {
    return this.prisma.pushSubscription.deleteMany({
      where: { endpoint, walletAddress },
    });
  }

  async getPreferences(walletAddress: string) {
    return this.prisma.notificationPreference.upsert({
      where: { walletAddress },
      update: {},
      create: { walletAddress },
    });
  }

  async updatePreferences(
    walletAddress: string,
    prefs: {
      p2pTrades?: boolean;
      staking?: boolean;
      referrals?: boolean;
      grants?: boolean;
      payments?: boolean;
    }
  ) {
    return this.prisma.notificationPreference.upsert({
      where: { walletAddress },
      update: prefs,
      create: { walletAddress, ...prefs },
    });
  }

  async sendToWallet(walletAddress: string, payload: PushPayload) {
    if (!this.vapidConfigured) return;

    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { walletAddress },
    });

    if (subscriptions.length === 0) return;

    const body = JSON.stringify(payload);
    const staleEndpoints: string[] = [];

    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            body
          );
        } catch (err: unknown) {
          const statusCode = (err as { statusCode?: number }).statusCode;
          if (statusCode === 410 || statusCode === 404) {
            staleEndpoints.push(sub.endpoint);
          } else {
            this.logger.warn(`Push failed for ${sub.endpoint}: ${err}`);
          }
        }
      })
    );

    // Clean up expired subscriptions
    if (staleEndpoints.length > 0) {
      await this.prisma.pushSubscription.deleteMany({
        where: { endpoint: { in: staleEndpoints } },
      });
      this.logger.log(`Cleaned ${staleEndpoints.length} stale push subscriptions`);
    }
  }

  // ── P2P Trade Events ────────────────────────────────────────────────

  @OnEvent('p2p.escrow.locked')
  async onEscrowLocked(event: P2PTradeEvent) {
    await this.notifyIfEnabled(event.sellerWallet, 'p2pTrades', {
      title: 'Fondos en custodia',
      body: `Un comprador bloqueó ${event.amount} ${event.token} en custodia`,
      url: '/p2p',
      tag: `p2p-${event.tradeId}`,
    });
  }

  @OnEvent('p2p.payment.marked')
  async onPaymentMarked(event: P2PTradeEvent) {
    await this.notifyIfEnabled(event.sellerWallet, 'p2pTrades', {
      title: 'Pago marcado',
      body: 'El comprador marcó el pago como enviado. Verifica y confirma.',
      url: '/p2p',
      tag: `p2p-${event.tradeId}`,
    });
  }

  @OnEvent('p2p.funds.released')
  async onFundsReleased(event: P2PTradeEvent) {
    await this.notifyIfEnabled(event.buyerWallet, 'p2pTrades', {
      title: 'Fondos liberados',
      body: `Recibiste ${event.amount} ${event.token}`,
      url: '/p2p',
      tag: `p2p-${event.tradeId}`,
    });
  }

  @OnEvent('p2p.trade.disputed')
  async onTradeDisputed(event: P2PTradeEvent) {
    // Notify both parties
    const payload: PushPayload = {
      title: 'Disputa abierta',
      body: `Se abrió una disputa: ${event.reason ?? 'Sin razón especificada'}`,
      url: '/p2p',
      tag: `p2p-${event.tradeId}`,
    };
    await Promise.all([
      this.notifyIfEnabled(event.buyerWallet, 'p2pTrades', payload),
      this.notifyIfEnabled(event.sellerWallet, 'p2pTrades', payload),
    ]);
  }

  @OnEvent('p2p.trade.cancelled')
  async onTradeCancelled(event: P2PTradeEvent) {
    // Notify the other party
    await Promise.all([
      this.notifyIfEnabled(event.buyerWallet, 'p2pTrades', {
        title: 'Trade cancelado',
        body: 'El trade P2P fue cancelado',
        url: '/p2p',
        tag: `p2p-${event.tradeId}`,
      }),
      this.notifyIfEnabled(event.sellerWallet, 'p2pTrades', {
        title: 'Trade cancelado',
        body: 'El trade P2P fue cancelado',
        url: '/p2p',
        tag: `p2p-${event.tradeId}`,
      }),
    ]);
  }

  // ── Staking Events ──────────────────────────────────────────────────

  @OnEvent('staking.rewards.ready')
  async onRewardsReady(event: StakingEvent) {
    await this.notifyIfEnabled(event.walletAddress, 'staking', {
      title: 'Recompensas disponibles',
      body: `Tienes ${event.amount} MVGA en recompensas listas para reclamar`,
      url: '/stake',
      tag: 'staking-rewards',
    });
  }

  @OnEvent('staking.unstake.complete')
  async onUnstakeComplete(event: StakingEvent) {
    await this.notifyIfEnabled(event.walletAddress, 'staking', {
      title: 'Unstake completado',
      body: `${event.amount} MVGA desbloqueados y disponibles`,
      url: '/stake',
      tag: 'staking-unstake',
    });
  }

  // ── Referral Events ─────────────────────────────────────────────────

  @OnEvent('referral.bonus.paid')
  async onReferralBonus(event: ReferralEvent) {
    await this.notifyIfEnabled(event.walletAddress, 'referrals', {
      title: 'Bono de referido',
      body: `Recibiste ${event.amount} MVGA por tu referido`,
      url: '/more',
      tag: 'referral-bonus',
    });
  }

  // ── Payment Request Events (Phase 2) ────────────────────────────────

  @OnEvent('payment.request.received')
  async onPaymentRequestReceived(event: PaymentRequestEvent) {
    const from = event.requesterUsername
      ? `@${event.requesterUsername}`
      : event.requesterWallet.slice(0, 8);
    const noteText = event.note ? ` — ${event.note}` : '';
    await this.notifyIfEnabled(event.requesteeAddress, 'payments', {
      title: 'Solicitud de pago',
      body: `${from} te solicita $${event.amount.toFixed(2)} ${event.token}${noteText}`,
      url: '/requests',
      tag: `request-${event.requestId}`,
    });
  }

  @OnEvent('payment.request.paid')
  async onPaymentRequestPaid(event: PaymentRequestEvent) {
    await this.notifyIfEnabled(event.requesterWallet, 'payments', {
      title: 'Solicitud pagada',
      body: `Tu solicitud de $${event.amount.toFixed(2)} ${event.token} fue pagada`,
      url: '/requests',
      tag: `request-${event.requestId}`,
    });
  }

  @OnEvent('payment.request.declined')
  async onPaymentRequestDeclined(event: PaymentRequestEvent) {
    await this.notifyIfEnabled(event.requesterWallet, 'payments', {
      title: 'Solicitud rechazada',
      body: `Tu solicitud de $${event.amount.toFixed(2)} ${event.token} fue rechazada`,
      url: '/requests',
      tag: `request-${event.requestId}`,
    });
  }

  @OnEvent('payment.received')
  async onPaymentReceived(event: {
    recipientAddress: string;
    senderUsername?: string;
    amount: number;
    token: string;
  }) {
    const from = event.senderUsername ? `@${event.senderUsername}` : 'alguien';
    await this.notifyIfEnabled(event.recipientAddress, 'payments', {
      title: 'Pago recibido',
      body: `Recibiste $${event.amount.toFixed(2)} ${event.token} de ${from}`,
      url: '/',
      tag: 'payment-received',
    });
  }

  // ── Split Payment Events (Phase 3) ─────────────────────────────────

  @OnEvent('split.request.created')
  async onSplitRequestCreated(event: {
    splitId: string;
    requestId: string;
    creatorWallet: string;
    creatorUsername: string | null;
    requesteeAddress: string;
    amount: number;
    token: string;
    description: string;
    totalAmount: number;
  }) {
    const from = event.creatorUsername
      ? `@${event.creatorUsername}`
      : event.creatorWallet.slice(0, 8);
    await this.notifyIfEnabled(event.requesteeAddress, 'payments', {
      title: 'Split de pago',
      body: `${from} dividió "${event.description}" ($${event.totalAmount.toFixed(2)}) — tu parte: $${event.amount.toFixed(2)} ${event.token}`,
      url: '/requests',
      tag: `split-${event.splitId}`,
    });
  }

  @OnEvent('split.completed')
  async onSplitCompleted(event: {
    splitId: string;
    creatorWallet: string;
    totalAmount: number;
    token: string;
    description: string;
  }) {
    await this.notifyIfEnabled(event.creatorWallet, 'payments', {
      title: 'Split completado',
      body: `"${event.description}" — todos pagaron. Recibiste $${event.totalAmount.toFixed(2)} ${event.token}`,
      url: `/split/${event.splitId}`,
      tag: `split-complete-${event.splitId}`,
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  private async notifyIfEnabled(
    walletAddress: string,
    category: 'p2pTrades' | 'staking' | 'referrals' | 'grants' | 'payments',
    payload: PushPayload
  ) {
    try {
      const prefs = await this.prisma.notificationPreference.findUnique({
        where: { walletAddress },
      });
      // Default to enabled if no preferences exist
      if (prefs && !prefs[category]) return;
      await this.sendToWallet(walletAddress, payload);
    } catch (err) {
      this.logger.error(`Failed to send ${category} notification to ${walletAddress}: ${err}`);
    }
  }
}
