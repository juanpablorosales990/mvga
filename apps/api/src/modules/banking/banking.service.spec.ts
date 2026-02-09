/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { BankingService } from './banking.service';

describe('BankingService', () => {
  let service: BankingService;
  let mockPrisma: any;
  let mockRain: any;

  beforeEach(() => {
    mockPrisma = {
      cardWaitlist: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      cardApplication: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    mockRain = {
      isEnabled: false,
      submitKyc: jest.fn(),
      getUserStatus: jest.fn(),
      deployContract: jest.fn(),
      issueCard: jest.fn(),
      getCard: jest.fn(),
      getBalance: jest.fn(),
      getTransactions: jest.fn(),
      freezeCard: jest.fn(),
      unfreezeCard: jest.fn(),
      getContracts: jest.fn(),
    };

    service = new BankingService(mockPrisma, mockRain);
  });

  describe('joinCardWaitlist', () => {
    it('returns alreadyJoined true if already waitlisted', async () => {
      mockPrisma.cardWaitlist.findFirst.mockResolvedValue({ walletAddress: 'abc' });
      const result = await service.joinCardWaitlist('abc');
      expect(result).toEqual({ waitlisted: true, alreadyJoined: true });
    });

    it('creates entry and returns alreadyJoined false for new user', async () => {
      mockPrisma.cardWaitlist.findFirst.mockResolvedValue(null);
      mockPrisma.cardWaitlist.create.mockResolvedValue({});
      const result = await service.joinCardWaitlist('abc', 'test@example.com');
      expect(result).toEqual({ waitlisted: true, alreadyJoined: false });
      expect(mockPrisma.cardWaitlist.create).toHaveBeenCalledWith({
        data: { walletAddress: 'abc', email: 'test@example.com' },
      });
    });
  });

  describe('getWaitlistStatus', () => {
    it('returns waitlisted true if entry exists', async () => {
      mockPrisma.cardWaitlist.findFirst.mockResolvedValue({ walletAddress: 'abc' });
      expect(await service.getWaitlistStatus('abc')).toEqual({ waitlisted: true });
    });

    it('returns waitlisted false if no entry', async () => {
      mockPrisma.cardWaitlist.findFirst.mockResolvedValue(null);
      expect(await service.getWaitlistStatus('abc')).toEqual({ waitlisted: false });
    });
  });

  describe('submitKyc', () => {
    it('creates mock approval in dev mode when rain disabled', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      mockPrisma.cardApplication.create.mockResolvedValue({ id: '1', status: 'KYC_APPROVED' });

      const result = await service.submitKyc('abc', {
        firstName: 'Juan',
        lastName: 'R',
        email: 'j@test.com',
        dateOfBirth: '2000-01-01',
      } as any);
      expect(result.status).toBe('KYC_APPROVED');
      process.env.NODE_ENV = originalEnv;
    });

    it('throws ServiceUnavailableException in production when rain disabled', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      await expect(service.submitKyc('abc', {} as any)).rejects.toThrow(
        ServiceUnavailableException
      );
      process.env.NODE_ENV = originalEnv;
    });

    it('submits to rain when enabled and maps status', async () => {
      mockRain.isEnabled = true;
      mockRain.submitKyc.mockResolvedValue({ id: 'rain-123', applicationStatus: 'approved' });
      mockPrisma.cardApplication.create.mockResolvedValue({ id: '1', status: 'KYC_APPROVED' });

      const result = await service.submitKyc('abc', { firstName: 'Juan' } as any);
      expect(result.rainUserId).toBe('rain-123');
      expect(mockPrisma.cardApplication.create).toHaveBeenCalled();
    });
  });

  describe('getKycStatus', () => {
    it('returns NONE when no application exists', async () => {
      mockPrisma.cardApplication.findFirst.mockResolvedValue(null);
      expect(await service.getKycStatus('abc')).toEqual({ status: 'NONE' });
    });

    it('returns current status from database', async () => {
      mockPrisma.cardApplication.findFirst.mockResolvedValue({ status: 'KYC_APPROVED' });
      expect(await service.getKycStatus('abc')).toEqual({ status: 'KYC_APPROVED' });
    });
  });

  describe('issueCard', () => {
    it('throws if KYC not approved', async () => {
      mockPrisma.cardApplication.findFirst.mockResolvedValue(null);
      await expect(service.issueCard('abc')).rejects.toThrow(BadRequestException);
    });

    it('returns existing card if already issued', async () => {
      mockPrisma.cardApplication.findFirst.mockResolvedValue({
        id: '1',
        rainCardId: 'card-123',
        status: 'CARD_ISSUED',
      });
      const result = await service.issueCard('abc');
      expect(result).toEqual({ cardId: 'card-123', status: 'CARD_ISSUED' });
    });

    it('issues mock card in dev when rain disabled', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      mockPrisma.cardApplication.findFirst.mockResolvedValue({
        id: '1',
        status: 'KYC_APPROVED',
        rainUserId: null,
      });
      mockPrisma.cardApplication.update.mockResolvedValue({});

      const result = await service.issueCard('abc');
      expect(result.cardId).toBe('mock_card_001');
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('getCardBalance', () => {
    it('returns zero balance when no card or rain disabled', async () => {
      mockPrisma.cardApplication.findFirst.mockResolvedValue(null);
      expect(await service.getCardBalance('abc')).toEqual({ available: 0, pending: 0 });
    });

    it('returns rain balance converted from cents', async () => {
      mockPrisma.cardApplication.findFirst.mockResolvedValue({ rainUserId: 'rain-1' });
      mockRain.isEnabled = true;
      mockRain.getBalance.mockResolvedValue({ spendingPower: 5000, balanceDue: 200 });

      const result = await service.getCardBalance('abc');
      expect(result).toEqual({ available: 50, pending: 2 });
    });
  });

  describe('getCardTransactions', () => {
    it('returns empty array when no card', async () => {
      mockPrisma.cardApplication.findFirst.mockResolvedValue(null);
      expect(await service.getCardTransactions('abc')).toEqual([]);
    });

    it('maps rain transactions correctly', async () => {
      mockPrisma.cardApplication.findFirst.mockResolvedValue({ rainUserId: 'rain-1' });
      mockRain.isEnabled = true;
      mockRain.getTransactions.mockResolvedValue([
        {
          id: 'tx1',
          merchantName: 'Amazon',
          merchantCategory: 'online',
          amount: 2500,
          currency: 'USD',
          createdAt: '2026-01-01',
          status: 'settled',
        },
      ]);

      const result = await service.getCardTransactions('abc');
      expect(result[0].amount).toBe(25);
      expect(result[0].merchantCategory).toBe('online');
      expect(result[0].status).toBe('completed');
    });
  });

  describe('freezeCard', () => {
    it('throws NotFoundException when no active card', async () => {
      mockPrisma.cardApplication.findFirst.mockResolvedValue(null);
      await expect(service.freezeCard('abc')).rejects.toThrow(NotFoundException);
    });

    it('freezes card and updates status', async () => {
      mockPrisma.cardApplication.findFirst.mockResolvedValue({ id: '1', rainCardId: 'card-1' });
      mockPrisma.cardApplication.update.mockResolvedValue({});

      const result = await service.freezeCard('abc');
      expect(result).toEqual({ status: 'FROZEN' });
      expect(mockPrisma.cardApplication.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'FROZEN' } })
      );
    });
  });

  describe('unfreezeCard', () => {
    it('throws NotFoundException when no frozen card', async () => {
      mockPrisma.cardApplication.findFirst.mockResolvedValue(null);
      await expect(service.unfreezeCard('abc')).rejects.toThrow(NotFoundException);
    });

    it('unfreezes card and updates status', async () => {
      mockPrisma.cardApplication.findFirst.mockResolvedValue({ id: '1', rainCardId: 'card-1' });
      mockPrisma.cardApplication.update.mockResolvedValue({});

      const result = await service.unfreezeCard('abc');
      expect(result).toEqual({ status: 'CARD_ISSUED' });
    });
  });

  describe('getFundingAddress', () => {
    it('throws NotFoundException when no card', async () => {
      mockPrisma.cardApplication.findFirst.mockResolvedValue(null);
      await expect(service.getFundingAddress('abc')).rejects.toThrow(NotFoundException);
    });

    it('returns cached deposit address', async () => {
      mockPrisma.cardApplication.findFirst.mockResolvedValue({
        depositAddr: '0xabc',
        chainId: 'solana',
      });
      const result = await service.getFundingAddress('abc');
      expect(result).toEqual({ depositAddress: '0xabc', chainId: 'solana' });
    });

    it('returns null depositAddress when rain disabled', async () => {
      mockPrisma.cardApplication.findFirst.mockResolvedValue({
        rainUserId: null,
        depositAddr: null,
      });
      const result = await service.getFundingAddress('abc');
      expect(result).toEqual({ depositAddress: null });
    });
  });
});
