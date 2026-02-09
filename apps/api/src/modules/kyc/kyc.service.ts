import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { SumsubAdapter } from './sumsub.adapter';
import { PersonaAdapter } from './persona.adapter';

@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sumsub: SumsubAdapter,
    private readonly persona: PersonaAdapter
  ) {}

  /** Which provider is active? Persona preferred, Sumsub fallback. */
  private get provider(): 'persona' | 'sumsub' | 'none' {
    if (this.persona.isEnabled) return 'persona';
    if (this.sumsub.isEnabled) return 'sumsub';
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

    if (this.provider === 'persona') {
      return this.createPersonaSession(userId, walletAddress);
    }

    return this.createSumsubSession(userId, walletAddress);
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
      update: { status: 'PENDING', externalId: inquiryId, provider: 'PERSONA' },
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

  private async createSumsubSession(userId: string, walletAddress: string) {
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
    return { token, applicantId: externalId, provider: 'sumsub' };
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
  async handleSumsubWebhook(rawBody: string, signature: string) {
    const payload = this.sumsub.parseWebhookPayload(rawBody, signature);
    if (!payload) {
      throw new BadRequestException('Invalid webhook signature');
    }

    return this.processSumsubEvent(payload);
  }

  private async processSumsubEvent(payload: Record<string, unknown>) {
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

    if (type === 'applicantReviewed') {
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
    } else if (type === 'applicantPending') {
      if (kyc.status !== 'APPROVED' && kyc.status !== 'REJECTED') {
        await this.prisma.userKyc.update({
          where: { id: kyc.id },
          data: { status: 'PENDING' },
        });
      }
    } else if (type === 'applicantOnHold') {
      this.logger.warn(`Applicant on hold: ${externalId}`);
      if (kyc.status !== 'APPROVED' && kyc.status !== 'REJECTED') {
        await this.prisma.userKyc.update({
          where: { id: kyc.id },
          data: { status: 'PENDING' },
        });
      }
    } else {
      this.logger.log(`Unhandled KYC webhook type: ${type} for ${externalId}`);
    }

    return { ok: true };
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

  // Keep backwards-compatible handleWebhook for existing Sumsub usage
  async handleWebhook(rawBody: string, signature: string) {
    return this.handleSumsubWebhook(rawBody, signature);
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
