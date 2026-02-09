import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma.service';

interface AirtmPayoutResponse {
  id: string;
  code: string;
  status: string;
  amount: number;
  currency: string;
}

@Injectable()
export class OfframpService {
  private readonly logger = new Logger(OfframpService.name);
  private readonly baseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {
    const isSandbox = this.config.get('AIRTM_SANDBOX') !== 'false';
    this.baseUrl = isSandbox
      ? 'https://payments.static-stg.tests.airtm.org'
      : 'https://payments.air-pay.io';
  }

  private getAuthHeader(): string {
    const apiKey = this.config.get('AIRTM_API_KEY');
    const apiSecret = this.config.get('AIRTM_API_SECRET');

    if (!apiKey || !apiSecret) {
      throw new BadRequestException('Airtm not configured');
    }

    return 'Basic ' + Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
  }

  private async airtmPost<T = AirtmPayoutResponse>(
    path: string,
    body: Record<string, unknown>
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.getAuthHeader(),
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`Airtm POST ${path} failed: ${err}`);
      throw new BadRequestException('Airtm request failed');
    }

    return res.json() as Promise<T>;
  }

  private async airtmGet<T = unknown>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.getAuthHeader(),
      },
    });

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`Airtm GET ${path} failed: ${err}`);
      throw new BadRequestException('Airtm request failed');
    }

    return res.json() as Promise<T>;
  }

  /** Create a payout (two-step: create → commit) */
  async createPayout(
    walletAddress: string,
    recipientEmail: string,
    amountUsd: number,
    description?: string
  ) {
    // Create DB record first
    const payout = await this.prisma.payout.create({
      data: {
        walletAddress,
        recipientEmail,
        amountUsd,
        description,
      },
    });

    try {
      const result = await this.airtmPost('/payouts', {
        email: recipientEmail,
        amount: amountUsd,
        description: description || `MVGA payout to ${recipientEmail}`,
      });

      // Update with Airtm payout ID
      await this.prisma.payout.update({
        where: { id: payout.id },
        data: {
          airtmPayoutId: result.id,
          airtmCode: result.code,
        },
      });

      this.logger.log(`Payout created: ${payout.id} → Airtm ${result.id}`);

      return {
        id: payout.id,
        airtmPayoutId: result.id,
        status: 'PENDING',
        amountUsd,
        recipientEmail,
      };
    } catch (error) {
      await this.prisma.payout.update({
        where: { id: payout.id },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      throw error;
    }
  }

  /** Commit a pending payout for processing */
  async commitPayout(walletAddress: string, payoutId: string) {
    const payout = await this.prisma.payout.findUnique({ where: { id: payoutId } });

    if (!payout || payout.walletAddress !== walletAddress) {
      throw new NotFoundException('Payout not found');
    }

    if (payout.status !== 'PENDING') {
      throw new BadRequestException('Payout is not in PENDING status');
    }

    if (!payout.airtmPayoutId) {
      throw new BadRequestException('Payout has no Airtm ID');
    }

    try {
      await this.airtmPost(`/payouts/${payout.airtmPayoutId}/commit`, {});

      await this.prisma.payout.update({
        where: { id: payoutId },
        data: { status: 'COMMITTED' },
      });

      this.logger.log(`Payout committed: ${payoutId}`);

      return { id: payoutId, status: 'COMMITTED' };
    } catch (error) {
      await this.prisma.payout.update({
        where: { id: payoutId },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      throw error;
    }
  }

  /** One-step payout: create + commit in a single call */
  async createOneStepPayout(
    walletAddress: string,
    recipientEmail: string,
    amountUsd: number,
    description?: string
  ) {
    const payout = await this.prisma.payout.create({
      data: {
        walletAddress,
        recipientEmail,
        amountUsd,
        description,
      },
    });

    try {
      const result = await this.airtmPost('/payouts/one-step', {
        email: recipientEmail,
        amount: amountUsd,
        description: description || `MVGA payout to ${recipientEmail}`,
      });

      await this.prisma.payout.update({
        where: { id: payout.id },
        data: {
          airtmPayoutId: result.id,
          airtmCode: result.code,
          status: 'COMMITTED',
        },
      });

      this.logger.log(`One-step payout created: ${payout.id} → Airtm ${result.id}`);

      return {
        id: payout.id,
        airtmPayoutId: result.id,
        status: 'COMMITTED',
        amountUsd,
        recipientEmail,
      };
    } catch (error) {
      await this.prisma.payout.update({
        where: { id: payout.id },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      throw error;
    }
  }

  /** Cancel a pending payout */
  async cancelPayout(walletAddress: string, payoutId: string) {
    const payout = await this.prisma.payout.findUnique({ where: { id: payoutId } });

    if (!payout || payout.walletAddress !== walletAddress) {
      throw new NotFoundException('Payout not found');
    }

    if (payout.status !== 'PENDING' && payout.status !== 'COMMITTED') {
      throw new BadRequestException('Payout cannot be cancelled');
    }

    if (payout.airtmPayoutId) {
      try {
        await this.airtmPost('/payouts/cancel', { payoutId: payout.airtmPayoutId });
      } catch (error) {
        this.logger.warn(`Airtm cancel failed for ${payoutId}: ${error}`);
      }
    }

    await this.prisma.payout.update({
      where: { id: payoutId },
      data: { status: 'CANCELLED' },
    });

    return { id: payoutId, status: 'CANCELLED' };
  }

  /** Get payout status from Airtm */
  async getPayoutStatus(walletAddress: string, payoutId: string) {
    const payout = await this.prisma.payout.findUnique({ where: { id: payoutId } });

    if (!payout || payout.walletAddress !== walletAddress) {
      throw new NotFoundException('Payout not found');
    }

    // If we have an Airtm ID and payout is still processing, check Airtm
    if (payout.airtmPayoutId && !['COMPLETED', 'FAILED', 'CANCELLED'].includes(payout.status)) {
      try {
        const event = await this.airtmGet<{ status: string }>(
          `/payouts/event/${payout.airtmPayoutId}`
        );

        const statusMap: Record<string, string> = {
          completed: 'COMPLETED',
          canceled: 'CANCELLED',
          failed: 'FAILED',
          pending: 'PROCESSING',
          committed: 'COMMITTED',
        };

        const newStatus = statusMap[event.status] || payout.status;

        if (newStatus !== payout.status) {
          await this.prisma.payout.update({
            where: { id: payoutId },
            data: {
              status: newStatus as any,
              completedAt: newStatus === 'COMPLETED' ? new Date() : undefined,
            },
          });

          return { ...payout, status: newStatus };
        }
      } catch {
        // If Airtm event check fails, return cached status
      }
    }

    return payout;
  }

  /** List payouts for a wallet */
  async getPayouts(walletAddress: string) {
    return this.prisma.payout.findMany({
      where: { walletAddress },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /** Get partner balance on Airtm */
  async getBalance() {
    return this.airtmGet('/partner/balance');
  }
}
