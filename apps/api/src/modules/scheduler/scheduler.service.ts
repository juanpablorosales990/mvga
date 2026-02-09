import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { SwapService } from '../swap/swap.service';
import { SolanaService } from '../wallet/solana.service';
import {
  CreateRecurringPaymentDto,
  CreateDCAOrderDto,
  CompleteExecutionDto,
} from './scheduler.dto';

// Token decimals for converting human-readable → smallest units
const TOKEN_DECIMALS: Record<string, number> = {
  SOL: 9,
  USDC: 6,
  USDT: 6,
  MVGA: 9,
};

// Token mints for Jupiter integration
const TOKEN_MINTS: Record<string, string> = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  MVGA: 'DRX65kM2n5CLTpdjJCemZvkUwE98ou4RpHrd8Z3GH5Qh',
};

function toSmallestUnit(amount: number, decimals: number): bigint {
  // Avoid floating-point precision loss by working with string
  const [whole = '0', fraction = ''] = amount.toString().split('.');
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
  return BigInt(whole + paddedFraction);
}

function calculateNextExecution(frequency: string, from: Date = new Date()): Date {
  const next = new Date(from);
  switch (frequency) {
    case 'DAILY':
      next.setDate(next.getDate() + 1);
      break;
    case 'WEEKLY':
      next.setDate(next.getDate() + 7);
      break;
    case 'BIWEEKLY':
      next.setDate(next.getDate() + 14);
      break;
    case 'MONTHLY':
      next.setMonth(next.getMonth() + 1);
      break;
  }
  return next;
}

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly swapService: SwapService,
    private readonly solana: SolanaService
  ) {}

  // ── Recurring Payments ──────────────────────────────────────────────

  async createRecurringPayment(walletAddress: string, dto: CreateRecurringPaymentDto) {
    if (dto.recipientAddress === walletAddress) {
      throw new BadRequestException('Cannot create recurring payment to yourself');
    }

    const decimals = TOKEN_DECIMALS[dto.token];
    if (decimals === undefined) throw new BadRequestException('Unsupported token');

    const amount = toSmallestUnit(dto.amount, decimals);

    return this.prisma.recurringPayment.create({
      data: {
        walletAddress,
        recipientAddress: dto.recipientAddress,
        recipientLabel: dto.recipientLabel,
        token: dto.token,
        amount,
        frequency: dto.frequency as 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY',
        memo: dto.memo,
        nextExecutionAt: calculateNextExecution(dto.frequency),
      },
    });
  }

  async getRecurringPayments(walletAddress: string, status?: string) {
    return this.prisma.recurringPayment.findMany({
      where: {
        walletAddress,
        ...(status ? { status: status as 'ACTIVE' | 'PAUSED' | 'CANCELLED' } : {}),
      },
      include: {
        executions: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async pauseRecurringPayment(walletAddress: string, id: string) {
    const payment = await this.findOwnedPayment(walletAddress, id);
    if (payment.status !== 'ACTIVE') {
      throw new BadRequestException('Can only pause active payments');
    }
    return this.prisma.recurringPayment.update({
      where: { id },
      data: { status: 'PAUSED' },
    });
  }

  async resumeRecurringPayment(walletAddress: string, id: string) {
    const payment = await this.findOwnedPayment(walletAddress, id);
    if (payment.status !== 'PAUSED') {
      throw new BadRequestException('Can only resume paused payments');
    }
    return this.prisma.recurringPayment.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        nextExecutionAt: calculateNextExecution(payment.frequency),
      },
    });
  }

  async cancelRecurringPayment(walletAddress: string, id: string) {
    await this.findOwnedPayment(walletAddress, id);
    return this.prisma.recurringPayment.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  private async findOwnedPayment(walletAddress: string, id: string) {
    const payment = await this.prisma.recurringPayment.findUnique({ where: { id } });
    if (!payment || payment.walletAddress !== walletAddress) {
      throw new NotFoundException('Recurring payment not found');
    }
    return payment;
  }

  // ── DCA Orders ──────────────────────────────────────────────────────

  async createDCAOrder(walletAddress: string, dto: CreateDCAOrderDto) {
    if (dto.inputToken === dto.outputToken) {
      throw new BadRequestException('Input and output tokens must be different');
    }

    const decimals = TOKEN_DECIMALS[dto.inputToken];
    if (decimals === undefined) throw new BadRequestException('Unsupported input token');
    if (!TOKEN_MINTS[dto.outputToken]) throw new BadRequestException('Unsupported output token');

    const inputAmount = toSmallestUnit(dto.amount, decimals);

    return this.prisma.dCAOrder.create({
      data: {
        walletAddress,
        inputToken: dto.inputToken,
        outputToken: dto.outputToken,
        inputAmount,
        frequency: dto.frequency as 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY',
        slippageBps: dto.slippageBps ?? 50,
        nextExecutionAt: calculateNextExecution(dto.frequency),
      },
    });
  }

  async getDCAOrders(walletAddress: string, status?: string) {
    return this.prisma.dCAOrder.findMany({
      where: {
        walletAddress,
        ...(status ? { status: status as 'ACTIVE' | 'PAUSED' | 'CANCELLED' } : {}),
      },
      include: {
        executions: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async pauseDCAOrder(walletAddress: string, id: string) {
    const order = await this.findOwnedDCA(walletAddress, id);
    if (order.status !== 'ACTIVE') {
      throw new BadRequestException('Can only pause active DCA orders');
    }
    return this.prisma.dCAOrder.update({
      where: { id },
      data: { status: 'PAUSED' },
    });
  }

  async resumeDCAOrder(walletAddress: string, id: string) {
    const order = await this.findOwnedDCA(walletAddress, id);
    if (order.status !== 'PAUSED') {
      throw new BadRequestException('Can only resume paused DCA orders');
    }
    return this.prisma.dCAOrder.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        nextExecutionAt: calculateNextExecution(order.frequency),
      },
    });
  }

  async cancelDCAOrder(walletAddress: string, id: string) {
    await this.findOwnedDCA(walletAddress, id);
    return this.prisma.dCAOrder.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  private async findOwnedDCA(walletAddress: string, id: string) {
    const order = await this.prisma.dCAOrder.findUnique({ where: { id } });
    if (!order || order.walletAddress !== walletAddress) {
      throw new NotFoundException('DCA order not found');
    }
    return order;
  }

  // ── Executions ──────────────────────────────────────────────────────

  async getPendingExecutions(walletAddress: string) {
    const payments = await this.prisma.scheduledExecution.findMany({
      where: {
        status: 'PENDING',
        payment: { walletAddress },
      },
      include: { payment: true },
      orderBy: { scheduledFor: 'asc' },
    });

    const dcas = await this.prisma.scheduledExecution.findMany({
      where: {
        status: 'PENDING',
        dca: { walletAddress },
      },
      include: { dca: true },
      orderBy: { scheduledFor: 'asc' },
    });

    return [...payments, ...dcas].sort(
      (a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime()
    );
  }

  async getExecution(walletAddress: string, id: string) {
    const execution = await this.prisma.scheduledExecution.findUnique({
      where: { id },
      include: { payment: true, dca: true },
    });

    if (!execution) throw new NotFoundException('Execution not found');

    const ownerWallet = execution.payment?.walletAddress || execution.dca?.walletAddress;
    if (ownerWallet !== walletAddress) {
      throw new NotFoundException('Execution not found');
    }

    return execution;
  }

  async completeExecution(walletAddress: string, id: string, dto: CompleteExecutionDto) {
    const execution = await this.getExecution(walletAddress, id);

    if (execution.status !== 'PENDING') {
      throw new BadRequestException('Execution is not pending');
    }

    if (new Date() > execution.expiresAt) {
      throw new BadRequestException('Execution has expired');
    }

    // Verify transaction on-chain
    const connection = this.solana.getConnection();
    const parsedTx = await connection.getParsedTransaction(dto.signature, {
      maxSupportedTransactionVersion: 0,
    });

    if (!parsedTx) throw new BadRequestException('Transaction not found on-chain');
    if (parsedTx.meta?.err) throw new BadRequestException('Transaction failed on-chain');

    const signerKey = parsedTx.transaction.message.accountKeys[0]?.pubkey?.toBase58();
    if (signerKey !== walletAddress) {
      throw new BadRequestException('Transaction signer does not match wallet');
    }

    // Atomic update — prevents race condition where two concurrent requests
    // both pass the PENDING check above
    const { count } = await this.prisma.scheduledExecution.updateMany({
      where: { id, status: 'PENDING' },
      data: {
        status: 'COMPLETED',
        signature: dto.signature,
        executedAt: new Date(),
        outputAmount: dto.outputAmount ? BigInt(dto.outputAmount) : null,
      },
    });

    if (count === 0) {
      throw new BadRequestException('Execution already completed or no longer pending');
    }

    // Advance parent order to next cycle
    if (execution.type === 'PAYMENT' && execution.paymentId) {
      const payment = execution.payment!;
      await this.prisma.recurringPayment.update({
        where: { id: execution.paymentId },
        data: {
          lastExecutedAt: new Date(),
          nextExecutionAt: calculateNextExecution(payment.frequency),
        },
      });
    } else if (execution.type === 'DCA' && execution.dcaId) {
      const dca = execution.dca!;
      const outputAmount = dto.outputAmount ? BigInt(dto.outputAmount) : BigInt(0);
      await this.prisma.dCAOrder.update({
        where: { id: execution.dcaId },
        data: {
          lastExecutedAt: new Date(),
          nextExecutionAt: calculateNextExecution(dca.frequency),
          totalSpent: { increment: dca.inputAmount },
          totalReceived: { increment: outputAmount },
          executionCount: { increment: 1 },
        },
      });
    }

    return { success: true };
  }

  async skipExecution(walletAddress: string, id: string) {
    const execution = await this.getExecution(walletAddress, id);

    if (execution.status !== 'PENDING') {
      throw new BadRequestException('Execution is not pending');
    }

    await this.prisma.scheduledExecution.update({
      where: { id },
      data: { status: 'SKIPPED' },
    });

    // Advance parent to next cycle
    if (execution.type === 'PAYMENT' && execution.paymentId) {
      const payment = execution.payment!;
      await this.prisma.recurringPayment.update({
        where: { id: execution.paymentId },
        data: {
          nextExecutionAt: calculateNextExecution(payment.frequency),
        },
      });
    } else if (execution.type === 'DCA' && execution.dcaId) {
      const dca = execution.dca!;
      await this.prisma.dCAOrder.update({
        where: { id: execution.dcaId },
        data: {
          nextExecutionAt: calculateNextExecution(dca.frequency),
        },
      });
    }

    return { success: true };
  }

  async buildDCASwapTransaction(walletAddress: string, executionId: string) {
    const execution = await this.getExecution(walletAddress, executionId);

    if (execution.type !== 'DCA') {
      throw new BadRequestException('Not a DCA execution');
    }

    if (execution.status !== 'PENDING') {
      throw new BadRequestException('Execution is not pending');
    }

    const dca = execution.dca!;
    const inputMint = TOKEN_MINTS[dca.inputToken];
    const outputMint = TOKEN_MINTS[dca.outputToken];

    if (!inputMint || !outputMint) {
      throw new BadRequestException('Unsupported token pair');
    }

    // Get Jupiter quote
    const quote = await this.swapService.getQuote({
      inputMint,
      outputMint,
      amount: Number(dca.inputAmount),
      slippageBps: dca.slippageBps,
    });

    // Build unsigned swap transaction
    const { swapTransaction } = await this.swapService.getSwapTransaction({
      quoteResponse: quote,
      userPublicKey: walletAddress,
    });

    return {
      swapTransaction,
      quote: {
        inputAmount: quote.inAmount,
        outputAmount: quote.outAmount,
        priceImpact: quote.priceImpactPct,
      },
    };
  }
}
