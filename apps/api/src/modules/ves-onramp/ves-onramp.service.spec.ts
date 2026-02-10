/* eslint-disable @typescript-eslint/no-explicit-any */
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Keypair } from '@solana/web3.js';
import { VesOnrampService } from './ves-onramp.service';

describe('VesOnrampService', () => {
  let service: VesOnrampService;
  let mockPrisma: any;
  let mockTxLogger: any;
  let mockSolana: any;
  let mockConfig: any;
  let mockEventEmitter: any;
  let lpWallet: string;
  let buyerWallet: string;

  beforeEach(() => {
    lpWallet = Keypair.generate().publicKey.toBase58();
    buyerWallet = Keypair.generate().publicKey.toBase58();

    mockPrisma = {
      user: {
        findUnique: jest.fn(),
      },
      vesOffer: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      vesOrder: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(),
      $queryRaw: jest.fn(),
    };

    mockTxLogger = {
      log: jest.fn().mockReturnValue(Promise.resolve()),
      confirm: jest.fn().mockReturnValue(Promise.resolve()),
    };

    mockSolana = {
      getConnection: jest.fn(() => ({
        getParsedTransaction: jest.fn(),
      })),
    };

    mockConfig = {
      get: jest.fn((key: string, defaultVal?: string) => {
        if (key === 'ESCROW_MODE') return 'legacy';
        if (key === 'ESCROW_ADMIN_PUBKEY') return defaultVal;
        if (key === 'TREASURY_WALLET') return defaultVal;
        return defaultVal ?? undefined;
      }),
    };

    mockEventEmitter = {
      emit: jest.fn(),
    };

    service = new VesOnrampService(
      mockPrisma,
      mockTxLogger,
      mockSolana,
      mockConfig,
      mockEventEmitter
    );
  });

  // ============ OFFERS ============

  describe('createOffer', () => {
    const validDto = {
      vesRate: 42.5,
      feePercent: 1.5,
      availableUsdc: 500,
      minOrderUsdc: 5,
      maxOrderUsdc: 200,
      bankCode: '0105',
      bankName: 'Banco Mercantil',
      phoneNumber: '04163334455',
      ciNumber: 'V12345678',
    };

    it('creates an offer with valid data', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', walletAddress: lpWallet });
      mockPrisma.vesOffer.create.mockResolvedValue({
        id: 'offer-1',
        lpWalletAddress: lpWallet,
        availableUsdc: BigInt(500_000_000),
        vesRate: 42.5,
        feePercent: 1.5,
        minOrderUsdc: BigInt(5_000_000),
        maxOrderUsdc: BigInt(200_000_000),
        bankCode: '0105',
        bankName: 'Banco Mercantil',
        phoneNumber: '04163334455',
        ciNumber: 'V12345678',
        status: 'ACTIVE',
        totalOrders: 0,
        completedOrders: 0,
        createdAt: new Date(),
        lpUser: { walletAddress: lpWallet },
      });

      const result = await service.createOffer(validDto, lpWallet);

      expect(result.id).toBe('offer-1');
      expect(result.availableUsdc).toBe(500);
      expect(result.vesRate).toBe(42.5);
      expect(result.effectiveRate).toBeCloseTo(43.1375, 2);
      expect(mockPrisma.vesOffer.create).toHaveBeenCalled();
    });

    it('rejects when min > max', async () => {
      const dto = { ...validDto, minOrderUsdc: 300, maxOrderUsdc: 100 };

      await expect(service.createOffer(dto, lpWallet)).rejects.toThrow(
        'Min order cannot be greater than max order'
      );
    });

    it('rejects when available < min', async () => {
      const dto = { ...validDto, availableUsdc: 3, minOrderUsdc: 5 };

      await expect(service.createOffer(dto, lpWallet)).rejects.toThrow(
        'Available USDC must be at least the minimum order size'
      );
    });

    it('throws when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.createOffer(validDto, lpWallet)).rejects.toThrow('User not found');
    });
  });

  describe('getOffers', () => {
    it('returns active offers sorted by rate', async () => {
      mockPrisma.vesOffer.findMany.mockResolvedValue([
        {
          id: 'offer-1',
          lpWalletAddress: lpWallet,
          availableUsdc: BigInt(100_000_000),
          vesRate: 40.0,
          feePercent: 1.0,
          minOrderUsdc: BigInt(5_000_000),
          maxOrderUsdc: BigInt(100_000_000),
          bankCode: '0105',
          bankName: 'Mercantil',
          phoneNumber: '04161112233',
          ciNumber: 'V99999999',
          status: 'ACTIVE',
          totalOrders: 5,
          completedOrders: 4,
          createdAt: new Date(),
          lpUser: { walletAddress: lpWallet, reputation: { rating: 4.5, completedTrades: 10 } },
        },
      ]);

      const result = await service.getOffers();

      expect(result).toHaveLength(1);
      expect(result[0].vesRate).toBe(40.0);
      expect(result[0].lpRating).toBe(4.5);
      expect(result[0].lpCompletedTrades).toBe(10);
      expect(mockPrisma.vesOffer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'ACTIVE' },
          orderBy: { vesRate: 'asc' },
        })
      );
    });
  });

  describe('deactivateOffer', () => {
    it('pauses an active offer', async () => {
      mockPrisma.vesOffer.findUnique.mockResolvedValue({
        id: 'offer-1',
        lpWalletAddress: lpWallet,
        status: 'ACTIVE',
      });
      mockPrisma.vesOffer.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.deactivateOffer('offer-1', lpWallet);

      expect(result.success).toBe(true);
    });

    it('rejects when different wallet tries to deactivate', async () => {
      mockPrisma.vesOffer.findUnique.mockResolvedValue({
        id: 'offer-1',
        lpWalletAddress: 'other-wallet',
      });

      await expect(service.deactivateOffer('offer-1', lpWallet)).rejects.toThrow(
        'Only the LP can deactivate this offer'
      );
    });

    it('rejects when offer not active', async () => {
      mockPrisma.vesOffer.findUnique.mockResolvedValue({
        id: 'offer-1',
        lpWalletAddress: lpWallet,
        status: 'PAUSED',
      });
      mockPrisma.vesOffer.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.deactivateOffer('offer-1', lpWallet)).rejects.toThrow(
        'Offer is not active'
      );
    });
  });

  // ============ ORDERS ============

  describe('createOrder', () => {
    it('creates an order with valid data via transaction', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'buyer-1', walletAddress: buyerWallet });

      const mockOrder = {
        id: 'order-1',
        offerId: 'offer-1',
        buyerWalletAddress: buyerWallet,
        lpWalletAddress: lpWallet,
        amountUsdc: BigInt(23_255_813), // ~23.26 USDC
        amountVes: 1000,
        vesRate: 42.5,
        feePercent: 1.5,
        status: 'PENDING',
        escrowTx: null,
        releaseTx: null,
        disputeReason: null,
        createdAt: new Date(),
        paidAt: null,
        confirmedAt: null,
        completedAt: null,
        expiresAt: new Date(Date.now() + 1800000),
        offer: {
          bankCode: '0105',
          bankName: 'Mercantil',
          phoneNumber: '04163334455',
          ciNumber: 'V12345678',
        },
      };

      // Mock the $transaction to execute the callback
      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        const mockTx = {
          $queryRaw: jest.fn().mockResolvedValue([
            {
              id: 'offer-1',
              lpWalletAddress: lpWallet,
              lpUserId: 'lp-user-1',
              availableUsdc: BigInt(500_000_000),
              vesRate: 42.5,
              feePercent: 1.5,
              minOrderUsdc: BigInt(5_000_000),
              maxOrderUsdc: BigInt(200_000_000),
              status: 'ACTIVE',
            },
          ]),
          vesOffer: { update: jest.fn() },
          vesOrder: { create: jest.fn().mockResolvedValue(mockOrder) },
        };
        return cb(mockTx);
      });

      const result = await service.createOrder(
        'offer-1',
        { offerId: 'offer-1', amountVes: 1000 },
        buyerWallet
      );

      expect(result.id).toBe('order-1');
      expect(result.amountVes).toBe(1000);
      expect(result.status).toBe('PENDING');
      expect(result.pagoMovil).toBeDefined();
      expect(result.pagoMovil.bankName).toBe('Mercantil');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'ves-onramp.order.created',
        expect.objectContaining({ orderId: 'order-1' })
      );
    });

    it('rejects when buyer not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.createOrder('offer-1', { offerId: 'offer-1', amountVes: 1000 }, buyerWallet)
      ).rejects.toThrow('User not found');
    });

    it('rejects when buying from own offer', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', walletAddress: lpWallet });
      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        const mockTx = {
          $queryRaw: jest.fn().mockResolvedValue([
            {
              id: 'offer-1',
              lpWalletAddress: lpWallet,
              status: 'ACTIVE',
              availableUsdc: BigInt(500_000_000),
              vesRate: 42.5,
              feePercent: 1.5,
              minOrderUsdc: BigInt(5_000_000),
              maxOrderUsdc: BigInt(200_000_000),
            },
          ]),
        };
        return cb(mockTx);
      });

      await expect(
        service.createOrder('offer-1', { offerId: 'offer-1', amountVes: 1000 }, lpWallet)
      ).rejects.toThrow('Cannot buy from your own offer');
    });
  });

  describe('getOrderDetails', () => {
    it('returns order for participant', async () => {
      mockPrisma.vesOrder.findUnique.mockResolvedValue({
        id: 'order-1',
        offerId: 'offer-1',
        buyerWalletAddress: buyerWallet,
        lpWalletAddress: lpWallet,
        amountUsdc: BigInt(25_000_000),
        amountVes: 1000,
        vesRate: 42.5,
        feePercent: 1.5,
        status: 'PENDING',
        escrowTx: null,
        releaseTx: null,
        disputeReason: null,
        createdAt: new Date(),
        paidAt: null,
        confirmedAt: null,
        completedAt: null,
        expiresAt: new Date(),
        offer: { bankCode: '0105', bankName: 'Mercantil', phoneNumber: '0416', ciNumber: 'V1' },
      });

      const result = await service.getOrderDetails('order-1', buyerWallet);
      expect(result.id).toBe('order-1');
    });

    it('rejects for non-participant', async () => {
      mockPrisma.vesOrder.findUnique.mockResolvedValue({
        id: 'order-1',
        buyerWalletAddress: 'other-1',
        lpWalletAddress: 'other-2',
      });

      await expect(service.getOrderDetails('order-1', buyerWallet)).rejects.toThrow(
        'Access denied'
      );
    });

    it('throws when order not found', async () => {
      mockPrisma.vesOrder.findUnique.mockResolvedValue(null);

      await expect(service.getOrderDetails('order-missing', buyerWallet)).rejects.toThrow(
        'Order not found'
      );
    });
  });

  describe('getUserOrders', () => {
    it('returns orders for wallet', async () => {
      mockPrisma.vesOrder.findMany.mockResolvedValue([
        {
          id: 'order-1',
          offerId: 'offer-1',
          buyerWalletAddress: buyerWallet,
          lpWalletAddress: lpWallet,
          amountUsdc: BigInt(25_000_000),
          amountVes: 1000,
          vesRate: 42.5,
          feePercent: 1.5,
          status: 'COMPLETED',
          escrowTx: 'tx1',
          releaseTx: 'tx2',
          disputeReason: null,
          createdAt: new Date(),
          paidAt: new Date(),
          confirmedAt: new Date(),
          completedAt: new Date(),
          expiresAt: new Date(),
          offer: { bankCode: '0105', bankName: 'Mercantil', phoneNumber: '0416', ciNumber: 'V1' },
        },
      ]);

      const result = await service.getUserOrders(buyerWallet);

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('COMPLETED');
      expect(mockPrisma.vesOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [{ buyerWalletAddress: buyerWallet }, { lpWalletAddress: buyerWallet }],
          },
        })
      );
    });
  });

  // ============ PAYMENT FLOW ============

  describe('markPaid', () => {
    it('marks order as paid when buyer calls', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          id: 'order-1',
          buyerWalletAddress: buyerWallet,
          lpWalletAddress: lpWallet,
          status: 'ESCROW_LOCKED',
          amountVes: 1000,
        },
      ]);
      mockPrisma.vesOrder.update.mockResolvedValue({});

      const result = await service.markPaid('order-1', buyerWallet);

      expect(result.success).toBe(true);
      expect(mockPrisma.vesOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'PAYMENT_SENT' }),
        })
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'ves-onramp.payment.sent',
        expect.objectContaining({ orderId: 'order-1' })
      );
    });

    it('rejects when non-buyer tries to mark paid', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          id: 'order-1',
          buyerWalletAddress: 'someone-else',
          lpWalletAddress: lpWallet,
          status: 'ESCROW_LOCKED',
        },
      ]);

      await expect(service.markPaid('order-1', buyerWallet)).rejects.toThrow(
        'Only the buyer can mark as paid'
      );
    });

    it('rejects when order is not ESCROW_LOCKED', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          id: 'order-1',
          buyerWalletAddress: buyerWallet,
          status: 'PENDING',
        },
      ]);

      await expect(service.markPaid('order-1', buyerWallet)).rejects.toThrow('Cannot mark as paid');
    });
  });

  // ============ DISPUTES ============

  describe('openDispute', () => {
    it('opens dispute for order participant', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          id: 'order-1',
          buyerWalletAddress: buyerWallet,
          lpWalletAddress: lpWallet,
          status: 'PAYMENT_SENT',
        },
      ]);
      mockPrisma.vesOrder.update.mockResolvedValue({});

      const result = await service.openDispute('order-1', buyerWallet, 'LP not responding');

      expect(result.success).toBe(true);
      expect(mockPrisma.vesOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'DISPUTED', disputeReason: 'LP not responding' },
        })
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'ves-onramp.order.disputed',
        expect.objectContaining({ reason: 'LP not responding' })
      );
    });

    it('rejects for non-participant', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          id: 'order-1',
          buyerWalletAddress: 'other-1',
          lpWalletAddress: 'other-2',
          status: 'PAYMENT_SENT',
        },
      ]);

      await expect(service.openDispute('order-1', buyerWallet, 'test')).rejects.toThrow(
        'Only order participants can dispute'
      );
    });

    it('rejects for wrong status', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          id: 'order-1',
          buyerWalletAddress: buyerWallet,
          lpWalletAddress: lpWallet,
          status: 'COMPLETED',
        },
      ]);

      await expect(service.openDispute('order-1', buyerWallet, 'test dispute')).rejects.toThrow(
        'Cannot dispute'
      );
    });
  });

  // ============ ESCROW PARAMS ============

  describe('getEscrowLockParams', () => {
    it('returns legacy escrow params for LP', async () => {
      mockPrisma.vesOrder.findUnique.mockResolvedValue({
        id: 'order-1',
        lpWalletAddress: lpWallet,
        buyerWalletAddress: buyerWallet,
        amountUsdc: BigInt(25_000_000),
        status: 'PENDING',
        offer: {},
      });

      const result = await service.getEscrowLockParams('order-1', lpWallet);

      expect(result.mode).toBe('legacy');
      expect(result.amount).toBe(25);
      expect(result.decimals).toBe(6);
      expect(result.mintAddress).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    });

    it('rejects when non-LP requests params', async () => {
      mockPrisma.vesOrder.findUnique.mockResolvedValue({
        id: 'order-1',
        lpWalletAddress: 'other-lp',
        status: 'PENDING',
        offer: {},
      });

      await expect(service.getEscrowLockParams('order-1', buyerWallet)).rejects.toThrow(
        'Only the LP can lock escrow'
      );
    });

    it('rejects when order not PENDING', async () => {
      mockPrisma.vesOrder.findUnique.mockResolvedValue({
        id: 'order-1',
        lpWalletAddress: lpWallet,
        status: 'ESCROW_LOCKED',
        offer: {},
      });

      await expect(service.getEscrowLockParams('order-1', lpWallet)).rejects.toThrow(
        'Order is not in PENDING status'
      );
    });
  });
});
