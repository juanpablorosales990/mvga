import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { SumsubAdapter } from './sumsub.adapter';

@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sumsub: SumsubAdapter
  ) {}

  /** Create a verification session. Returns token for WebSDK or mock in dev. */
  async createSession(userId: string, walletAddress: string) {
    if (!this.sumsub.isEnabled) {
      if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException('KYC provider not configured');
      }
      // Mock mode: auto-approve in dev
      await this.prisma.userKyc.upsert({
        where: { userId },
        create: { userId, status: 'APPROVED', provider: 'MOCK', tier: 1, verifiedAt: new Date() },
        update: { status: 'APPROVED', provider: 'MOCK', tier: 1, verifiedAt: new Date() },
      });
      return { token: 'mock_token', applicantId: 'mock_001', mock: true };
    }

    // Upsert KYC record
    const existing = await this.prisma.userKyc.findUnique({ where: { userId } });

    let externalId = existing?.externalId;
    if (!externalId) {
      externalId = await this.sumsub.createApplicant(walletAddress);
    }

    await this.prisma.userKyc.upsert({
      where: { userId },
      create: { userId, status: 'PENDING', externalId },
      update: { status: 'PENDING', externalId },
    });

    const { token } = await this.sumsub.getAccessToken(walletAddress);
    return { token, applicantId: externalId };
  }

  /** Get current KYC status for a user. */
  async getStatus(userId: string) {
    const kyc = await this.prisma.userKyc.findUnique({ where: { userId } });
    if (!kyc) {
      return { status: 'UNVERIFIED', tier: 0 };
    }
    return { status: kyc.status, tier: kyc.tier, rejectionReason: kyc.rejectionReason };
  }

  /** Handle Sumsub webhook callback. */
  async handleWebhook(rawBody: string, signature: string) {
    const payload = this.sumsub.parseWebhookPayload(rawBody, signature);
    if (!payload) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const type = payload.type as string;
    const externalId = (payload.applicantId ?? payload.externalUserId) as string;
    const reviewResult = (payload as Record<string, unknown>).reviewResult as
      | { reviewAnswer?: string; rejectLabels?: string[] }
      | undefined;

    if (!externalId) {
      this.logger.warn('Webhook missing applicant ID');
      return { ok: true };
    }

    const kyc = await this.prisma.userKyc.findFirst({ where: { externalId } });
    if (!kyc) {
      this.logger.warn(`Webhook for unknown applicant: ${externalId}`);
      return { ok: true };
    }

    if (type === 'applicantReviewed' || type === 'applicantPending') {
      const answer = reviewResult?.reviewAnswer;
      if (answer === 'GREEN') {
        await this.prisma.userKyc.update({
          where: { id: kyc.id },
          data: { status: 'APPROVED', tier: 1, verifiedAt: new Date(), rejectionReason: null },
        });
      } else if (answer === 'RED') {
        const reason = reviewResult?.rejectLabels?.join(', ') || 'Verification failed';
        await this.prisma.userKyc.update({
          where: { id: kyc.id },
          data: { status: 'REJECTED', rejectionReason: reason },
        });
      }
    }

    return { ok: true };
  }

  /** Check if a user has approved KYC. Used by KycGuard. */
  async isKycApproved(userId: string): Promise<boolean> {
    const kyc = await this.prisma.userKyc.findUnique({
      where: { userId },
      select: { status: true },
    });
    return kyc?.status === 'APPROVED';
  }
}
