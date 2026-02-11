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

const mockEventEmitter: any = { emit: jest.fn() };
const mockSocialService: any = { lookupUser: jest.fn() };

describe('PaymentsService.verifyPayment', () => {
  const prisma: any = {
    paymentRequest: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const service = new PaymentsService(prisma, mockEventEmitter, mockSocialService);
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

describe('PaymentsService.requestFromUser', () => {
  const prisma: any = {
    paymentRequest: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  };

  const eventEmitter: any = { emit: jest.fn() };
  const socialService: any = { lookupUser: jest.fn() };
  const service = new PaymentsService(prisma, eventEmitter, socialService);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('creates a request from @username', async () => {
    socialService.lookupUser.mockResolvedValue({
      walletAddress: 'Requestee111111111111111111111111111111111',
      displayName: 'Maria',
      username: 'maria',
      citizenNumber: 42,
    });
    prisma.user.findUnique.mockResolvedValue({ username: 'juan' });
    prisma.paymentRequest.create.mockResolvedValue({
      id: 'req-new',
      recipientAddress: 'Requester111111111111111111111111111111111',
      token: 'USDC',
      amount: 10_000_000n,
      memo: null,
      status: 'PENDING',
      paymentTx: null,
      expiresAt: new Date('2026-02-12T00:00:00Z'),
      createdAt: new Date('2026-02-09T00:00:00Z'),
      requesterId: 'user-1',
      requesterUsername: 'juan',
      requesteeAddress: 'Requestee111111111111111111111111111111111',
      note: 'for arepas',
      declinedAt: null,
    });

    const result = await service.requestFromUser(
      'user-1',
      'Requester111111111111111111111111111111111',
      {
        recipientIdentifier: '@maria',
        token: 'USDC',
        amount: 10,
        note: 'for arepas',
      }
    );

    expect(result.id).toBe('req-new');
    expect(result.note).toBe('for arepas');
    expect(socialService.lookupUser).toHaveBeenCalledWith({ username: 'maria' });
    expect(eventEmitter.emit).toHaveBeenCalledWith('payment.request.received', expect.any(Object));
  });

  it('rejects self-request', async () => {
    socialService.lookupUser.mockResolvedValue({
      walletAddress: 'SameWallet1111111111111111111111111111111',
    });

    await expect(
      service.requestFromUser('user-1', 'SameWallet1111111111111111111111111111111', {
        recipientIdentifier: '@self',
        token: 'USDC',
        amount: 5,
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('resolves #citizen identifier', async () => {
    socialService.lookupUser.mockResolvedValue({
      walletAddress: 'Citizen11111111111111111111111111111111111',
    });
    prisma.user.findUnique.mockResolvedValue({ username: 'juan' });
    prisma.paymentRequest.create.mockResolvedValue({
      id: 'req-cit',
      recipientAddress: 'Requester111111111111111111111111111111111',
      token: 'USDC',
      amount: 5_000_000n,
      memo: null,
      status: 'PENDING',
      paymentTx: null,
      expiresAt: new Date('2026-02-12T00:00:00Z'),
      createdAt: new Date('2026-02-09T00:00:00Z'),
      requesterId: 'user-1',
      requesterUsername: 'juan',
      requesteeAddress: 'Citizen11111111111111111111111111111111111',
      note: null,
      declinedAt: null,
    });

    await service.requestFromUser('user-1', 'Requester111111111111111111111111111111111', {
      recipientIdentifier: '#42',
      token: 'USDC',
      amount: 5,
    });

    expect(socialService.lookupUser).toHaveBeenCalledWith({ citizen: '42' });
  });
});

describe('PaymentsService.getMyRequests', () => {
  const prisma: any = {
    paymentRequest: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  const service = new PaymentsService(prisma, mockEventEmitter, mockSocialService);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns outgoing requests', async () => {
    prisma.paymentRequest.findMany.mockResolvedValue([
      {
        id: 'req-1',
        recipientAddress: 'Wallet1',
        token: 'USDC',
        amount: 5_000_000n,
        memo: null,
        status: 'PENDING',
        paymentTx: null,
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        requesterId: 'user-1',
        requesterUsername: 'juan',
        requesteeAddress: 'Wallet2',
        note: 'lunch',
        declinedAt: null,
      },
    ]);

    const result = await service.getMyRequests('Wallet1');
    expect(result).toHaveLength(1);
    expect(result[0].note).toBe('lunch');
  });
});

describe('PaymentsService.createSplit', () => {
  const prisma: any = {
    paymentRequest: { create: jest.fn() },
    splitPayment: { create: jest.fn() },
    user: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };

  const eventEmitter: any = { emit: jest.fn() };
  const socialService: any = { lookupUser: jest.fn() };
  const service = new PaymentsService(prisma, eventEmitter, socialService);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('creates a split with equal shares', async () => {
    socialService.lookupUser
      .mockResolvedValueOnce({ walletAddress: 'Friend1111111111111111111111111111111111111' })
      .mockResolvedValueOnce({ walletAddress: 'Friend2222222222222222222222222222222222222' });
    prisma.user.findUnique.mockResolvedValue({ username: 'juan' });

    const mockSplit = {
      id: 'split-1',
      creatorAddress: 'Creator1111111111111111111111111111111111111',
      totalAmount: 30_000_000n,
      token: 'USDC',
      description: 'Dinner',
      participantCount: 2,
      status: 'PENDING',
      paidCount: 0,
      totalCollected: 0n,
      createdAt: new Date('2026-02-10T00:00:00Z'),
      completedAt: null,
    };
    const mockRequests = [
      {
        id: 'req-1',
        requesteeAddress: 'Friend1111111111111111111111111111111111111',
        amount: 15_000_000n,
        status: 'PENDING',
        paymentTx: null,
      },
      {
        id: 'req-2',
        requesteeAddress: 'Friend2222222222222222222222222222222222222',
        amount: 15_000_000n,
        status: 'PENDING',
        paymentTx: null,
      },
    ];

    prisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        splitPayment: { create: jest.fn().mockResolvedValue(mockSplit) },
        paymentRequest: {
          create: jest
            .fn()
            .mockResolvedValueOnce(mockRequests[0])
            .mockResolvedValueOnce(mockRequests[1]),
        },
      };
      return fn(tx);
    });

    const result = await service.createSplit(
      'user-1',
      'Creator1111111111111111111111111111111111111',
      {
        token: 'USDC',
        totalAmount: 30,
        description: 'Dinner',
        participants: [
          { recipientIdentifier: '@friend1', amount: 15 },
          { recipientIdentifier: '@friend2', amount: 15 },
        ],
      }
    );

    expect(result.id).toBe('split-1');
    expect(result.participantCount).toBe(2);
    expect(result.participants).toHaveLength(2);
    expect(eventEmitter.emit).toHaveBeenCalledTimes(2);
    expect(eventEmitter.emit).toHaveBeenCalledWith('split.request.created', expect.any(Object));
  });

  it('rejects when shares do not sum to total', async () => {
    await expect(
      service.createSplit('user-1', 'Creator1', {
        token: 'USDC',
        totalAmount: 30,
        description: 'Dinner',
        participants: [
          { recipientIdentifier: '@a', amount: 10 },
          { recipientIdentifier: '@b', amount: 10 },
        ],
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects self-split', async () => {
    socialService.lookupUser.mockResolvedValue({
      walletAddress: 'Creator1111111111111111111111111111111111111',
    });

    await expect(
      service.createSplit('user-1', 'Creator1111111111111111111111111111111111111', {
        token: 'USDC',
        totalAmount: 10,
        description: 'Self',
        participants: [{ recipientIdentifier: '@me', amount: 10 }],
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('PaymentsService.cancelSplit', () => {
  const prisma: any = {
    splitPayment: { findUnique: jest.fn(), update: jest.fn() },
    paymentRequest: { updateMany: jest.fn() },
    $transaction: jest.fn(),
  };

  const service = new PaymentsService(prisma, mockEventEmitter, mockSocialService);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('cancels a pending split', async () => {
    prisma.splitPayment.findUnique.mockResolvedValue({
      id: 'split-1',
      creatorAddress: 'Creator111',
      status: 'PENDING',
    });
    prisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        splitPayment: { update: jest.fn() },
        paymentRequest: { updateMany: jest.fn() },
      };
      return fn(tx);
    });

    const result = await service.cancelSplit('split-1', 'Creator111');
    expect(result.status).toBe('CANCELLED');
  });

  it('rejects if not creator', async () => {
    prisma.splitPayment.findUnique.mockResolvedValue({
      id: 'split-1',
      creatorAddress: 'Creator111',
      status: 'PENDING',
    });

    await expect(service.cancelSplit('split-1', 'WrongWallet')).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it('rejects if completed', async () => {
    prisma.splitPayment.findUnique.mockResolvedValue({
      id: 'split-1',
      creatorAddress: 'Creator111',
      status: 'COMPLETED',
    });

    await expect(service.cancelSplit('split-1', 'Creator111')).rejects.toBeInstanceOf(
      BadRequestException
    );
  });
});

describe('PaymentsService.getSplit', () => {
  const prisma: any = {
    splitPayment: { findUnique: jest.fn() },
  };

  const service = new PaymentsService(prisma, mockEventEmitter, mockSocialService);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns formatted split for creator', async () => {
    prisma.splitPayment.findUnique.mockResolvedValue({
      id: 'split-1',
      creatorAddress: 'Creator111',
      totalAmount: 50_000_000n,
      token: 'USDC',
      description: 'Dinner',
      participantCount: 2,
      status: 'PARTIAL',
      paidCount: 1,
      totalCollected: 25_000_000n,
      createdAt: new Date('2026-02-10'),
      completedAt: null,
      requests: [
        { id: 'r1', requesteeAddress: 'A', amount: 25_000_000n, status: 'PAID', paymentTx: 'tx1' },
        {
          id: 'r2',
          requesteeAddress: 'B',
          amount: 25_000_000n,
          status: 'PENDING',
          paymentTx: null,
        },
      ],
    });

    const result = await service.getSplit('split-1', 'Creator111');
    expect(result.id).toBe('split-1');
    expect(result.totalAmount).toBe(50);
    expect(result.paidCount).toBe(1);
    expect(result.participants).toHaveLength(2);
  });

  it('rejects if not creator', async () => {
    prisma.splitPayment.findUnique.mockResolvedValue({
      id: 'split-1',
      creatorAddress: 'Creator111',
    });

    await expect(service.getSplit('split-1', 'WrongWallet')).rejects.toBeInstanceOf(
      BadRequestException
    );
  });
});

describe('PaymentsService.declineRequest', () => {
  const prisma: any = {
    paymentRequest: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const eventEmitter: any = { emit: jest.fn() };
  const service = new PaymentsService(prisma, eventEmitter, mockSocialService);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('declines a pending request', async () => {
    prisma.paymentRequest.findUnique.mockResolvedValue({
      id: 'req-1',
      recipientAddress: 'Requester111',
      requesteeAddress: 'Requestee111',
      token: 'USDC',
      amount: 5_000_000n,
      status: 'PENDING',
    });
    prisma.paymentRequest.update.mockResolvedValue({});

    const result = await service.declineRequest('req-1', 'Requestee111');
    expect(result.status).toBe('DECLINED');
    expect(eventEmitter.emit).toHaveBeenCalledWith('payment.request.declined', expect.any(Object));
  });

  it('rejects if caller is not requestee', async () => {
    prisma.paymentRequest.findUnique.mockResolvedValue({
      id: 'req-1',
      requesteeAddress: 'Requestee111',
      status: 'PENDING',
    });

    await expect(service.declineRequest('req-1', 'WrongWallet')).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it('rejects if already paid', async () => {
    prisma.paymentRequest.findUnique.mockResolvedValue({
      id: 'req-1',
      requesteeAddress: 'Requestee111',
      status: 'PAID',
    });

    await expect(service.declineRequest('req-1', 'Requestee111')).rejects.toBeInstanceOf(
      BadRequestException
    );
  });
});
