import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class SocialService {
  private readonly logger = new Logger(SocialService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── User Lookup ──────────────────────────────────────────────────────

  async lookupUser(params: { username?: string; citizen?: string }) {
    const { username, citizen } = params;

    if (!username && !citizen) {
      throw new BadRequestException('Provide username or citizen number');
    }

    const where: Record<string, unknown> = {};
    if (username) where.username = username.toLowerCase();
    if (citizen) {
      const num = parseInt(citizen, 10);
      if (isNaN(num)) throw new BadRequestException('Invalid citizen number');
      where.citizenNumber = num;
    }

    const user = await this.prisma.user.findFirst({
      where,
      select: {
        walletAddress: true,
        displayName: true,
        username: true,
        citizenNumber: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  // ── Contacts ─────────────────────────────────────────────────────────

  async getContacts(userId: string) {
    const contacts = await this.prisma.contact.findMany({
      where: { ownerId: userId },
      orderBy: [{ isFavorite: 'desc' }, { label: 'asc' }],
    });

    // Batch resolve addresses to user profiles
    const addresses = contacts.map((c) => c.contactAddress);
    const users = await this.prisma.user.findMany({
      where: { walletAddress: { in: addresses } },
      select: {
        walletAddress: true,
        displayName: true,
        username: true,
        citizenNumber: true,
      },
    });

    const userMap = new Map(users.map((u) => [u.walletAddress, u]));

    return contacts.map((c) => ({
      id: c.id,
      contactAddress: c.contactAddress,
      label: c.label,
      isFavorite: c.isFavorite,
      createdAt: c.createdAt,
      // Resolved profile (null if not an MVGA user)
      displayName: userMap.get(c.contactAddress)?.displayName ?? null,
      username: userMap.get(c.contactAddress)?.username ?? null,
      citizenNumber: userMap.get(c.contactAddress)?.citizenNumber ?? null,
    }));
  }

  async syncContacts(
    userId: string,
    contacts: Array<{ label: string; address: string; isFavorite?: boolean }>
  ) {
    if (contacts.length > 200) {
      throw new BadRequestException('Maximum 200 contacts');
    }

    // Upsert strategy: delete all then bulk create
    await this.prisma.$transaction([
      this.prisma.contact.deleteMany({ where: { ownerId: userId } }),
      this.prisma.contact.createMany({
        data: contacts.map((c) => ({
          ownerId: userId,
          contactAddress: c.address,
          label: c.label,
          isFavorite: c.isFavorite ?? false,
        })),
        skipDuplicates: true,
      }),
    ]);

    this.logger.log(`Synced ${contacts.length} contacts for user ${userId}`);
    return { synced: contacts.length };
  }

  async removeContact(userId: string, address: string) {
    const deleted = await this.prisma.contact.deleteMany({
      where: { ownerId: userId, contactAddress: address },
    });

    if (deleted.count === 0) {
      throw new NotFoundException('Contact not found');
    }

    return { deleted: true };
  }

  // ── Resolve Addresses ────────────────────────────────────────────────

  async resolveAddresses(addresses: string[]) {
    if (addresses.length > 50) {
      throw new BadRequestException('Maximum 50 addresses');
    }

    const users = await this.prisma.user.findMany({
      where: { walletAddress: { in: addresses } },
      select: {
        walletAddress: true,
        displayName: true,
        username: true,
        citizenNumber: true,
      },
    });

    const userMap = new Map(users.map((u) => [u.walletAddress, u]));

    return addresses.map((addr) => {
      const user = userMap.get(addr);
      return {
        address: addr,
        displayName: user?.displayName ?? null,
        username: user?.username ?? null,
        citizenNumber: user?.citizenNumber ?? null,
      };
    });
  }
}
