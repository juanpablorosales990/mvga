import { BadRequestException } from '@nestjs/common';
import { ReferralsService } from './referrals.service';

describe('ReferralsService', () => {
  let service: ReferralsService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      referralCode: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      referral: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const mockConfig = {
      get: jest.fn((key: string, defaultVal?: string) => {
        if (key === 'MVGA_TOKEN_MINT') return 'DRX65kM2n5CLTpdjJCemZvkUwE98ou4RpHrd8Z3GH5Qh';
        if (key === 'TREASURY_WALLET_KEYPAIR') return undefined;
        return defaultVal;
      }),
    };

    service = new ReferralsService(
      mockPrisma,
      {} as any, // txLogger
      {} as any, // solana
      mockConfig as any
    );
  });

  describe('getOrCreateCode', () => {
    it('returns existing code for wallet', async () => {
      mockPrisma.referralCode.findUnique.mockResolvedValueOnce({
        code: 'ABC123',
        walletAddress: 'wallet',
      });

      const result = await service.getOrCreateCode('wallet');
      expect(result.code).toBe('ABC123');
    });

    it('creates new code when none exists', async () => {
      mockPrisma.referralCode.findUnique
        .mockResolvedValueOnce(null) // First: check by walletAddress
        .mockResolvedValueOnce(null); // Second: check by generated code (unique check)

      mockPrisma.referralCode.create.mockResolvedValue({
        code: 'NEW123',
        walletAddress: 'wallet',
      });

      const result = await service.getOrCreateCode('wallet');
      expect(result.code).toBe('NEW123');
      expect(mockPrisma.referralCode.create).toHaveBeenCalled();
    });

    it('generates 6-character alphanumeric code', async () => {
      const generatedCode = (service as any).generateCode();
      expect(generatedCode).toHaveLength(6);
      expect(generatedCode).toMatch(/^[A-Z2-9]+$/);
    });

    it('excludes ambiguous characters (0, 1, I, O)', () => {
      // Generate many codes and check none contain ambiguous chars
      for (let i = 0; i < 100; i++) {
        const code = (service as any).generateCode();
        expect(code).not.toMatch(/[01IO]/);
      }
    });
  });

  describe('claimReferral', () => {
    it('throws for invalid code', async () => {
      mockPrisma.referralCode.findUnique.mockResolvedValue(null);

      await expect(service.claimReferral('referee-wallet', 'BADCODE')).rejects.toThrow(
        'Invalid referral code'
      );
    });

    it('prevents self-referral', async () => {
      mockPrisma.referralCode.findUnique.mockResolvedValue({
        id: 'code-1',
        code: 'ABC123',
        walletAddress: 'same-wallet',
      });

      await expect(service.claimReferral('same-wallet', 'ABC123')).rejects.toThrow(
        'Cannot use your own referral code'
      );
    });

    it('prevents duplicate claims', async () => {
      mockPrisma.referralCode.findUnique.mockResolvedValue({
        id: 'code-1',
        code: 'ABC123',
        walletAddress: 'referrer-wallet',
      });
      mockPrisma.referral.findUnique.mockResolvedValue({ id: 'existing-referral' });

      await expect(service.claimReferral('referee-wallet', 'ABC123')).rejects.toThrow(
        'Referral already claimed'
      );
    });

    it('creates referral record on success', async () => {
      mockPrisma.referralCode.findUnique.mockResolvedValue({
        id: 'code-1',
        code: 'ABC123',
        walletAddress: 'referrer-wallet',
      });
      mockPrisma.referral.findUnique.mockResolvedValue(null);
      mockPrisma.referral.create.mockResolvedValue({
        id: 'ref-1',
        referrerAddress: 'referrer-wallet',
        refereeAddress: 'referee-wallet',
        bonusPaid: false,
        amount: 100,
      });

      const result = await service.claimReferral('referee-wallet', 'ABC123');
      expect(result.referralId).toBe('ref-1');
      expect(result.amount).toBe(100);
    });

    it('records correct bonus amount', async () => {
      mockPrisma.referralCode.findUnique.mockResolvedValue({
        id: 'code-1',
        code: 'ABC123',
        walletAddress: 'referrer-wallet',
      });
      mockPrisma.referral.findUnique.mockResolvedValue(null);
      mockPrisma.referral.create.mockResolvedValue({
        id: 'ref-1',
        bonusPaid: false,
        amount: 100,
      });

      const result = await service.claimReferral('referee-wallet', 'ABC123');
      expect(result.amount).toBe(100);
    });
  });

  describe('getStats', () => {
    it('returns empty stats for wallet with no code', async () => {
      mockPrisma.referralCode.findUnique.mockResolvedValue(null);

      const result = await service.getStats('wallet');
      expect(result.code).toBeNull();
      expect(result.totalReferrals).toBe(0);
      expect(result.totalEarned).toBe(0);
      expect(result.referrals).toEqual([]);
    });

    it('returns stats with referral data', async () => {
      mockPrisma.referralCode.findUnique.mockResolvedValue({
        code: 'ABC123',
        referrals: [
          {
            refereeAddress: 'ABCDEFGH12345678',
            bonusPaid: true,
            amount: 100,
            createdAt: new Date(),
          },
          {
            refereeAddress: 'XYZ98765ABCDEFGH',
            bonusPaid: false,
            amount: 100,
            createdAt: new Date(),
          },
        ],
      });

      const result = await service.getStats('wallet');
      expect(result.code).toBe('ABC123');
      expect(result.totalReferrals).toBe(2);
      expect(result.totalEarned).toBe(100); // Only 1 paid
      expect(result.referrals).toHaveLength(2);
    });

    it('truncates referee addresses in stats', async () => {
      mockPrisma.referralCode.findUnique.mockResolvedValue({
        code: 'ABC123',
        referrals: [
          {
            refereeAddress: '7EqJj2FvNCqiTVJYwcqYgndNeCakBt9dZZpx53bfFu81',
            bonusPaid: true,
            amount: 100,
            createdAt: new Date(),
          },
        ],
      });

      const result = await service.getStats('wallet');
      const addr = result.referrals[0].refereeAddress;
      expect(addr).toContain('...');
      expect(addr.length).toBeLessThan(44); // Full Solana address is 44 chars
    });

    it('calculates total earned correctly', async () => {
      mockPrisma.referralCode.findUnique.mockResolvedValue({
        code: 'ABC123',
        referrals: [
          { refereeAddress: 'a'.repeat(44), bonusPaid: true, amount: 100, createdAt: new Date() },
          { refereeAddress: 'b'.repeat(44), bonusPaid: true, amount: 100, createdAt: new Date() },
          { refereeAddress: 'c'.repeat(44), bonusPaid: true, amount: 100, createdAt: new Date() },
          { refereeAddress: 'd'.repeat(44), bonusPaid: false, amount: 100, createdAt: new Date() },
        ],
      });

      const result = await service.getStats('wallet');
      expect(result.totalReferrals).toBe(4);
      expect(result.totalEarned).toBe(300); // 3 paid * 100
    });
  });
});
