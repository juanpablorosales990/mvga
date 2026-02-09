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
  let mockLithic: any;
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV;
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

    mockLithic = {
      isEnabled: false,
      submitKyc: jest.fn(),
      getUserStatus: jest.fn(),
      issueCard: jest.fn(),
      getCard: jest.fn(),
      getBalance: jest.fn(),
      getTransactions: jest.fn(),
      freezeCard: jest.fn(),
      unfreezeCard: jest.fn(),
    };

    service = new BankingService(mockPrisma, mockRain, mockLithic);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
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
    it('creates mock approval in dev mode when both providers disabled', async () => {
      process.env.NODE_ENV = 'development';
      mockPrisma.cardApplication.create.mockResolvedValue({ id: '1', status: 'KYC_APPROVED' });

      const result = await service.submitKyc('abc', {
        firstName: 'Juan',
        lastName: 'R',
        email: 'j@test.com',
        dateOfBirth: '2000-01-01',
      } as any);
      expect(result.status).toBe('KYC_APPROVED');
    });

    it('throws ServiceUnavailableException in production when both providers disabled', async () => {
      process.env.NODE_ENV = 'production';

      await expect(service.submitKyc('abc', {} as any)).rejects.toThrow(
        ServiceUnavailableException
      );
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

    it('returns existing card if already issued (Rain)', async () => {
      mockPrisma.cardApplication.findFirst.mockResolvedValue({
        id: '1',
        rainCardId: 'card-123',
        status: 'CARD_ISSUED',
      });
      const result = await service.issueCard('abc');
      expect(result).toEqual({ cardId: 'card-123', status: 'CARD_ISSUED' });
    });

    it('returns existing card if already issued (Lithic)', async () => {
      mockPrisma.cardApplication.findFirst.mockResolvedValue({
        id: '1',
        lithicCardToken: 'lith_card_123',
        rainCardId: null,
        status: 'CARD_ISSUED',
      });
      const result = await service.issueCard('abc');
      expect(result).toEqual({ cardId: 'lith_card_123', status: 'CARD_ISSUED' });
    });

    it('issues mock card in dev when both providers disabled', async () => {
      process.env.NODE_ENV = 'development';
      mockPrisma.cardApplication.findFirst.mockResolvedValue({
        id: '1',
        status: 'KYC_APPROVED',
        provider: 'NONE',
        rainUserId: null,
        lithicAccountToken: null,
      });
      mockPrisma.cardApplication.update.mockResolvedValue({});

      const result = await service.issueCard('abc');
      expect(result.cardId).toBe('mock_card_001');
    });
  });

  describe('getCardBalance', () => {
    it('returns zero balance when no card', async () => {
      mockPrisma.cardApplication.findFirst.mockResolvedValue(null);
      expect(await service.getCardBalance('abc')).toEqual({ available: 0, pending: 0 });
    });

    it('returns rain balance converted from cents', async () => {
      mockPrisma.cardApplication.findFirst.mockResolvedValue({
        provider: 'RAIN',
        rainUserId: 'rain-1',
      });
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
      mockPrisma.cardApplication.findFirst.mockResolvedValue({
        provider: 'RAIN',
        rainUserId: 'rain-1',
      });
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

    it('freezes Rain card and returns card details', async () => {
      mockPrisma.cardApplication.findFirst.mockResolvedValue({
        id: '1',
        rainCardId: 'card-1',
        lithicCardToken: null,
        lithicAccountToken: null,
        rainUserId: null,
        provider: 'RAIN',
      });
      mockPrisma.cardApplication.update.mockResolvedValue({});

      const result = await service.freezeCard('abc');
      expect(result.status).toBe('frozen');
      expect(result.brand).toBe('visa');
    });
  });

  describe('unfreezeCard', () => {
    it('throws NotFoundException when no frozen card', async () => {
      mockPrisma.cardApplication.findFirst.mockResolvedValue(null);
      await expect(service.unfreezeCard('abc')).rejects.toThrow(NotFoundException);
    });

    it('unfreezes Rain card and returns card details', async () => {
      mockPrisma.cardApplication.findFirst.mockResolvedValue({
        id: '1',
        rainCardId: 'card-1',
        lithicCardToken: null,
        lithicAccountToken: null,
        rainUserId: null,
        provider: 'RAIN',
      });
      mockPrisma.cardApplication.update.mockResolvedValue({});

      const result = await service.unfreezeCard('abc');
      expect(result.status).toBe('active');
      expect(result.brand).toBe('visa');
    });
  });

  describe('fundCard', () => {
    it('throws NotFoundException when no card', async () => {
      mockPrisma.cardApplication.findFirst.mockResolvedValue(null);
      await expect(service.fundCard('abc')).rejects.toThrow(NotFoundException);
    });

    it('returns cached deposit address with balance (Rain)', async () => {
      mockPrisma.cardApplication.findFirst.mockResolvedValue({
        provider: 'RAIN',
        depositAddr: '0xabc',
        chainId: 'solana',
        rainUserId: null,
      });
      const result = await service.fundCard('abc');
      expect(result.success).toBe(true);
      expect(result.depositAddress).toBe('0xabc');
      expect(result.newBalance).toEqual({ available: 0, pending: 0 });
    });

    it('returns success false when no deposit address and rain disabled', async () => {
      mockPrisma.cardApplication.findFirst.mockResolvedValue({
        provider: 'RAIN',
        rainUserId: null,
        depositAddr: null,
      });
      const result = await service.fundCard('abc');
      expect(result.success).toBe(false);
      expect(result.depositAddress).toBeNull();
      expect(result.newBalance).toEqual({ available: 0, pending: 0 });
    });
  });

  // ─── Lithic Provider ──────────────────────────────────────────────

  describe('Lithic provider', () => {
    it('prefers Lithic over Rain when both enabled', async () => {
      mockLithic.isEnabled = true;
      mockRain.isEnabled = true;
      mockLithic.submitKyc.mockResolvedValue({
        token: 'ah_123',
        accountToken: 'acct_123',
        status: 'ACCEPTED',
      });
      mockPrisma.cardApplication.create.mockResolvedValue({
        id: '1',
        status: 'KYC_APPROVED',
      });

      const result = await service.submitKyc('abc', {
        firstName: 'Juan',
        lastName: 'R',
        email: 'j@test.com',
        birthDate: '2000-01-01',
        address: {
          line1: '123 St',
          city: 'Miami',
          region: 'FL',
          postalCode: '33101',
          countryCode: 'US',
        },
      } as any);

      expect(result.lithicAccountToken).toBe('acct_123');
      expect(mockLithic.submitKyc).toHaveBeenCalled();
      expect(mockRain.submitKyc).not.toHaveBeenCalled();
    });

    it('falls back to Rain when only Rain enabled', async () => {
      mockRain.isEnabled = true;
      mockRain.submitKyc.mockResolvedValue({ id: 'rain-1', applicationStatus: 'approved' });
      mockPrisma.cardApplication.create.mockResolvedValue({ id: '1', status: 'KYC_APPROVED' });

      const result = await service.submitKyc('abc', { firstName: 'Juan' } as any);
      expect(result.rainUserId).toBe('rain-1');
      expect(mockLithic.submitKyc).not.toHaveBeenCalled();
    });

    it('issues card via Lithic for LITHIC-provider apps', async () => {
      mockLithic.isEnabled = true;
      mockPrisma.cardApplication.findFirst.mockResolvedValue({
        id: '1',
        status: 'KYC_APPROVED',
        provider: 'LITHIC',
        lithicAccountToken: 'acct_123',
        lithicCardToken: null,
        rainCardId: null,
        rainUserId: null,
      });
      mockLithic.issueCard.mockResolvedValue({
        token: 'card_tok_1',
        type: 'VIRTUAL',
        state: 'OPEN',
        last4: '4242',
        expMonth: 12,
        expYear: 2028,
      });
      mockPrisma.cardApplication.update.mockResolvedValue({});

      const result = await service.issueCard('abc');
      expect(result.cardId).toBe('card_tok_1');
      expect(result.last4).toBe('4242');
      expect(result.status).toBe('CARD_ISSUED');
      expect(mockRain.deployContract).not.toHaveBeenCalled();
      expect(mockRain.issueCard).not.toHaveBeenCalled();
    });

    it('gets Lithic balance and converts cents to dollars', async () => {
      mockLithic.isEnabled = true;
      mockPrisma.cardApplication.findFirst.mockResolvedValue({
        provider: 'LITHIC',
        lithicFinancialAccountToken: 'fa_123',
      });
      mockLithic.getBalance.mockResolvedValue({ availableAmount: 12500, pendingAmount: 300 });

      const result = await service.getCardBalance('abc');
      expect(result).toEqual({ available: 125, pending: 3 });
    });

    it('freezes Lithic card', async () => {
      mockLithic.isEnabled = true;
      mockLithic.freezeCard.mockResolvedValue(undefined);
      mockLithic.getCard.mockResolvedValue({
        token: 'card_tok_1',
        type: 'VIRTUAL',
        state: 'PAUSED',
        last4: '4242',
        expMonth: 12,
        expYear: 2028,
      });
      mockPrisma.cardApplication.findFirst.mockResolvedValue({
        id: '1',
        provider: 'LITHIC',
        lithicCardToken: 'card_tok_1',
        lithicAccountToken: 'acct_123',
        rainCardId: null,
        rainUserId: null,
      });
      mockPrisma.cardApplication.update.mockResolvedValue({});

      const result = await service.freezeCard('abc');
      expect(result.status).toBe('frozen');
      expect(result.id).toBe('card_tok_1');
      expect(result.last4).toBe('4242');
      expect(mockLithic.freezeCard).toHaveBeenCalledWith('card_tok_1');
      expect(mockRain.freezeCard).not.toHaveBeenCalled();
    });

    it('maps Lithic transaction statuses correctly', async () => {
      mockLithic.isEnabled = true;
      mockPrisma.cardApplication.findFirst.mockResolvedValue({
        provider: 'LITHIC',
        lithicAccountToken: 'acct_123',
      });
      mockLithic.getTransactions.mockResolvedValue([
        {
          token: 'tx1',
          merchantName: 'Amazon',
          merchantCategory: 'online',
          amount: 2500,
          currency: 'USD',
          status: 'SETTLED',
          created: '2026-01-01',
        },
        {
          token: 'tx2',
          merchantName: 'Test',
          merchantCategory: '',
          amount: 100,
          currency: 'USD',
          status: 'DECLINED',
          created: '2026-01-02',
        },
        {
          token: 'tx3',
          merchantName: 'Pending',
          merchantCategory: '',
          amount: 500,
          currency: 'USD',
          status: 'PENDING',
          created: '2026-01-03',
        },
        {
          token: 'tx4',
          merchantName: 'Void',
          merchantCategory: '',
          amount: 300,
          currency: 'USD',
          status: 'VOIDED',
          created: '2026-01-04',
        },
      ]);

      const result = await service.getCardTransactions('abc');
      expect(result).toHaveLength(4);
      expect(result[0].amount).toBe(25);
      expect(result[0].status).toBe('completed');
      expect(result[1].status).toBe('declined');
      expect(result[2].status).toBe('pending');
      expect(result[3].status).toBe('declined');
    });

    it('fundCard returns null depositAddress for Lithic provider', async () => {
      mockLithic.isEnabled = true;
      mockLithic.getBalance.mockResolvedValue({ availableAmount: 5000, pendingAmount: 0 });
      mockPrisma.cardApplication.findFirst.mockResolvedValue({
        provider: 'LITHIC',
        lithicFinancialAccountToken: 'fa_123',
      });

      const result = await service.fundCard('abc');
      expect(result.success).toBe(true);
      expect(result.depositAddress).toBeNull();
      expect(result.newBalance).toEqual({ available: 50, pending: 0 });
      expect(mockRain.getContracts).not.toHaveBeenCalled();
    });
  });
});
