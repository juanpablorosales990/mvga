/* eslint-disable @typescript-eslint/no-explicit-any */
import { NotificationsService } from './notifications.service';

// Mock web-push before importing the service
jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

import * as webpush from 'web-push';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prismaService: any;
  let configService: any;

  beforeEach(() => {
    prismaService = {
      pushSubscription: {
        upsert: jest
          .fn()
          .mockResolvedValue({ id: 'sub-1', endpoint: 'https://push.example.com/1' }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      notificationPreference: {
        upsert: jest.fn().mockResolvedValue({
          walletAddress: 'wallet-1',
          p2pTrades: true,
          staking: true,
          referrals: true,
          grants: true,
        }),
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };

    configService = {
      get: jest.fn((key: string) => {
        const env: Record<string, string> = {
          VAPID_PUBLIC_KEY: 'test-public-key',
          VAPID_PRIVATE_KEY: 'test-private-key',
          VAPID_SUBJECT: 'mailto:test@test.com',
        };
        return env[key];
      }),
    };

    service = new NotificationsService(prismaService, configService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('subscribe', () => {
    it('upserts a push subscription', async () => {
      const params = {
        walletAddress: 'wallet-1',
        endpoint: 'https://push.example.com/1',
        p256dh: 'p256dh-key',
        auth: 'auth-secret',
        userAgent: 'Test/1.0',
      };

      await service.subscribe(params);

      expect(prismaService.pushSubscription.upsert).toHaveBeenCalledWith({
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
    });
  });

  describe('unsubscribe', () => {
    it('deletes subscriptions by endpoint and wallet', async () => {
      await service.unsubscribe('https://push.example.com/1', 'wallet-1');

      expect(prismaService.pushSubscription.deleteMany).toHaveBeenCalledWith({
        where: { endpoint: 'https://push.example.com/1', walletAddress: 'wallet-1' },
      });
    });
  });

  describe('getPreferences', () => {
    it('returns or creates default preferences', async () => {
      await service.getPreferences('wallet-1');

      expect(prismaService.notificationPreference.upsert).toHaveBeenCalledWith({
        where: { walletAddress: 'wallet-1' },
        update: {},
        create: { walletAddress: 'wallet-1' },
      });
    });
  });

  describe('updatePreferences', () => {
    it('updates specific preference fields', async () => {
      await service.updatePreferences('wallet-1', { p2pTrades: false });

      expect(prismaService.notificationPreference.upsert).toHaveBeenCalledWith({
        where: { walletAddress: 'wallet-1' },
        update: { p2pTrades: false },
        create: { walletAddress: 'wallet-1', p2pTrades: false },
      });
    });
  });

  describe('sendToWallet', () => {
    it('sends push to all subscriptions for a wallet', async () => {
      prismaService.pushSubscription.findMany.mockResolvedValue([
        { endpoint: 'https://push.example.com/1', p256dh: 'key-1', auth: 'auth-1' },
        { endpoint: 'https://push.example.com/2', p256dh: 'key-2', auth: 'auth-2' },
      ]);

      (webpush.sendNotification as jest.Mock).mockResolvedValue({});

      await service.sendToWallet('wallet-1', {
        title: 'Test',
        body: 'Test body',
      });

      expect(webpush.sendNotification).toHaveBeenCalledTimes(2);
    });

    it('cleans up stale subscriptions (HTTP 410)', async () => {
      prismaService.pushSubscription.findMany.mockResolvedValue([
        { endpoint: 'https://push.example.com/stale', p256dh: 'k', auth: 'a' },
      ]);

      (webpush.sendNotification as jest.Mock).mockRejectedValue({ statusCode: 410 });

      await service.sendToWallet('wallet-1', { title: 'Test', body: 'body' });

      expect(prismaService.pushSubscription.deleteMany).toHaveBeenCalledWith({
        where: { endpoint: { in: ['https://push.example.com/stale'] } },
      });
    });

    it('does nothing when wallet has no subscriptions', async () => {
      prismaService.pushSubscription.findMany.mockResolvedValue([]);

      await service.sendToWallet('wallet-1', { title: 'Test', body: 'body' });

      expect(webpush.sendNotification).not.toHaveBeenCalled();
    });
  });

  describe('event handlers', () => {
    it('onEscrowLocked sends notification to seller', async () => {
      prismaService.pushSubscription.findMany.mockResolvedValue([
        { endpoint: 'https://push.example.com/seller', p256dh: 'k', auth: 'a' },
      ]);
      (webpush.sendNotification as jest.Mock).mockResolvedValue({});

      await service.onEscrowLocked({
        tradeId: 'trade-1',
        buyerWallet: 'buyer-addr',
        sellerWallet: 'seller-addr',
        amount: 100,
        token: 'USDC',
      });

      expect(prismaService.pushSubscription.findMany).toHaveBeenCalledWith({
        where: { walletAddress: 'seller-addr' },
      });
      expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
      const payload = JSON.parse((webpush.sendNotification as jest.Mock).mock.calls[0][1]);
      expect(payload.title).toBe('Fondos en custodia');
    });

    it('respects disabled preferences', async () => {
      prismaService.notificationPreference.findUnique.mockResolvedValue({
        walletAddress: 'seller-addr',
        p2pTrades: false,
        staking: true,
        referrals: true,
        grants: true,
      });

      await service.onEscrowLocked({
        tradeId: 'trade-1',
        buyerWallet: 'buyer-addr',
        sellerWallet: 'seller-addr',
        amount: 100,
        token: 'USDC',
      });

      expect(webpush.sendNotification).not.toHaveBeenCalled();
    });

    it('onFundsReleased sends notification to buyer', async () => {
      prismaService.pushSubscription.findMany.mockResolvedValue([
        { endpoint: 'https://push.example.com/buyer', p256dh: 'k', auth: 'a' },
      ]);
      (webpush.sendNotification as jest.Mock).mockResolvedValue({});

      await service.onFundsReleased({
        tradeId: 'trade-1',
        buyerWallet: 'buyer-addr',
        sellerWallet: 'seller-addr',
        amount: 50,
        token: 'USDC',
      });

      expect(prismaService.pushSubscription.findMany).toHaveBeenCalledWith({
        where: { walletAddress: 'buyer-addr' },
      });
      const payload = JSON.parse((webpush.sendNotification as jest.Mock).mock.calls[0][1]);
      expect(payload.title).toBe('Fondos liberados');
    });

    it('onReferralBonus sends notification', async () => {
      prismaService.pushSubscription.findMany.mockResolvedValue([
        { endpoint: 'https://push.example.com/1', p256dh: 'k', auth: 'a' },
      ]);
      (webpush.sendNotification as jest.Mock).mockResolvedValue({});

      await service.onReferralBonus({ walletAddress: 'referrer-addr', amount: 100 });

      expect(prismaService.pushSubscription.findMany).toHaveBeenCalledWith({
        where: { walletAddress: 'referrer-addr' },
      });
      const payload = JSON.parse((webpush.sendNotification as jest.Mock).mock.calls[0][1]);
      expect(payload.title).toBe('Bono de referido');
    });
  });

  describe('VES onramp event handlers', () => {
    beforeEach(() => {
      prismaService.pushSubscription.findMany.mockResolvedValue([
        { endpoint: 'https://push.example.com/1', p256dh: 'k', auth: 'a' },
      ]);
      (webpush.sendNotification as jest.Mock).mockResolvedValue({});
    });

    it('onVesOrderCreated ON_RAMP → sends push to LP wallet', async () => {
      await service.onVesOrderCreated({
        orderId: 'order-1',
        buyerWallet: 'buyer-addr',
        lpWallet: 'lp-addr',
        amountUsdc: 50,
        direction: 'ON_RAMP',
      });

      expect(prismaService.pushSubscription.findMany).toHaveBeenCalledWith({
        where: { walletAddress: 'lp-addr' },
      });
      const payload = JSON.parse((webpush.sendNotification as jest.Mock).mock.calls[0][1]);
      expect(payload.title).toBe('Nueva orden VES');
      expect(payload.body).toContain('comprar 50 USDC');
    });

    it('onVesOrderCreated OFF_RAMP → correct message', async () => {
      await service.onVesOrderCreated({
        orderId: 'order-2',
        buyerWallet: 'buyer-addr',
        lpWallet: 'lp-addr',
        amountUsdc: 100,
        direction: 'OFF_RAMP',
      });

      const payload = JSON.parse((webpush.sendNotification as jest.Mock).mock.calls[0][1]);
      expect(payload.body).toContain('vender 100 USDC');
    });

    it('onVesEscrowLocked → sends push to buyer wallet', async () => {
      await service.onVesEscrowLocked({
        orderId: 'order-1',
        buyerWallet: 'buyer-addr',
        lpWallet: 'lp-addr',
        amountUsdc: 50,
      });

      expect(prismaService.pushSubscription.findMany).toHaveBeenCalledWith({
        where: { walletAddress: 'buyer-addr' },
      });
      const payload = JSON.parse((webpush.sendNotification as jest.Mock).mock.calls[0][1]);
      expect(payload.title).toBe('USDC en custodia');
      expect(payload.body).toContain('50 USDC bloqueados');
    });

    it('onVesPaymentSent with receipt → includes receipt note', async () => {
      await service.onVesPaymentSent({
        orderId: 'order-1',
        buyerWallet: 'buyer-addr',
        lpWallet: 'lp-addr',
        hasReceipt: true,
      });

      expect(prismaService.pushSubscription.findMany).toHaveBeenCalledWith({
        where: { walletAddress: 'lp-addr' },
      });
      const payload = JSON.parse((webpush.sendNotification as jest.Mock).mock.calls[0][1]);
      expect(payload.title).toBe('Pago VES enviado');
      expect(payload.body).toContain('(con comprobante)');
    });

    it('onVesPaymentSent without receipt → no receipt note', async () => {
      await service.onVesPaymentSent({
        orderId: 'order-1',
        buyerWallet: 'buyer-addr',
        lpWallet: 'lp-addr',
        hasReceipt: false,
      });

      const payload = JSON.parse((webpush.sendNotification as jest.Mock).mock.calls[0][1]);
      expect(payload.body).not.toContain('comprobante');
    });

    it('onVesOrderCompleted → sends push to buyer with USDC amount', async () => {
      await service.onVesOrderCompleted({
        orderId: 'order-1',
        buyerWallet: 'buyer-addr',
        lpWallet: 'lp-addr',
        amountUsdc: 75,
      });

      expect(prismaService.pushSubscription.findMany).toHaveBeenCalledWith({
        where: { walletAddress: 'buyer-addr' },
      });
      const payload = JSON.parse((webpush.sendNotification as jest.Mock).mock.calls[0][1]);
      expect(payload.title).toBe('Orden VES completada');
      expect(payload.body).toBe('Recibiste 75 USDC');
    });

    it('onVesOrderDisputed → sends push to BOTH buyer and LP', async () => {
      await service.onVesOrderDisputed({
        orderId: 'order-1',
        buyerWallet: 'buyer-addr',
        lpWallet: 'lp-addr',
        reason: 'Pago no recibido',
      });

      // findMany called twice (once for buyer, once for LP)
      expect(prismaService.pushSubscription.findMany).toHaveBeenCalledWith({
        where: { walletAddress: 'buyer-addr' },
      });
      expect(prismaService.pushSubscription.findMany).toHaveBeenCalledWith({
        where: { walletAddress: 'lp-addr' },
      });
      expect(webpush.sendNotification).toHaveBeenCalledTimes(2);
    });

    it('p2pTrades preference disabled → no push sent', async () => {
      prismaService.notificationPreference.findUnique.mockResolvedValue({
        walletAddress: 'lp-addr',
        p2pTrades: false,
        staking: true,
        referrals: true,
        grants: true,
        payments: true,
        priceAlerts: true,
      });

      await service.onVesOrderCreated({
        orderId: 'order-1',
        buyerWallet: 'buyer-addr',
        lpWallet: 'lp-addr',
        amountUsdc: 50,
        direction: 'ON_RAMP',
      });

      expect(webpush.sendNotification).not.toHaveBeenCalled();
    });
  });
});
