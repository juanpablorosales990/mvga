/* eslint-disable @typescript-eslint/no-explicit-any */
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Keypair } from '@solana/web3.js';
import { SocialService } from './social.service';

describe('SocialService', () => {
  let service: SocialService;
  let mockPrisma: any;
  let wallet: string;
  let userId: string;

  beforeEach(() => {
    wallet = Keypair.generate().publicKey.toBase58();
    userId = 'user-' + Math.random().toString(36).slice(2, 8);

    mockPrisma = {
      user: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      contact: {
        findMany: jest.fn(),
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
    };

    service = new SocialService(mockPrisma);
  });

  // ── lookupUser ─────────────────────────────────────────────────────

  describe('lookupUser', () => {
    it('finds user by username', async () => {
      const mockUser = {
        walletAddress: wallet,
        displayName: 'Juan',
        username: 'juan',
        citizenNumber: 1,
      };
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      const result = await service.lookupUser({ username: 'juan' });

      expect(result.walletAddress).toBe(wallet);
      expect(result.displayName).toBe('Juan');
      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { username: 'juan' },
        select: {
          walletAddress: true,
          displayName: true,
          username: true,
          citizenNumber: true,
        },
      });
    });

    it('finds user by citizen number', async () => {
      const mockUser = {
        walletAddress: wallet,
        displayName: 'Maria',
        username: 'maria',
        citizenNumber: 42,
      };
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      const result = await service.lookupUser({ citizen: '42' });

      expect(result.citizenNumber).toBe(42);
      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { citizenNumber: 42 },
        select: expect.any(Object),
      });
    });

    it('throws NotFoundException when user not found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(service.lookupUser({ username: 'nonexistent' })).rejects.toThrow(
        NotFoundException
      );
    });

    it('throws BadRequestException when no params provided', async () => {
      await expect(service.lookupUser({})).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for invalid citizen number', async () => {
      await expect(service.lookupUser({ citizen: 'abc' })).rejects.toThrow(BadRequestException);
    });

    it('lowercases username for lookup', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        walletAddress: wallet,
        displayName: null,
        username: 'juan',
        citizenNumber: null,
      });

      await service.lookupUser({ username: 'JUAN' });

      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { username: 'juan' },
        })
      );
    });
  });

  // ── getContacts ────────────────────────────────────────────────────

  describe('getContacts', () => {
    it('returns contacts with resolved profiles', async () => {
      const contactAddr = Keypair.generate().publicKey.toBase58();
      mockPrisma.contact.findMany.mockResolvedValue([
        {
          id: 'c1',
          contactAddress: contactAddr,
          label: 'Mom',
          isFavorite: true,
          createdAt: new Date(),
        },
      ]);
      mockPrisma.user.findMany.mockResolvedValue([
        {
          walletAddress: contactAddr,
          displayName: 'Mamá',
          username: 'mama',
          citizenNumber: 5,
        },
      ]);

      const result = await service.getContacts(userId);

      expect(result).toHaveLength(1);
      expect(result[0].label).toBe('Mom');
      expect(result[0].displayName).toBe('Mamá');
      expect(result[0].username).toBe('mama');
    });

    it('returns null profile for non-MVGA contacts', async () => {
      const externalAddr = Keypair.generate().publicKey.toBase58();
      mockPrisma.contact.findMany.mockResolvedValue([
        {
          id: 'c2',
          contactAddress: externalAddr,
          label: 'Exchange',
          isFavorite: false,
          createdAt: new Date(),
        },
      ]);
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await service.getContacts(userId);

      expect(result[0].displayName).toBeNull();
      expect(result[0].username).toBeNull();
      expect(result[0].citizenNumber).toBeNull();
    });

    it('returns empty array when no contacts', async () => {
      mockPrisma.contact.findMany.mockResolvedValue([]);
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await service.getContacts(userId);
      expect(result).toEqual([]);
    });
  });

  // ── syncContacts ───────────────────────────────────────────────────

  describe('syncContacts', () => {
    it('syncs contacts successfully', async () => {
      const addr1 = Keypair.generate().publicKey.toBase58();
      mockPrisma.contact.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.contact.createMany.mockResolvedValue({ count: 1 });

      const result = await service.syncContacts(userId, [{ label: 'Friend', address: addr1 }]);

      expect(result.synced).toBe(1);
    });

    it('handles empty contacts array', async () => {
      mockPrisma.contact.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.contact.createMany.mockResolvedValue({ count: 0 });

      const result = await service.syncContacts(userId, []);
      expect(result.synced).toBe(0);
    });

    it('throws when exceeding 200 contacts', async () => {
      const contacts = Array.from({ length: 201 }, (_, i) => ({
        label: `Contact ${i}`,
        address: Keypair.generate().publicKey.toBase58(),
      }));

      await expect(service.syncContacts(userId, contacts)).rejects.toThrow(BadRequestException);
    });
  });

  // ── removeContact ──────────────────────────────────────────────────

  describe('removeContact', () => {
    it('removes contact successfully', async () => {
      mockPrisma.contact.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.removeContact(userId, wallet);
      expect(result.deleted).toBe(true);
    });

    it('throws NotFoundException when contact not found', async () => {
      mockPrisma.contact.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.removeContact(userId, wallet)).rejects.toThrow(NotFoundException);
    });
  });

  // ── resolveAddresses ───────────────────────────────────────────────

  describe('resolveAddresses', () => {
    it('resolves known addresses', async () => {
      const addr1 = Keypair.generate().publicKey.toBase58();
      mockPrisma.user.findMany.mockResolvedValue([
        {
          walletAddress: addr1,
          displayName: 'Known User',
          username: 'known',
          citizenNumber: 10,
        },
      ]);

      const result = await service.resolveAddresses([addr1]);

      expect(result).toHaveLength(1);
      expect(result[0].displayName).toBe('Known User');
      expect(result[0].username).toBe('known');
    });

    it('returns nulls for unknown addresses', async () => {
      const unknownAddr = Keypair.generate().publicKey.toBase58();
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await service.resolveAddresses([unknownAddr]);

      expect(result[0].displayName).toBeNull();
      expect(result[0].username).toBeNull();
    });

    it('throws when exceeding 50 addresses', async () => {
      const addresses = Array.from({ length: 51 }, () => Keypair.generate().publicKey.toBase58());

      await expect(service.resolveAddresses(addresses)).rejects.toThrow(BadRequestException);
    });
  });
});
