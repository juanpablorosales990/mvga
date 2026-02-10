/* eslint-disable @typescript-eslint/no-explicit-any */
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
        findUnique: jest.fn(),
        update: jest.fn(),
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

  describe('getProfile', () => {
    it('returns profile data for a valid user', async () => {
      prismaService.user.findUnique.mockResolvedValue({
        walletAddress: 'addr',
        email: 'test@mvga.io',
        displayName: 'Juan',
        username: 'juan',
      });

      const result = await service.getProfile('user-1');
      expect(result).toEqual({
        walletAddress: 'addr',
        email: 'test@mvga.io',
        displayName: 'Juan',
        username: 'juan',
      });
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: { walletAddress: true, email: true, displayName: true, username: true },
      });
    });

    it('returns null for a non-existent user', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);
      const result = await service.getProfile('unknown');
      expect(result).toBeNull();
    });
  });

  describe('updateProfile', () => {
    it('updates display name and email', async () => {
      prismaService.user.update.mockResolvedValue({
        walletAddress: 'addr',
        email: 'new@mvga.io',
        displayName: 'New Name',
        username: null,
      });

      const result = await service.updateProfile('user-1', {
        email: 'new@mvga.io',
        displayName: 'New Name',
      });

      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { email: 'new@mvga.io', displayName: 'New Name' },
        select: { walletAddress: true, email: true, displayName: true, username: true },
      });
      expect(result.email).toBe('new@mvga.io');
      expect(result.displayName).toBe('New Name');
    });

    it('lowercases username before saving', async () => {
      prismaService.user.update.mockResolvedValue({
        walletAddress: 'addr',
        email: null,
        displayName: null,
        username: 'juanr',
      });

      await service.updateProfile('user-1', { username: 'JuanR' });

      expect(prismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { username: 'juanr' },
        })
      );
    });

    it('throws ConflictException on duplicate email', async () => {
      const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        clientVersion: '5.0.0',
        meta: { target: ['email'] },
      });
      prismaService.user.update.mockRejectedValue(p2002);

      await expect(service.updateProfile('user-1', { email: 'taken@mvga.io' })).rejects.toThrow(
        ConflictException
      );

      await expect(service.updateProfile('user-1', { email: 'taken@mvga.io' })).rejects.toThrow(
        'Email already in use'
      );
    });

    it('throws ConflictException on duplicate username', async () => {
      const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        clientVersion: '5.0.0',
        meta: { target: ['username'] },
      });
      prismaService.user.update.mockRejectedValue(p2002);

      await expect(service.updateProfile('user-1', { username: 'taken' })).rejects.toThrow(
        'Username already taken'
      );
    });

    it('only includes provided fields in update data', async () => {
      prismaService.user.update.mockResolvedValue({
        walletAddress: 'addr',
        email: null,
        displayName: 'Only Name',
        username: null,
      });

      await service.updateProfile('user-1', { displayName: 'Only Name' });

      expect(prismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { displayName: 'Only Name' },
        })
      );
    });
  });

  describe('checkUsername', () => {
    it('returns available=true when username is free', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);
      const result = await service.checkUsername('newuser');
      expect(result).toEqual({ available: true });
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { username: 'newuser' },
        select: { id: true },
      });
    });

    it('returns available=false when username is taken', async () => {
      prismaService.user.findUnique.mockResolvedValue({ id: 'user-2' });
      const result = await service.checkUsername('taken');
      expect(result).toEqual({ available: false });
    });

    it('lowercases the username before checking', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);
      await service.checkUsername('JuanR');
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { username: 'juanr' },
        select: { id: true },
      });
    });
  });
});
