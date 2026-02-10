/* eslint-disable @typescript-eslint/no-explicit-any */
import { BadRequestException } from '@nestjs/common';
import { Keypair, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { GiftCardService } from './giftcard.service';
import { BitrefillAdapter } from './bitrefill.adapter';

describe('GiftCardService', () => {
  let service: GiftCardService;
  let mockPrisma: any;
  let mockConfig: any;
  let mockSolana: any;
  let mockAdapter: any;
  let mockConnection: any;
  let wallet: string;
  let treasuryWallet: string;

  beforeEach(() => {
    wallet = Keypair.generate().publicKey.toBase58();
    treasuryWallet = Keypair.generate().publicKey.toBase58();
    mockConnection = {
      getParsedTransaction: jest.fn(),
    };

    mockPrisma = {
      giftCard: {
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    mockConfig = {
      get: jest.fn((key: string) => {
        if (key === 'TREASURY_WALLET') return treasuryWallet;
        if (key === 'BITREFILL_API_KEY') return 'test-key';
        if (key === 'BITREFILL_API_SECRET') return 'test-secret';
        return undefined;
      }),
    };

    mockSolana = {
      getConnection: jest.fn(() => mockConnection),
    };

    mockAdapter = {
      isEnabled: false,
      getProducts: jest.fn().mockResolvedValue([
        {
          id: 'amazon-us',
          name: 'Amazon US',
          category: 'shopping',
          denominations: [10, 25, 50, 100],
          currency: 'USD',
          country: 'US',
        },
        {
          id: 'netflix',
          name: 'Netflix',
          category: 'entertainment',
          denominations: [15, 30, 60],
          currency: 'USD',
          country: 'US',
        },
      ]),
      purchaseGiftCard: jest.fn().mockResolvedValue({
        orderId: 'mock_123',
        code: 'MOCK-ABCD-EFGH',
        pin: null,
        status: 'SUCCESS',
      }),
    };

    service = new GiftCardService(mockPrisma, mockConfig, mockSolana, mockAdapter);
  });

  describe('isEnabled', () => {
    it('returns true when treasury wallet is configured', () => {
      expect(service.isEnabled).toBe(true);
    });

    it('returns false when treasury wallet is missing', () => {
      mockConfig.get = jest.fn(() => undefined);
      service = new GiftCardService(mockPrisma, mockConfig, mockSolana, mockAdapter);
      expect(service.isEnabled).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('returns enabled status with categories', () => {
      const status = service.getStatus();
      expect(status.enabled).toBe(true);
      expect(status.categories).toEqual(['shopping', 'entertainment', 'gaming', 'food']);
      expect(status.treasuryWallet).toBe(treasuryWallet);
      expect(status.usdcMint).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    });
  });

  describe('getProducts', () => {
    it('returns products from adapter', async () => {
      const products = await service.getProducts();
      expect(products).toHaveLength(2);
      expect(mockAdapter.getProducts).toHaveBeenCalledWith(undefined);
    });

    it('passes category filter to adapter', async () => {
      await service.getProducts('gaming');
      expect(mockAdapter.getProducts).toHaveBeenCalledWith('gaming');
    });
  });

  describe('purchase', () => {
    const setupValidPayment = async () => {
      const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
      const userAta = await getAssociatedTokenAddress(USDC_MINT, new PublicKey(wallet));
      const treasuryAta = await getAssociatedTokenAddress(USDC_MINT, new PublicKey(treasuryWallet));

      mockConnection.getParsedTransaction.mockResolvedValue({
        meta: { err: null },
        transaction: {
          message: {
            instructions: [
              {
                program: 'spl-token',
                parsed: {
                  type: 'transfer',
                  info: {
                    source: userAta.toBase58(),
                    destination: treasuryAta.toBase58(),
                    authority: wallet,
                    amount: '25000000', // 25 USDC
                  },
                },
              },
            ],
          },
        },
      });
    };

    it('creates record and delivers gift card on success', async () => {
      await setupValidPayment();
      mockPrisma.giftCard.findFirst.mockResolvedValue(null);
      mockPrisma.giftCard.create.mockResolvedValue({ id: 'gc-1' });
      mockPrisma.giftCard.update.mockResolvedValue({});

      const result = await service.purchase(wallet, 'amazon-us', 25, 'paymentSig123');

      expect(result.status).toBe('DELIVERED');
      expect(result.code).toBe('MOCK-ABCD-EFGH');
      expect(result.productName).toBe('Amazon US $25');
      expect(mockPrisma.giftCard.create).toHaveBeenCalled();
      expect(mockPrisma.giftCard.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'DELIVERED', code: 'MOCK-ABCD-EFGH' }),
        })
      );
    });

    it('returns existing record for duplicate payment signature (idempotency)', async () => {
      mockPrisma.giftCard.findFirst.mockResolvedValue({
        id: 'gc-existing',
        status: 'DELIVERED',
        productName: 'Amazon US $25',
        amountUsd: 25,
        code: 'EXISTING-CODE',
      });

      const result = await service.purchase(wallet, 'amazon-us', 25, 'paymentSig123');

      expect(result.id).toBe('gc-existing');
      expect(result.code).toBe('EXISTING-CODE');
      expect(mockPrisma.giftCard.create).not.toHaveBeenCalled();
      expect(mockConnection.getParsedTransaction).not.toHaveBeenCalled();
    });

    it('rejects when payment transaction not found', async () => {
      mockPrisma.giftCard.findFirst.mockResolvedValue(null);
      mockConnection.getParsedTransaction.mockResolvedValue(null);

      await expect(service.purchase(wallet, 'amazon-us', 25, 'badSig')).rejects.toThrow(
        'Payment transaction not found'
      );
      expect(mockPrisma.giftCard.create).not.toHaveBeenCalled();
    });

    it('rejects when payment amount is insufficient', async () => {
      const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
      const userAta = await getAssociatedTokenAddress(USDC_MINT, new PublicKey(wallet));
      const treasuryAta = await getAssociatedTokenAddress(USDC_MINT, new PublicKey(treasuryWallet));

      mockPrisma.giftCard.findFirst.mockResolvedValue(null);
      mockConnection.getParsedTransaction.mockResolvedValue({
        meta: { err: null },
        transaction: {
          message: {
            instructions: [
              {
                program: 'spl-token',
                parsed: {
                  type: 'transfer',
                  info: {
                    source: userAta.toBase58(),
                    destination: treasuryAta.toBase58(),
                    authority: wallet,
                    amount: '1000000', // Only 1 USDC but trying to buy $25
                  },
                },
              },
            ],
          },
        },
      });

      await expect(service.purchase(wallet, 'amazon-us', 25, 'lowSig')).rejects.toThrow(
        'Insufficient payment amount'
      );
    });

    it('marks as FAILED when adapter throws', async () => {
      await setupValidPayment();
      mockPrisma.giftCard.findFirst.mockResolvedValue(null);
      mockPrisma.giftCard.create.mockResolvedValue({ id: 'gc-fail' });
      mockPrisma.giftCard.update.mockResolvedValue({});
      mockAdapter.purchaseGiftCard.mockRejectedValue(new Error('Bitrefill API error'));

      await expect(service.purchase(wallet, 'amazon-us', 25, 'paymentSig456')).rejects.toThrow(
        'Bitrefill API error'
      );
      expect(mockPrisma.giftCard.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'FAILED',
            errorMessage: 'Bitrefill API error',
          }),
        })
      );
    });

    it('throws when gift cards are not available', async () => {
      mockConfig.get = jest.fn(() => undefined);
      service = new GiftCardService(mockPrisma, mockConfig, mockSolana, mockAdapter);

      await expect(service.purchase(wallet, 'amazon-us', 25, 'sig')).rejects.toThrow(
        'Gift cards are not available'
      );
    });
  });

  describe('getOrder', () => {
    it('returns order for matching wallet', async () => {
      mockPrisma.giftCard.findUnique.mockResolvedValue({
        id: 'gc-1',
        walletAddress: wallet,
        productName: 'Amazon US $25',
      });

      const result = await service.getOrder(wallet, 'gc-1');
      expect(result.productName).toBe('Amazon US $25');
    });

    it('throws when order belongs to different wallet', async () => {
      mockPrisma.giftCard.findUnique.mockResolvedValue({
        id: 'gc-1',
        walletAddress: 'other-wallet',
      });

      await expect(service.getOrder(wallet, 'gc-1')).rejects.toThrow('Order not found');
    });

    it('throws when order does not exist', async () => {
      mockPrisma.giftCard.findUnique.mockResolvedValue(null);

      await expect(service.getOrder(wallet, 'gc-missing')).rejects.toThrow('Order not found');
    });
  });

  describe('getHistory', () => {
    it('returns gift cards for wallet', async () => {
      mockPrisma.giftCard.findMany.mockResolvedValue([
        { id: 'gc-1', productName: 'Netflix $15', status: 'DELIVERED' },
      ]);

      const result = await service.getHistory(wallet);
      expect(result).toHaveLength(1);
      expect(mockPrisma.giftCard.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { walletAddress: wallet },
          orderBy: { createdAt: 'desc' },
          take: 20,
        })
      );
    });
  });
});
