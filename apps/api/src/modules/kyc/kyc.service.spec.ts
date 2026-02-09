/* eslint-disable @typescript-eslint/no-explicit-any */
import { ServiceUnavailableException, BadRequestException } from '@nestjs/common';
import { KycService } from './kyc.service';

describe('KycService', () => {
  let service: KycService;
  let mockPrisma: any;
  let mockSumsub: any;
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV;
    mockPrisma = {
      userKyc: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
      },
    };

    mockSumsub = {
      isEnabled: false,
      createApplicant: jest.fn(),
      getAccessToken: jest.fn(),
      getApplicantStatus: jest.fn(),
      parseWebhookPayload: jest.fn(),
    };

    service = new KycService(mockPrisma, mockSumsub);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe('createSession', () => {
    it('returns mock token in dev when sumsub disabled', async () => {
      process.env.NODE_ENV = 'development';
      mockPrisma.userKyc.upsert.mockResolvedValue({});

      const result = await service.createSession('user-1', 'wallet-abc');
      expect(result).toEqual({ token: 'mock_token', applicantId: 'mock_001', mock: true });
      expect(mockPrisma.userKyc.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          create: expect.objectContaining({ status: 'APPROVED', provider: 'MOCK' }),
        })
      );
    });

    it('throws ServiceUnavailableException in production when disabled', async () => {
      process.env.NODE_ENV = 'production';
      await expect(service.createSession('user-1', 'wallet-abc')).rejects.toThrow(
        ServiceUnavailableException
      );
    });

    it('creates applicant and returns token when sumsub enabled', async () => {
      mockSumsub.isEnabled = true;
      mockPrisma.userKyc.findUnique.mockResolvedValue(null);
      mockSumsub.createApplicant.mockResolvedValue('applicant-123');
      mockSumsub.getAccessToken.mockResolvedValue({ token: 'sdk_token_abc' });
      mockPrisma.userKyc.upsert.mockResolvedValue({});

      const result = await service.createSession('user-1', 'wallet-abc');
      expect(result).toEqual({ token: 'sdk_token_abc', applicantId: 'applicant-123' });
      expect(mockSumsub.createApplicant).toHaveBeenCalledWith('wallet-abc');
    });

    it('reuses existing externalId when available', async () => {
      mockSumsub.isEnabled = true;
      mockPrisma.userKyc.findUnique.mockResolvedValue({ externalId: 'existing-id' });
      mockSumsub.getAccessToken.mockResolvedValue({ token: 'tok' });
      mockPrisma.userKyc.upsert.mockResolvedValue({});

      await service.createSession('user-1', 'wallet-abc');
      expect(mockSumsub.createApplicant).not.toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    it('returns UNVERIFIED when no KYC record', async () => {
      mockPrisma.userKyc.findUnique.mockResolvedValue(null);
      expect(await service.getStatus('user-1')).toEqual({ status: 'UNVERIFIED', tier: 0 });
    });

    it('returns current status from database', async () => {
      mockPrisma.userKyc.findUnique.mockResolvedValue({
        status: 'APPROVED',
        tier: 1,
        rejectionReason: null,
      });
      expect(await service.getStatus('user-1')).toEqual({
        status: 'APPROVED',
        tier: 1,
        rejectionReason: null,
      });
    });

    it('includes rejection reason when rejected', async () => {
      mockPrisma.userKyc.findUnique.mockResolvedValue({
        status: 'REJECTED',
        tier: 0,
        rejectionReason: 'ID expired',
      });
      const result = await service.getStatus('user-1');
      expect(result.status).toBe('REJECTED');
      expect(result.rejectionReason).toBe('ID expired');
    });
  });

  describe('handleWebhook', () => {
    it('throws BadRequestException on invalid signature', async () => {
      mockSumsub.parseWebhookPayload.mockReturnValue(null);
      await expect(service.handleWebhook('body', 'bad-sig')).rejects.toThrow(BadRequestException);
    });

    it('approves user on GREEN reviewAnswer', async () => {
      mockSumsub.parseWebhookPayload.mockReturnValue({
        type: 'applicantReviewed',
        applicantId: 'ext-123',
        reviewResult: { reviewAnswer: 'GREEN' },
      });
      mockPrisma.userKyc.findFirst.mockResolvedValue({ id: 'kyc-1', externalId: 'ext-123' });
      mockPrisma.userKyc.update.mockResolvedValue({});

      await service.handleWebhook('body', 'sig');
      expect(mockPrisma.userKyc.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'kyc-1' },
          data: expect.objectContaining({ status: 'APPROVED', tier: 1 }),
        })
      );
    });

    it('rejects user on RED reviewAnswer', async () => {
      mockSumsub.parseWebhookPayload.mockReturnValue({
        type: 'applicantReviewed',
        applicantId: 'ext-123',
        reviewResult: { reviewAnswer: 'RED', rejectLabels: ['ID_EXPIRED'] },
      });
      mockPrisma.userKyc.findFirst.mockResolvedValue({ id: 'kyc-1', externalId: 'ext-123' });
      mockPrisma.userKyc.update.mockResolvedValue({});

      await service.handleWebhook('body', 'sig');
      expect(mockPrisma.userKyc.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'REJECTED', rejectionReason: 'ID_EXPIRED' }),
        })
      );
    });

    it('ignores webhook for unknown applicant', async () => {
      mockSumsub.parseWebhookPayload.mockReturnValue({
        type: 'applicantReviewed',
        applicantId: 'unknown',
        reviewResult: { reviewAnswer: 'GREEN' },
      });
      mockPrisma.userKyc.findFirst.mockResolvedValue(null);

      const result = await service.handleWebhook('body', 'sig');
      expect(result).toEqual({ ok: true });
      expect(mockPrisma.userKyc.update).not.toHaveBeenCalled();
    });
  });

  describe('isKycApproved', () => {
    it('returns true when status is APPROVED', async () => {
      mockPrisma.userKyc.findUnique.mockResolvedValue({ status: 'APPROVED' });
      expect(await service.isKycApproved('user-1')).toBe(true);
    });

    it('returns false when status is PENDING', async () => {
      mockPrisma.userKyc.findUnique.mockResolvedValue({ status: 'PENDING' });
      expect(await service.isKycApproved('user-1')).toBe(false);
    });

    it('returns false when no KYC record', async () => {
      mockPrisma.userKyc.findUnique.mockResolvedValue(null);
      expect(await service.isKycApproved('user-1')).toBe(false);
    });

    it('returns false when status is REJECTED', async () => {
      mockPrisma.userKyc.findUnique.mockResolvedValue({ status: 'REJECTED' });
      expect(await service.isKycApproved('user-1')).toBe(false);
    });
  });
});
