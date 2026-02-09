/* eslint-disable @typescript-eslint/no-explicit-any */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MoneygramService } from './moneygram.service';

const WALLET = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
const OTHER_WALLET = '9xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsX';
const TX_ID = 'mg-tx-123';

function mockTx(overrides: Record<string, unknown> = {}) {
  return {
    id: TX_ID,
    walletAddress: WALLET,
    direction: 'OFFRAMP',
    amountUsd: 100,
    status: 'INITIATED',
    stellarTransactionId: 'stellar-tx-1',
    interactiveUrl: 'https://moneygram.example/flow',
    stellarMemo: '12345',
    stellarDestination: 'GXYZ...',
    bridgeTxSolana: null,
    bridgeTxStellar: null,
    bridgeStatus: null,
    referenceNumber: null,
    bridgeFeeUsd: null,
    mgFeeUsd: null,
    netAmountUsd: null,
    errorMessage: null,
    retryCount: 0,
    lastPolledAt: null,
    confirmedAt: null,
    completedAt: null,
    cancelledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('MoneygramService', () => {
  let service: MoneygramService;
  let prisma: any;
  let stellar: any;
  let allbridge: any;

  beforeEach(() => {
    prisma = {
      moneygramTransaction: {
        create: jest.fn().mockResolvedValue(mockTx()),
        findUnique: jest.fn().mockResolvedValue(mockTx()),
        findMany: jest.fn().mockResolvedValue([mockTx()]),
        update: jest.fn().mockResolvedValue(mockTx()),
      },
      cronLock: {
        create: jest.fn().mockResolvedValue({ id: 'lock-1' }),
        update: jest.fn().mockResolvedValue({}),
      },
    };

    stellar = {
      isEnabled: false, // Mock mode
      authenticate: jest.fn().mockResolvedValue('MOCK_TOKEN'),
      initiateWithdraw: jest.fn().mockResolvedValue({
        id: 'MOCK_WD_1',
        url: '#mock-withdraw',
        memo: '12345',
        destination: 'GXYZ...',
      }),
      initiateDeposit: jest.fn().mockResolvedValue({
        id: 'MOCK_DEP_1',
        url: '#mock-deposit',
      }),
      getTransactionStatus: jest.fn().mockResolvedValue({
        id: 'stellar-tx-1',
        status: 'pending_user_transfer_start',
        amount_in: '100.00',
        amount_fee: '3.00',
      }),
      sendPayment: jest.fn().mockResolvedValue('MOCK_STELLAR_TX_1'),
    };

    allbridge = {
      isEnabled: false,
      bridgeSolanaToStellar: jest.fn().mockResolvedValue({
        transferId: 'bridge-1',
        sourceChainTx: 'sol-tx-1',
        estimatedTime: 180,
      }),
      bridgeStellarToSolana: jest.fn().mockResolvedValue({
        transferId: 'bridge-2',
        sourceChainTx: 'stlr-tx-1',
        estimatedTime: 180,
      }),
      estimateFee: jest.fn().mockResolvedValue({
        feeUsd: 0.3,
        feePercent: 0.3,
        estimatedTimeSeconds: 180,
      }),
      getTransferStatus: jest.fn().mockResolvedValue({ status: 'COMPLETED' }),
    };

    service = new MoneygramService(prisma, stellar, allbridge);
  });

  describe('isEnabled', () => {
    it('returns true (mock mode still functional)', () => {
      expect(service.isEnabled).toBe(true);
    });
  });

  describe('initiateOfframp', () => {
    it('creates a DB record and calls Stellar auth + withdraw', async () => {
      const result = await service.initiateOfframp(WALLET, 100);

      expect(prisma.moneygramTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          walletAddress: WALLET,
          direction: 'OFFRAMP',
          amountUsd: 100,
          status: 'INITIATED',
        }),
      });
      expect(stellar.authenticate).toHaveBeenCalled();
      expect(stellar.initiateWithdraw).toHaveBeenCalled();
      expect(result.interactiveUrl).toBeDefined();
      expect(result.status).toBe('PENDING_KYC');
    });

    it('rejects amount below $5', async () => {
      await expect(service.initiateOfframp(WALLET, 3)).rejects.toThrow(BadRequestException);
    });

    it('rejects amount above $2,500', async () => {
      await expect(service.initiateOfframp(WALLET, 3000)).rejects.toThrow(BadRequestException);
    });

    it('marks as FAILED if Stellar auth fails', async () => {
      stellar.authenticate.mockRejectedValue(new Error('Auth failed'));

      await expect(service.initiateOfframp(WALLET, 100)).rejects.toThrow('Auth failed');
      expect(prisma.moneygramTransaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'FAILED' }),
        })
      );
    });
  });

  describe('confirmOfframp', () => {
    it('updates status to CONFIRMED', async () => {
      prisma.moneygramTransaction.findUnique.mockResolvedValue(mockTx({ status: 'PENDING_KYC' }));

      const result = await service.confirmOfframp(WALLET, TX_ID);
      expect(result.status).toBe('CONFIRMED');
      expect(prisma.moneygramTransaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'CONFIRMED' }),
        })
      );
    });

    it('rejects if transaction not found', async () => {
      prisma.moneygramTransaction.findUnique.mockResolvedValue(null);
      await expect(service.confirmOfframp(WALLET, TX_ID)).rejects.toThrow(NotFoundException);
    });

    it('rejects if wallet does not match', async () => {
      await expect(service.confirmOfframp(OTHER_WALLET, TX_ID)).rejects.toThrow(NotFoundException);
    });

    it('rejects if already COMPLETED', async () => {
      prisma.moneygramTransaction.findUnique.mockResolvedValue(mockTx({ status: 'COMPLETED' }));
      await expect(service.confirmOfframp(WALLET, TX_ID)).rejects.toThrow(BadRequestException);
    });
  });

  describe('initiateOnramp', () => {
    it('creates a DB record with ONRAMP direction', async () => {
      const result = await service.initiateOnramp(WALLET, 50);

      expect(prisma.moneygramTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          walletAddress: WALLET,
          direction: 'ONRAMP',
          amountUsd: 50,
        }),
      });
      expect(stellar.initiateDeposit).toHaveBeenCalled();
      expect(result.interactiveUrl).toBeDefined();
    });

    it('rejects amount below $5', async () => {
      await expect(service.initiateOnramp(WALLET, 2)).rejects.toThrow(BadRequestException);
    });

    it('rejects amount above $950', async () => {
      await expect(service.initiateOnramp(WALLET, 1000)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getTransaction', () => {
    it('returns transaction for correct wallet', async () => {
      const result = await service.getTransaction(WALLET, TX_ID);
      expect(result.id).toBe(TX_ID);
    });

    it('rejects for wrong wallet', async () => {
      await expect(service.getTransaction(OTHER_WALLET, TX_ID)).rejects.toThrow(NotFoundException);
    });

    it('rejects when not found', async () => {
      prisma.moneygramTransaction.findUnique.mockResolvedValue(null);
      await expect(service.getTransaction(WALLET, TX_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getTransactions', () => {
    it('returns transactions for wallet', async () => {
      const result = await service.getTransactions(WALLET);
      expect(result).toHaveLength(1);
    });

    it('filters by direction when provided', async () => {
      await service.getTransactions(WALLET, 'OFFRAMP');
      expect(prisma.moneygramTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ direction: 'OFFRAMP' }),
        })
      );
    });
  });

  describe('cancelTransaction', () => {
    it('cancels INITIATED transaction', async () => {
      const result = await service.cancelTransaction(WALLET, TX_ID);
      expect(result.status).toBe('CANCELLED');
    });

    it('rejects for wrong wallet', async () => {
      await expect(service.cancelTransaction(OTHER_WALLET, TX_ID)).rejects.toThrow(
        NotFoundException
      );
    });

    it('rejects if already COMPLETED', async () => {
      prisma.moneygramTransaction.findUnique.mockResolvedValue(mockTx({ status: 'COMPLETED' }));
      await expect(service.cancelTransaction(WALLET, TX_ID)).rejects.toThrow(BadRequestException);
    });

    it('rejects if already CANCELLED', async () => {
      prisma.moneygramTransaction.findUnique.mockResolvedValue(mockTx({ status: 'CANCELLED' }));
      await expect(service.cancelTransaction(WALLET, TX_ID)).rejects.toThrow(BadRequestException);
    });
  });

  describe('estimateFees', () => {
    it('returns fee breakdown for offramp', async () => {
      const result = await service.estimateFees(100, 'OFFRAMP');

      expect(result.amountUsd).toBe(100);
      expect(result.bridgeFee).toBeGreaterThan(0);
      expect(result.mgFeeEstimate).toBeGreaterThan(0);
      expect(result.totalFees).toBeGreaterThan(0);
      expect(result.netAmount).toBeLessThan(100);
      expect(allbridge.estimateFee).toHaveBeenCalledWith(100, 'solana_to_stellar');
    });

    it('returns fee breakdown for onramp', async () => {
      const result = await service.estimateFees(50, 'ONRAMP');

      expect(result.direction).toBe('ONRAMP');
      expect(allbridge.estimateFee).toHaveBeenCalledWith(50, 'stellar_to_solana');
    });
  });
});
