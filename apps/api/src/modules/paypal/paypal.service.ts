import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { PayPalAdapter } from './paypal.adapter';

@Injectable()
export class PayPalService {
  private readonly logger = new Logger(PayPalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly adapter: PayPalAdapter
  ) {}

  get isEnabled(): boolean {
    return this.adapter.isEnabled;
  }

  async createOrderForPayment(paymentRequestId: string, amountUsd: number, description?: string) {
    const request = await this.prisma.paymentRequest.findUnique({
      where: { id: paymentRequestId },
    });
    if (!request) throw new NotFoundException('Payment request not found');
    if (request.status !== 'PENDING') {
      throw new BadRequestException(`Payment request is ${request.status}`);
    }

    const order = await this.adapter.createOrder(amountUsd.toFixed(2), description);

    await this.prisma.paymentRequest.update({
      where: { id: paymentRequestId },
      data: { paypalOrderId: order.id, paymentMethod: 'paypal' },
    });

    const approveLink = order.links.find((l) => l.rel === 'approve');

    return {
      orderId: order.id,
      approveUrl: approveLink?.href || null,
      status: order.status,
    };
  }

  async createOrderForDeposit(walletAddress: string, amountUsd: number, token: string) {
    const order = await this.adapter.createOrder(
      amountUsd.toFixed(2),
      `MVGA Deposit: ${amountUsd} USD → ${token}`
    );

    return {
      orderId: order.id,
      approveUrl: order.links.find((l) => l.rel === 'approve')?.href || null,
      status: order.status,
    };
  }

  async captureOrderForPayment(paymentRequestId: string, orderId: string) {
    const request = await this.prisma.paymentRequest.findUnique({
      where: { id: paymentRequestId },
    });
    if (!request) throw new NotFoundException('Payment request not found');
    if (request.status !== 'PENDING') {
      throw new BadRequestException(`Payment request is ${request.status}`);
    }
    if (request.paypalOrderId && request.paypalOrderId !== orderId) {
      throw new BadRequestException('Order ID mismatch');
    }

    const capture = await this.adapter.captureOrder(orderId);
    if (capture.status !== 'COMPLETED') {
      throw new BadRequestException(`PayPal capture status: ${capture.status}`);
    }

    const capturedAmount = capture.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value;

    let updated: { count: number };
    try {
      updated = await this.prisma.paymentRequest.updateMany({
        where: { id: paymentRequestId, status: 'PENDING' },
        data: {
          status: 'PAID',
          paypalOrderId: orderId,
          paymentMethod: 'paypal',
        },
      });
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === 'P2002') {
        throw new BadRequestException('PayPal order already used');
      }
      throw err;
    }

    if (updated.count === 0) {
      throw new BadRequestException('Payment request already processed');
    }

    this.logger.log(`Payment ${paymentRequestId} paid via PayPal: $${capturedAmount}`);

    return { status: 'PAID', orderId, capturedAmount };
  }

  async captureOrderForDeposit(walletAddress: string, orderId: string, token: string) {
    const capture = await this.adapter.captureOrder(orderId);
    if (capture.status !== 'COMPLETED') {
      throw new BadRequestException(`PayPal capture status: ${capture.status}`);
    }

    const capturedAmount =
      capture.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value || '0';

    this.logger.log(`Deposit via PayPal: $${capturedAmount} → ${token} for ${walletAddress}`);

    // In production, this would trigger the USDC transfer from the pre-funded pool.
    // For now, we log the capture and the wallet can poll for the on-chain credit.
    return {
      status: 'COMPLETED',
      orderId,
      capturedAmount,
      token,
      note: 'USDC will be credited to your wallet shortly',
    };
  }
}
