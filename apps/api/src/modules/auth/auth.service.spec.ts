/* eslint-disable @typescript-eslint/no-explicit-any */
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: jest.Mocked<JwtService>;
  let prismaService: any;
  let cronLockService: any;

  beforeEach(() => {
    jwtService = {
      sign: jest.fn().mockReturnValue('mock-token'),
      verify: jest.fn().mockReturnValue({ sub: 'user-id', wallet: 'addr' }),
    } as any;

    prismaService = {
      user: {
        upsert: jest.fn().mockResolvedValue({ id: 'user-1', walletAddress: 'addr' }),
      },
      authNonce: {
        upsert: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        delete: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    cronLockService = {
      acquireLock: jest.fn().mockResolvedValue('lock-id'),
      releaseLock: jest.fn().mockResolvedValue(undefined),
    };

    service = new AuthService(jwtService, prismaService, cronLockService);
  });

  describe('generateNonce', () => {
    it('returns a nonce and formatted message', async () => {
      const wallet = '7EqJj2FvNCqiTVJYwcqYgndNeCakBt9dZZpx53bfFu81';
      const result = await service.generateNonce(wallet);

      expect(result.nonce).toBeDefined();
      expect(result.nonce.length).toBe(64); // 32 bytes hex = 64 chars
      expect(result.message).toContain('Sign this message to authenticate with MVGA');
      expect(result.message).toContain(wallet);
      expect(result.message).toContain(result.nonce);
    });

    it('generates unique nonces per call', async () => {
      const wallet = '7EqJj2FvNCqiTVJYwcqYgndNeCakBt9dZZpx53bfFu81';
      const r1 = await service.generateNonce(wallet);
      const r2 = await service.generateNonce(wallet);
      expect(r1.nonce).not.toBe(r2.nonce);
    });

    it('calls prisma upsert to store nonce in DB', async () => {
      const wallet = '7EqJj2FvNCqiTVJYwcqYgndNeCakBt9dZZpx53bfFu81';
      await service.generateNonce(wallet);

      expect(prismaService.authNonce.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { walletAddress: wallet },
          create: expect.objectContaining({ walletAddress: wallet }),
          update: expect.objectContaining({ used: false }),
        })
      );
    });
  });

  describe('verify', () => {
    it('throws if no nonce was generated', async () => {
      // updateMany returns 0 (no matching nonce), findUnique also returns null
      prismaService.authNonce.updateMany.mockResolvedValue({ count: 0 });
      prismaService.authNonce.findUnique.mockResolvedValue(null);
      await expect(service.verify('unknown-wallet', 'sig')).rejects.toThrow(UnauthorizedException);
    });

    it('throws if nonce has expired', async () => {
      // updateMany returns 0 (expired nonce not matched), findUnique returns expired nonce
      prismaService.authNonce.updateMany.mockResolvedValue({ count: 0 });
      prismaService.authNonce.findUnique.mockResolvedValue({
        id: 'nonce-1',
        walletAddress: 'wallet',
        nonce: 'test-nonce',
        expiresAt: new Date(Date.now() - 1000),
        used: false,
      });

      await expect(service.verify('wallet', 'sig')).rejects.toThrow('Nonce expired');
      expect(prismaService.authNonce.delete).toHaveBeenCalled();
    });

    it('throws if nonce is already used', async () => {
      // updateMany returns 0 (used=true not matched), findUnique returns used nonce
      prismaService.authNonce.updateMany.mockResolvedValue({ count: 0 });
      prismaService.authNonce.findUnique.mockResolvedValue({
        id: 'nonce-1',
        walletAddress: 'wallet',
        nonce: 'test-nonce',
        expiresAt: new Date(Date.now() + 300000),
        used: true,
      });

      await expect(service.verify('wallet', 'sig')).rejects.toThrow('Nonce already used');
    });
  });

  describe('validateToken', () => {
    it('returns decoded token on success', () => {
      const result = service.validateToken('valid-token');
      expect(result).toEqual({ sub: 'user-id', wallet: 'addr' });
      expect(jwtService.verify).toHaveBeenCalledWith('valid-token');
    });

    it('throws UnauthorizedException on invalid token', () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('invalid');
      });

      expect(() => service.validateToken('bad-token')).toThrow(UnauthorizedException);
    });
  });

  describe('cleanupExpiredNonces', () => {
    it('acquires lock and cleans up expired nonces', async () => {
      prismaService.authNonce.deleteMany.mockResolvedValue({ count: 3 });
      await service.cleanupExpiredNonces();

      expect(cronLockService.acquireLock).toHaveBeenCalledWith('nonce-cleanup', 60000);
      expect(prismaService.authNonce.deleteMany).toHaveBeenCalled();
      expect(cronLockService.releaseLock).toHaveBeenCalledWith('lock-id');
    });

    it('skips if lock cannot be acquired', async () => {
      cronLockService.acquireLock.mockResolvedValue(null);
      await service.cleanupExpiredNonces();

      expect(prismaService.authNonce.deleteMany).not.toHaveBeenCalled();
    });
  });
});
