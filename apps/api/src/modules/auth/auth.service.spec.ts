import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: jest.Mocked<JwtService>;
  let prismaService: any;

  beforeEach(() => {
    jwtService = {
      sign: jest.fn().mockReturnValue('mock-token'),
      verify: jest.fn().mockReturnValue({ sub: 'user-id', wallet: 'addr' }),
    } as any;

    prismaService = {
      user: {
        upsert: jest.fn().mockResolvedValue({ id: 'user-1', walletAddress: 'addr' }),
      },
    };

    service = new AuthService(jwtService, prismaService);
  });

  describe('generateNonce', () => {
    it('returns a nonce and formatted message', () => {
      const wallet = '7EqJj2FvNCqiTVJYwcqYgndNeCakBt9dZZpx53bfFu81';
      const result = service.generateNonce(wallet);

      expect(result.nonce).toBeDefined();
      expect(result.nonce.length).toBeGreaterThan(0);
      expect(result.message).toContain('Sign this message to authenticate with MVGA');
      expect(result.message).toContain(wallet);
      expect(result.message).toContain(result.nonce);
    });

    it('generates unique nonces per call', () => {
      const wallet = '7EqJj2FvNCqiTVJYwcqYgndNeCakBt9dZZpx53bfFu81';
      const r1 = service.generateNonce(wallet);
      const r2 = service.generateNonce(wallet);
      expect(r1.nonce).not.toBe(r2.nonce);
    });

    it('overwrites previous nonce for same wallet', () => {
      const wallet = '7EqJj2FvNCqiTVJYwcqYgndNeCakBt9dZZpx53bfFu81';
      service.generateNonce(wallet);
      const r2 = service.generateNonce(wallet);

      const nonces = (service as any).nonces;
      expect(nonces.get(wallet).nonce).toBe(r2.nonce);
    });

    it('sets expiration 5 minutes from now', () => {
      const wallet = '7EqJj2FvNCqiTVJYwcqYgndNeCakBt9dZZpx53bfFu81';
      const before = Date.now();
      service.generateNonce(wallet);
      const after = Date.now();

      const nonces = (service as any).nonces;
      const stored = nonces.get(wallet);
      expect(stored.expiresAt).toBeGreaterThanOrEqual(before + 5 * 60 * 1000);
      expect(stored.expiresAt).toBeLessThanOrEqual(after + 5 * 60 * 1000);
    });
  });

  describe('verify', () => {
    it('throws if no nonce was generated', async () => {
      await expect(service.verify('unknown-wallet', 'sig')).rejects.toThrow(UnauthorizedException);
    });

    it('throws if nonce has expired', async () => {
      const wallet = '7EqJj2FvNCqiTVJYwcqYgndNeCakBt9dZZpx53bfFu81';
      service.generateNonce(wallet);

      // Manually expire the nonce
      const nonces = (service as any).nonces;
      const stored = nonces.get(wallet);
      stored.expiresAt = Date.now() - 1000;
      nonces.set(wallet, stored);

      await expect(service.verify(wallet, 'sig')).rejects.toThrow('Nonce expired');
    });

    it('deletes nonce after expiration check', async () => {
      const wallet = '7EqJj2FvNCqiTVJYwcqYgndNeCakBt9dZZpx53bfFu81';
      service.generateNonce(wallet);

      const nonces = (service as any).nonces;
      const stored = nonces.get(wallet);
      stored.expiresAt = Date.now() - 1000;
      nonces.set(wallet, stored);

      await expect(service.verify(wallet, 'sig')).rejects.toThrow();
      expect(nonces.has(wallet)).toBe(false);
    });

    it('throws UnauthorizedException with specific message when no nonce', async () => {
      try {
        await service.verify('wallet', 'sig');
        fail('should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(UnauthorizedException);
        expect((e as any).message).toBe('No nonce found. Request a nonce first.');
      }
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

    it('throws UnauthorizedException with "Invalid token" message', () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      try {
        service.validateToken('expired-token');
        fail('should have thrown');
      } catch (e) {
        expect((e as any).message).toBe('Invalid token');
      }
    });
  });

  describe('cleanupExpiredNonces', () => {
    it('removes expired nonces', () => {
      const wallet1 = 'wallet1';
      const wallet2 = 'wallet2';
      service.generateNonce(wallet1);
      service.generateNonce(wallet2);

      // Expire wallet1's nonce
      const nonces = (service as any).nonces;
      const stored1 = nonces.get(wallet1);
      stored1.expiresAt = Date.now() - 1000;
      nonces.set(wallet1, stored1);

      service.cleanupExpiredNonces();

      expect(nonces.has(wallet1)).toBe(false);
      expect(nonces.has(wallet2)).toBe(true);
    });

    it('does nothing when no nonces are expired', () => {
      service.generateNonce('wallet1');
      service.generateNonce('wallet2');

      const nonces = (service as any).nonces;
      expect(nonces.size).toBe(2);

      service.cleanupExpiredNonces();
      expect(nonces.size).toBe(2);
    });

    it('cleans all expired nonces in a single pass', () => {
      const wallets = ['w1', 'w2', 'w3', 'w4'];
      wallets.forEach((w) => service.generateNonce(w));

      const nonces = (service as any).nonces;
      // Expire all but w4
      for (const w of ['w1', 'w2', 'w3']) {
        const stored = nonces.get(w);
        stored.expiresAt = Date.now() - 1000;
        nonces.set(w, stored);
      }

      service.cleanupExpiredNonces();
      expect(nonces.size).toBe(1);
      expect(nonces.has('w4')).toBe(true);
    });
  });
});
