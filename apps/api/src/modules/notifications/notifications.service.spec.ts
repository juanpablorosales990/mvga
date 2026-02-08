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
});
