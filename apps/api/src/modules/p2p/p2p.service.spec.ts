import { BadRequestException, NotFoundException } from '@nestjs/common';
import { P2PService } from './p2p.service';

// Scale helpers matching the service
const AMOUNT_SCALE = 1_000_000;
function toBigInt(n: number): bigint {
  return BigInt(Math.round(n * AMOUNT_SCALE));
}

describe('P2PService', () => {
  let service: P2PService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        upsert: jest.fn().mockResolvedValue({ id: 'user-1', walletAddress: 'seller-addr' }),
        findUnique: jest.fn(),
      },
      p2POffer: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      p2PTrade: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      userReputation: {
        upsert: jest
          .fn()
          .mockResolvedValue({ totalTrades: 1, completedTrades: 1, disputesLost: 0 }),
        update: jest.fn(),
      },
      $transaction: jest.fn((fn: any) => fn(mockPrisma)),
      $queryRaw: jest.fn(),
    };

    const mockConfig = {
      get: jest.fn((key: string) => {
        if (key === 'ESCROW_WALLET_KEYPAIR') return undefined;
        if (key === 'TREASURY_WALLET') return 'H9j1W4u5LEiw8AZdui6c8AmN6t4tKkPQCAULPW8eMiTE';
        return undefined;
      }),
    };

    service = new P2PService(
      mockPrisma,
      {} as any, // txLogger
      {} as any, // solana
      mockConfig as any
    );
  });

  describe('createOffer', () => {
    it('rejects when minAmount > maxAmount', async () => {
      await expect(
        service.createOffer({
          sellerAddress: 'seller-addr',
          type: 'SELL',
          cryptoAmount: 100,
          cryptoCurrency: 'USDC',
          paymentMethod: 'ZELLE',
          rate: 1.0,
          minAmount: 200,
          maxAmount: 100,
        })
      ).rejects.toThrow('Min amount cannot be greater than max amount');
    });

    it('creates offer with correct initial available amount', async () => {
      mockPrisma.p2POffer.create.mockResolvedValue({
        id: 'offer-1',
        seller: { walletAddress: 'seller-addr' },
        type: 'SELL',
        cryptoAmount: toBigInt(100),
        availableAmount: toBigInt(100),
        cryptoCurrency: 'USDC',
        paymentMethod: 'ZELLE',
        rate: 0.99,
        minAmount: toBigInt(10),
        maxAmount: toBigInt(100),
        status: 'ACTIVE',
        createdAt: new Date(),
      });

      const result = await service.createOffer({
        sellerAddress: 'seller-addr',
        type: 'SELL',
        cryptoAmount: 100,
        cryptoCurrency: 'USDC',
        paymentMethod: 'ZELLE',
        rate: 0.99,
        minAmount: 10,
        maxAmount: 100,
      });

      expect(result.availableAmount).toBe(100);
      expect(result.cryptoAmount).toBe(100);
    });
  });

  describe('acceptOffer', () => {
    const mockOfferRow = {
      id: 'offer-1',
      sellerId: 'seller-id',
      sellerAddress: 'seller-addr',
      type: 'SELL',
      cryptoAmount: toBigInt(100),
      availableAmount: toBigInt(100),
      cryptoCurrency: 'USDC',
      paymentMethod: 'ZELLE',
      rate: 1.0,
      minAmount: toBigInt(10),
      maxAmount: toBigInt(50),
      status: 'ACTIVE',
    };

    it('rejects amount below minimum', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([mockOfferRow]);

      await expect(
        service.acceptOffer('offer-1', { buyerAddress: 'buyer-addr', amount: 5 })
      ).rejects.toThrow('Amount must be between 10 and 50');
    });

    it('rejects amount above maximum', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([mockOfferRow]);

      await expect(
        service.acceptOffer('offer-1', { buyerAddress: 'buyer-addr', amount: 60 })
      ).rejects.toThrow('Amount must be between 10 and 50');
    });

    it('rejects if offer is not active', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          ...mockOfferRow,
          status: 'COMPLETED',
        },
      ]);

      await expect(
        service.acceptOffer('offer-1', { buyerAddress: 'buyer-addr', amount: 20 })
      ).rejects.toThrow('Offer is not active');
    });

    it('rejects if not enough available', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          ...mockOfferRow,
          availableAmount: toBigInt(5),
        },
      ]);

      await expect(
        service.acceptOffer('offer-1', { buyerAddress: 'buyer-addr', amount: 20 })
      ).rejects.toThrow('Not enough available in offer');
    });

    it('throws NotFoundException for unknown offer', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      await expect(
        service.acceptOffer('unknown', { buyerAddress: 'buyer-addr', amount: 20 })
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateTradeStatus authorization', () => {
    // $queryRaw returns flat rows with joined wallet addresses
    const mockTradeRow = {
      id: 'trade-1',
      buyerId: 'buyer-id',
      sellerId: 'seller-id',
      buyerAddress: 'buyer-addr',
      sellerAddress: 'seller-addr',
      cryptoCurrency: 'USDC',
      status: 'ESCROW_LOCKED',
      escrowTx: null,
      amount: toBigInt(20),
      cryptoAmount: toBigInt(20),
    };

    beforeEach(() => {
      mockPrisma.$queryRaw.mockResolvedValue([mockTradeRow]);
      mockPrisma.p2PTrade.update.mockResolvedValue({
        ...mockTradeRow,
        buyer: { walletAddress: 'buyer-addr' },
        seller: { walletAddress: 'seller-addr' },
        offer: { cryptoCurrency: 'USDC' },
        status: 'PAID',
        paidAt: new Date(),
      });
    });

    it('only buyer can mark trade as PAID', async () => {
      await expect(
        service.updateTradeStatus('trade-1', 'seller-addr', { status: 'PAID' })
      ).rejects.toThrow('Only buyer can mark as paid');
    });

    it('only seller can CONFIRM receipt', async () => {
      await expect(
        service.updateTradeStatus('trade-1', 'buyer-addr', { status: 'CONFIRMED' })
      ).rejects.toThrow('Only seller can confirm receipt');
    });

    it('throws NotFoundException for unknown trade', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      await expect(
        service.updateTradeStatus('unknown', 'buyer-addr', { status: 'PAID' })
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getReputation', () => {
    it('returns default reputation for new user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const rep = await service.getReputation('new-wallet');
      expect(rep.totalTrades).toBe(0);
      expect(rep.rating).toBe(5.0);
    });

    it('returns existing reputation', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        walletAddress: 'active-wallet',
        reputation: {
          totalTrades: 15,
          completedTrades: 14,
          disputesLost: 1,
          rating: 4.5,
          avgResponseTime: 120,
        },
      });

      const rep = await service.getReputation('active-wallet');
      expect(rep.totalTrades).toBe(15);
      expect(rep.completedTrades).toBe(14);
      expect(rep.rating).toBe(4.5);
    });
  });
});
