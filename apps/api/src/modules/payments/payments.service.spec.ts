/* eslint-disable @typescript-eslint/no-explicit-any */
import { BadRequestException } from '@nestjs/common';
import { PaymentsService } from './payments.service';

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

function makeTx(params: {
  blockTime: number;
  mint?: string;
  owner?: string;
  postAmount?: string;
  preAmount?: string;
  failed?: boolean;
}) {
  const mint = params.mint ?? USDC_MINT;
  const owner = params.owner ?? 'Recipient1111111111111111111111111111111111';
  const preAmount = params.preAmount ?? '0';
  const postAmount = params.postAmount ?? '0';

  return {
    blockTime: params.blockTime,
    meta: {
      err: params.failed ? { InstructionError: [0, 'Custom'] } : null,
      preTokenBalances: [
        {
          mint,
          owner,
          uiTokenAmount: { amount: preAmount, decimals: 6 },
        },
      ],
      postTokenBalances: [
        {
          mint,
          owner,
          uiTokenAmount: { amount: postAmount, decimals: 6 },
        },
      ],
    },
  } as any;
}

describe('PaymentsService.verifyPayment', () => {
  const prisma: any = {
    paymentRequest: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const service = new PaymentsService(prisma);
  const connectionMock = { getTransaction: jest.fn() };
  (service as any).connection = connectionMock;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('rejects when tx is not found', async () => {
    prisma.paymentRequest.findUnique.mockResolvedValue({
      id: 'req1',
      recipientAddress: 'Recipient1111111111111111111111111111111111',
      token: 'USDC',
      amount: 1_000_000n,
      memo: null,
      status: 'PENDING',
      paymentTx: null,
      expiresAt: new Date('2026-02-10T00:00:00Z'),
      createdAt: new Date('2026-02-09T00:00:00Z'),
    });
    connectionMock.getTransaction.mockResolvedValue(null);

    await expect(service.verifyPayment('req1', 'sig')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when tx failed on-chain', async () => {
    prisma.paymentRequest.findUnique.mockResolvedValue({
      id: 'req1',
      recipientAddress: 'Recipient1111111111111111111111111111111111',
      token: 'USDC',
      amount: 1_000_000n,
      memo: null,
      status: 'PENDING',
      paymentTx: null,
      expiresAt: new Date('2026-02-10T00:00:00Z'),
      createdAt: new Date('2026-02-09T00:00:00Z'),
    });
    connectionMock.getTransaction.mockResolvedValue(
      makeTx({
        blockTime: Math.floor(new Date('2026-02-09T00:10:00Z').getTime() / 1000),
        failed: true,
        postAmount: '1000000',
      })
    );

    await expect(service.verifyPayment('req1', 'sig')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when tx is older than the request', async () => {
    prisma.paymentRequest.findUnique.mockResolvedValue({
      id: 'req1',
      recipientAddress: 'Recipient1111111111111111111111111111111111',
      token: 'USDC',
      amount: 1_000_000n,
      memo: null,
      status: 'PENDING',
      paymentTx: null,
      expiresAt: new Date('2026-02-10T00:00:00Z'),
      createdAt: new Date('2026-02-09T00:00:00Z'),
    });

    // 10 minutes before createdAt (beyond skew window)
    connectionMock.getTransaction.mockResolvedValue(
      makeTx({
        blockTime: Math.floor(new Date('2026-02-08T23:50:00Z').getTime() / 1000),
        postAmount: '1000000',
      })
    );

    await expect(service.verifyPayment('req1', 'sig')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when tx is after expiry', async () => {
    prisma.paymentRequest.findUnique.mockResolvedValue({
      id: 'req1',
      recipientAddress: 'Recipient1111111111111111111111111111111111',
      token: 'USDC',
      amount: 1_000_000n,
      memo: null,
      status: 'PENDING',
      paymentTx: null,
      expiresAt: new Date('2026-02-09T00:10:00Z'),
      createdAt: new Date('2026-02-09T00:00:00Z'),
    });

    // ~1h after expiry
    connectionMock.getTransaction.mockResolvedValue(
      makeTx({
        blockTime: Math.floor(new Date('2026-02-09T01:10:00Z').getTime() / 1000),
        postAmount: '1000000',
      })
    );

    await expect(service.verifyPayment('req1', 'sig')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when tx does not pay requested mint/amount', async () => {
    prisma.paymentRequest.findUnique.mockResolvedValue({
      id: 'req1',
      recipientAddress: 'Recipient1111111111111111111111111111111111',
      token: 'USDC',
      amount: 1_000_000n,
      memo: null,
      status: 'PENDING',
      paymentTx: null,
      expiresAt: new Date('2026-02-10T00:00:00Z'),
      createdAt: new Date('2026-02-09T00:00:00Z'),
    });

    connectionMock.getTransaction.mockResolvedValue(
      makeTx({
        blockTime: Math.floor(new Date('2026-02-09T00:05:00Z').getTime() / 1000),
        postAmount: '999999',
      })
    );

    await expect(service.verifyPayment('req1', 'sig')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts a valid payment (PENDING)', async () => {
    prisma.paymentRequest.findUnique.mockResolvedValue({
      id: 'req1',
      recipientAddress: 'Recipient1111111111111111111111111111111111',
      token: 'USDC',
      amount: 1_000_000n,
      memo: null,
      status: 'PENDING',
      paymentTx: null,
      expiresAt: new Date('2026-02-10T00:00:00Z'),
      createdAt: new Date('2026-02-09T00:00:00Z'),
    });

    connectionMock.getTransaction.mockResolvedValue(
      makeTx({
        blockTime: Math.floor(new Date('2026-02-09T00:05:00Z').getTime() / 1000),
        postAmount: '1000000',
      })
    );
    prisma.paymentRequest.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.verifyPayment('req1', 'sig')).resolves.toEqual({
      status: 'PAID',
      signature: 'sig',
    });
  });

  it('accepts a valid payment even if request is EXPIRED (paid in-window)', async () => {
    prisma.paymentRequest.findUnique.mockResolvedValue({
      id: 'req1',
      recipientAddress: 'Recipient1111111111111111111111111111111111',
      token: 'USDC',
      amount: 1_000_000n,
      memo: null,
      status: 'EXPIRED',
      paymentTx: null,
      expiresAt: new Date('2026-02-09T00:10:00Z'),
      createdAt: new Date('2026-02-09T00:00:00Z'),
    });

    connectionMock.getTransaction.mockResolvedValue(
      makeTx({
        blockTime: Math.floor(new Date('2026-02-09T00:05:00Z').getTime() / 1000),
        postAmount: '1000000',
      })
    );
    prisma.paymentRequest.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.verifyPayment('req1', 'sig')).resolves.toEqual({
      status: 'PAID',
      signature: 'sig',
    });
  });

  it('rejects when signature is already used (unique constraint)', async () => {
    prisma.paymentRequest.findUnique.mockResolvedValue({
      id: 'req1',
      recipientAddress: 'Recipient1111111111111111111111111111111111',
      token: 'USDC',
      amount: 1_000_000n,
      memo: null,
      status: 'PENDING',
      paymentTx: null,
      expiresAt: new Date('2026-02-10T00:00:00Z'),
      createdAt: new Date('2026-02-09T00:00:00Z'),
    });

    connectionMock.getTransaction.mockResolvedValue(
      makeTx({
        blockTime: Math.floor(new Date('2026-02-09T00:05:00Z').getTime() / 1000),
        postAmount: '1000000',
      })
    );
    prisma.paymentRequest.updateMany.mockRejectedValue({ code: 'P2002' });

    await expect(service.verifyPayment('req1', 'sig')).rejects.toBeInstanceOf(BadRequestException);
  });
});
