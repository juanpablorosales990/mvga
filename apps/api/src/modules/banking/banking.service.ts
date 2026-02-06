import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class BankingService {
  constructor(private readonly prisma: PrismaService) {}

  async joinCardWaitlist(walletAddress: string, email?: string) {
    const existing = await this.prisma.cardWaitlist.findFirst({
      where: { walletAddress },
    });
    if (existing) {
      return { waitlisted: true, alreadyJoined: true };
    }
    await this.prisma.cardWaitlist.create({
      data: { walletAddress, email },
    });
    return { waitlisted: true, alreadyJoined: false };
  }

  async getWaitlistStatus(walletAddress: string) {
    const entry = await this.prisma.cardWaitlist.findFirst({
      where: { walletAddress },
    });
    return { waitlisted: !!entry };
  }
}
