import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { PersonaAdapter } from './persona.adapter';

@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly persona: PersonaAdapter
  ) {}

  /** Persona preferred, mock fallback in dev. */
  private get provider(): 'persona' | 'none' {
    if (this.persona.isEnabled) return 'persona';
    return 'none';
  }

  /** Create a verification session. Returns data for frontend SDK or mock in dev. */
  async createSession(userId: string, walletAddress: string) {
    if (this.provider === 'none') {
      if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException('KYC provider not configured');
      }
      // Mock mode: auto-approve in dev
      await this.prisma.userKyc.upsert({
        where: { userId },
        create: { userId, status: 'APPROVED', provider: 'MOCK', tier: 1, verifiedAt: new Date() },
        update: { status: 'APPROVED', provider: 'MOCK', tier: 1, verifiedAt: new Date() },
      });
      return { token: 'mock_token', applicantId: 'mock_001', mock: true, provider: 'mock' };
    }

    return this.createPersonaSession(userId, walletAddress);
  }

  private async createPersonaSession(userId: string, walletAddress: string) {
    const existing = await this.prisma.userKyc.findUnique({ where: { userId } });

    let inquiryId = existing?.externalId;
    if (!inquiryId) {
      inquiryId = await this.persona.createInquiry(walletAddress);
    }

    await this.prisma.userKyc.upsert({
      where: { userId },
      create: { userId, status: 'PENDING', externalId: inquiryId, provider: 'PERSONA' },
      update: {
        externalId: inquiryId,
        provider: 'PERSONA',
        ...(existing?.status !== 'APPROVED' ? { status: 'PENDING' } : {}),
      },
    });

    const { templateId, environmentId } = this.persona.templateConfig;
    return {
      inquiryId,
      templateId,
      environmentId,
      referenceId: walletAddress,
      provider: 'persona',
    };
  }

  /** Get current KYC status for a user. */
  async getStatus(userId: string) {
    const kyc = await this.prisma.userKyc.findUnique({ where: { userId } });
    if (!kyc) {
      return { status: 'UNVERIFIED', tier: 0 };
    }
    return { status: kyc.status, tier: kyc.tier, rejectionReason: kyc.rejectionReason };
  }

  /** Handle Persona webhook callback. */
  async handlePersonaWebhook(rawBody: string, signatureHeader: string) {
    const payload = this.persona.parseWebhookPayload(rawBody, signatureHeader);
    if (!payload) {
      throw new BadRequestException('Invalid webhook signature');
    }

    return this.processPersonaEvent(payload);
  }

  private async processPersonaEvent(payload: Record<string, unknown>) {
    const data = payload.data as Record<string, unknown> | undefined;
    if (!data) {
      this.logger.warn('Persona webhook missing data field');
      return { ok: true };
    }

    const attributes = data.attributes as Record<string, unknown> | undefined;
    const eventName = attributes?.name as string | undefined;
    const eventPayload = attributes?.payload as Record<string, unknown> | undefined;
    const inquiryData = eventPayload?.data as Record<string, unknown> | undefined;
    const inquiryAttrs = inquiryData?.attributes as Record<string, unknown> | undefined;

    const inquiryId = inquiryData?.id as string | undefined;
    const status = inquiryAttrs?.status as string | undefined;
    const decision = inquiryAttrs?.decision as string | undefined;

    if (!inquiryId) {
      this.logger.warn('Persona webhook missing inquiry ID');
      return { ok: true };
    }

    const kyc = await this.prisma.userKyc.findFirst({ where: { externalId: inquiryId } });
    if (!kyc) {
      this.logger.warn(`Persona webhook for unknown inquiry: ${inquiryId}`);
      return { ok: true };
    }

    if (
      eventName === 'inquiry.approved' ||
      (eventName === 'inquiry.completed' && decision === 'approved')
    ) {
      await this.prisma.userKyc.update({
        where: { id: kyc.id },
        data: { status: 'APPROVED', tier: 1, verifiedAt: new Date(), rejectionReason: null },
      });
    } else if (eventName === 'inquiry.declined') {
      await this.prisma.userKyc.update({
        where: { id: kyc.id },
        data: { status: 'REJECTED', rejectionReason: 'Verification declined' },
      });
    } else if (eventName === 'inquiry.expired') {
      if (kyc.status !== 'APPROVED' && kyc.status !== 'REJECTED') {
        await this.prisma.userKyc.update({
          where: { id: kyc.id },
          data: { status: 'EXPIRED' },
        });
      }
    } else if (status === 'completed' || eventName === 'inquiry.completed') {
      if (kyc.status !== 'APPROVED' && kyc.status !== 'REJECTED') {
        await this.prisma.userKyc.update({
          where: { id: kyc.id },
          data: { status: 'PENDING' },
        });
      }
    } else {
      this.logger.log(`Unhandled Persona webhook: ${eventName} for ${inquiryId}`);
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
