/* eslint-disable @typescript-eslint/no-explicit-any */
import { BadRequestException } from '@nestjs/common';
import { Keypair, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { TopUpService } from './topup.service';

describe('TopUpService', () => {
  let service: TopUpService;
  let mockPrisma: any;
  let mockConfig: any;
  let mockSolana: any;
  let mockConnection: any;
  let wallet: string;
  let treasuryWallet: string;
  const originalFetch = global.fetch;

  beforeEach(() => {
    wallet = Keypair.generate().publicKey.toBase58();
    treasuryWallet = Keypair.generate().publicKey.toBase58();
    mockConnection = {
      getParsedTransaction: jest.fn(),
    };

    mockPrisma = {
      topUp: {
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      payout: {
        findFirst: jest.fn(),
      },
    };

    mockConfig = {
      get: jest.fn((key: string) => {
        if (key === 'RELOADLY_SANDBOX') return 'true';
        if (key === 'RELOADLY_CLIENT_ID') return 'test-client-id';
        if (key === 'RELOADLY_CLIENT_SECRET') return 'test-secret';
        if (key === 'TREASURY_WALLET') return treasuryWallet;
        return undefined;
      }),
    };

    mockSolana = {
      getConnection: jest.fn(() => mockConnection),
    };

    service = new TopUpService(mockPrisma, mockConfig, mockSolana);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe('getAccessToken (via getOperators)', () => {
    it('authenticates with Reloadly and caches token', async () => {
      const mockFetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: 'token123', expires_in: 3600 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([{ operatorId: 1, name: 'Movistar' }]),
        });
      global.fetch = mockFetch;

      const result = await service.getOperators('VE');
      expect(result).toEqual([{ operatorId: 1, name: 'Movistar' }]);
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Auth call
      const authBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(authBody.client_id).toBe('test-client-id');
      expect(authBody.grant_type).toBe('client_credentials');
    });

    it('throws when Reloadly credentials missing', async () => {
      mockConfig.get = jest.fn(() => undefined);
      service = new TopUpService(mockPrisma, mockConfig, mockSolana);

      // First fetch call will try to auth and fail with missing creds
      await expect(service.getOperators('VE')).rejects.toThrow(BadRequestException);
    });

    it('uses cached token on subsequent calls', async () => {
      const mockFetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: 'tok', expires_in: 3600 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        });
      global.fetch = mockFetch;

      await service.getOperators('VE');
      await service.getOperators('CO');
      // Auth only called once (first call), subsequent calls use cache
      expect(mockFetch).toHaveBeenCalledTimes(3); // 1 auth + 2 GET
    });
  });

  describe('topUp', () => {
    it('creates pending record then updates on success', async () => {
      mockPrisma.topUp.create.mockResolvedValue({ id: 'topup-1' });
      mockPrisma.topUp.update.mockResolvedValue({});
      mockPrisma.topUp.findFirst.mockResolvedValue(null);
      mockPrisma.payout.findFirst.mockResolvedValue(null);

      // Set cached token to skip auth
      (service as any).token = { accessToken: 'tok', expiresAt: Date.now() + 600_000 };

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
                    amount: '2000000', // 2 USDC (raw)
                  },
                },
              },
            ],
          },
        },
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            transactionId: 'reloadly-tx-1',
            operatorName: 'Movistar',
            deliveredAmount: 100,
            deliveredAmountCurrencyCode: 'VES',
          }),
      });

      const result = await service.topUp(wallet, '+584121234567', 'VE', 1, 2, 'paymentSig123');
      expect(result.status).toBe('SUCCESSFUL');
      expect(result.deliveredCurrency).toBe('VES');
      expect(mockPrisma.topUp.create).toHaveBeenCalled();
      expect(mockPrisma.topUp.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'SUCCESSFUL' }),
        })
      );
    });

    it('rejects when payment tx is missing', async () => {
      mockConnection.getParsedTransaction.mockResolvedValue(null);

      await expect(
        service.topUp(wallet, '+584121234567', 'VE', 1, 5, 'missingSig')
      ).rejects.toThrow('Payment transaction not found');
      expect(mockPrisma.topUp.create).not.toHaveBeenCalled();
    });

    it('marks as FAILED on reloadly error', async () => {
      mockPrisma.topUp.create.mockResolvedValue({ id: 'topup-2' });
      mockPrisma.topUp.update.mockResolvedValue({});
      mockPrisma.topUp.findFirst.mockResolvedValue(null);
      mockPrisma.payout.findFirst.mockResolvedValue(null);

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
                    amount: '2000000', // 2 USDC
                  },
                },
              },
            ],
          },
        },
      });

      (service as any).token = { accessToken: 'tok', expiresAt: Date.now() + 600_000 };
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('Insufficient balance'),
      });

      await expect(service.topUp(wallet, '+58412', 'VE', 1, 2, 'paymentSig123')).rejects.toThrow(
        BadRequestException
      );
      expect(mockPrisma.topUp.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'FAILED' }),
        })
      );
    });
  });

  describe('getHistory', () => {
    it('returns topups for wallet', async () => {
      mockPrisma.topUp.findMany.mockResolvedValue([
        { id: '1', recipientPhone: '+58', status: 'SUCCESSFUL' },
      ]);

      const result = await service.getHistory('wallet1');
      expect(result).toHaveLength(1);
      expect(mockPrisma.topUp.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'wallet1' } })
      );
    });
  });

  describe('getBalance', () => {
    it('fetches Reloadly account balance', async () => {
      (service as any).token = { accessToken: 'tok', expiresAt: Date.now() + 600_000 };
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ balance: 998.5, currency: 'USD' }),
      });

      const result = await service.getBalance();
      expect(result).toEqual({ balance: 998.5, currency: 'USD' });
    });
  });
});
