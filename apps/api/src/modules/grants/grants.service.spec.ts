import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GrantsService } from './grants.service';

const AMOUNT_SCALE = 1_000_000;
const MVGA_DECIMALS = 9;

describe('GrantsService', () => {
  let service: GrantsService;
  let mockPrisma: any;
  let mockConfig: any;
  let mockTxLogger: any;
  let mockSolana: any;

  beforeEach(() => {
    mockPrisma = {
      grantProposal: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      vote: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      grantUpdate: {
        create: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      stake: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        aggregate: jest.fn(),
      },
    };

    mockConfig = {
      get: jest.fn((key: string) => {
        if (key === 'HUMANITARIAN_FUND_KEYPAIR') return undefined;
        return undefined;
      }),
    };

    mockTxLogger = {
      log: jest.fn(),
      confirm: jest.fn(),
    };

    mockSolana = {
      getConnection: jest.fn(),
    };

    const mockCronLockService = {
      acquireLock: jest.fn().mockResolvedValue('lock-id'),
      releaseLock: jest.fn().mockResolvedValue(undefined),
    };
    service = new GrantsService(
      mockPrisma,
      mockCronLockService as any,
      mockConfig,
      mockTxLogger,
      mockSolana
    );
  });

  describe('getProposals', () => {
    it('returns formatted proposals list', async () => {
      mockPrisma.grantProposal.findMany.mockResolvedValue([
        {
          id: 'p-1',
          businessName: 'Test Business',
          businessLocation: 'Caracas',
          description: 'A test business',
          requestedAmount: BigInt(5000 * AMOUNT_SCALE),
          videoUrl: null,
          applicantAddress: 'wallet-1',
          status: 'VOTING',
          votesFor: 3,
          votesAgainst: 1,
          votingEndsAt: new Date(),
          fundedAt: null,
          fundingTx: null,
          createdAt: new Date(),
          _count: { votes: 4 },
        },
      ]);

      const result = await service.getProposals();
      expect(result).toHaveLength(1);
      expect(result[0].businessName).toBe('Test Business');
      expect(result[0].requestedAmount).toBe(5000);
      expect(result[0].totalVotes).toBe(4);
    });

    it('filters by status when provided', async () => {
      mockPrisma.grantProposal.findMany.mockResolvedValue([]);

      await service.getProposals('APPROVED');
      expect(mockPrisma.grantProposal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'APPROVED' },
        })
      );
    });

    it('returns empty array when no proposals', async () => {
      mockPrisma.grantProposal.findMany.mockResolvedValue([]);

      const result = await service.getProposals();
      expect(result).toEqual([]);
    });
  });

  describe('getProposal', () => {
    it('throws NotFoundException for unknown proposal', async () => {
      mockPrisma.grantProposal.findUnique.mockResolvedValue(null);

      await expect(service.getProposal('unknown')).rejects.toThrow(NotFoundException);
    });

    it('returns detailed proposal with votes and updates', async () => {
      mockPrisma.grantProposal.findUnique.mockResolvedValue({
        id: 'p-1',
        businessName: 'Test',
        businessLocation: 'Maracaibo',
        description: 'Desc',
        requestedAmount: BigInt(1000 * AMOUNT_SCALE),
        videoUrl: null,
        applicantAddress: 'wallet',
        status: 'VOTING',
        votesFor: 1,
        votesAgainst: 0,
        votingEndsAt: new Date(),
        fundedAt: null,
        fundingTx: null,
        createdAt: new Date(),
        _count: { votes: 1 },
        votes: [
          {
            voter: { walletAddress: 'voter-1' },
            direction: 'FOR',
            weight: BigInt(10000 * 10 ** MVGA_DECIMALS),
            createdAt: new Date(),
          },
        ],
        updates: [],
      });

      const result = await service.getProposal('p-1');
      expect(result.votes).toHaveLength(1);
      expect(result.votes[0].weight).toBe(10000);
      expect(result.requestedAmount).toBe(1000);
    });
  });

  describe('createProposal', () => {
    it('throws if wallet not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.createProposal({
          businessName: 'Biz',
          businessLocation: 'Caracas',
          description: 'Desc',
          requestedAmount: 1000,
          applicantAddress: 'unknown-wallet',
          votingDays: 7,
        })
      ).rejects.toThrow('You must have a wallet connected');
    });

    it('throws if user has no active stake', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrisma.stake.findFirst.mockResolvedValue(null);

      await expect(
        service.createProposal({
          businessName: 'Biz',
          businessLocation: 'Caracas',
          description: 'Desc',
          requestedAmount: 1000,
          applicantAddress: 'wallet',
          votingDays: 7,
        })
      ).rejects.toThrow('You must have an active MVGA stake');
    });

    it('creates proposal with correct voting end date', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrisma.stake.findFirst.mockResolvedValue({ id: 'stake-1', status: 'ACTIVE' });

      const now = Date.now();
      mockPrisma.grantProposal.create.mockImplementation((args: any) => ({
        id: 'new-proposal',
        businessName: args.data.businessName,
        status: 'VOTING',
        votingEndsAt: args.data.votingEndsAt,
      }));

      const result = await service.createProposal({
        businessName: 'Biz',
        businessLocation: 'Caracas',
        description: 'Desc',
        requestedAmount: 1000,
        applicantAddress: 'wallet',
        votingDays: 14,
      });

      expect(result.businessName).toBe('Biz');
      expect(result.status).toBe('VOTING');
      // Voting ends ~14 days from now
      const endTime = new Date(result.votingEndsAt).getTime();
      expect(endTime).toBeGreaterThan(now + 13 * 24 * 60 * 60 * 1000);
      expect(endTime).toBeLessThan(now + 15 * 24 * 60 * 60 * 1000);
    });

    it('defaults to 7-day voting period', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrisma.stake.findFirst.mockResolvedValue({ id: 'stake-1', status: 'ACTIVE' });

      const now = Date.now();
      mockPrisma.grantProposal.create.mockImplementation((args: any) => ({
        id: 'p',
        businessName: 'Biz',
        status: 'VOTING',
        votingEndsAt: args.data.votingEndsAt,
      }));

      const result = await service.createProposal({
        businessName: 'Biz',
        businessLocation: 'Caracas',
        description: 'Desc',
        requestedAmount: 1000,
        applicantAddress: 'wallet',
        votingDays: 7,
      });

      const endTime = new Date(result.votingEndsAt).getTime();
      expect(endTime).toBeGreaterThan(now + 6 * 24 * 60 * 60 * 1000);
      expect(endTime).toBeLessThan(now + 8 * 24 * 60 * 60 * 1000);
    });
  });

  describe('castVote', () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    it('throws if proposal not found', async () => {
      mockPrisma.grantProposal.findUnique.mockResolvedValue(null);

      await expect(
        service.castVote('unknown', { voterAddress: 'wallet', direction: 'FOR' })
      ).rejects.toThrow(NotFoundException);
    });

    it('throws if voting has ended (status)', async () => {
      mockPrisma.grantProposal.findUnique.mockResolvedValue({
        id: 'p-1',
        status: 'APPROVED',
        votingEndsAt: futureDate,
      });

      await expect(
        service.castVote('p-1', { voterAddress: 'wallet', direction: 'FOR' })
      ).rejects.toThrow('Voting has ended');
    });

    it('throws if voting period has expired', async () => {
      mockPrisma.grantProposal.findUnique.mockResolvedValue({
        id: 'p-1',
        status: 'VOTING',
        votingEndsAt: new Date(Date.now() - 1000),
      });

      await expect(
        service.castVote('p-1', { voterAddress: 'wallet', direction: 'FOR' })
      ).rejects.toThrow('Voting period has expired');
    });

    it('throws if user has no staked MVGA', async () => {
      mockPrisma.grantProposal.findUnique.mockResolvedValue({
        id: 'p-1',
        status: 'VOTING',
        votingEndsAt: futureDate,
      });
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrisma.stake.findMany.mockResolvedValue([]);

      await expect(
        service.castVote('p-1', { voterAddress: 'wallet', direction: 'FOR' })
      ).rejects.toThrow('You must have staked MVGA to vote');
    });

    it('throws if user already voted', async () => {
      mockPrisma.grantProposal.findUnique.mockResolvedValue({
        id: 'p-1',
        status: 'VOTING',
        votingEndsAt: futureDate,
      });
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrisma.stake.findMany.mockResolvedValue([
        { amount: BigInt(10000 * 10 ** MVGA_DECIMALS) },
      ]);
      mockPrisma.vote.findUnique.mockResolvedValue({ id: 'existing-vote' });

      await expect(
        service.castVote('p-1', { voterAddress: 'wallet', direction: 'FOR' })
      ).rejects.toThrow('You have already voted');
    });

    it('successfully casts a FOR vote', async () => {
      mockPrisma.grantProposal.findUnique.mockResolvedValue({
        id: 'p-1',
        status: 'VOTING',
        votingEndsAt: futureDate,
      });
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrisma.stake.findMany.mockResolvedValue([
        { amount: BigInt(50000 * 10 ** MVGA_DECIMALS) },
      ]);
      mockPrisma.vote.findUnique.mockResolvedValue(null);
      mockPrisma.vote.create.mockResolvedValue({
        weight: BigInt(50000 * 10 ** MVGA_DECIMALS),
        direction: 'FOR',
      });
      mockPrisma.grantProposal.update.mockResolvedValue({});

      const result = await service.castVote('p-1', {
        voterAddress: 'wallet',
        direction: 'FOR',
      });

      expect(result.proposalId).toBe('p-1');
      expect(result.direction).toBe('FOR');
      expect(result.weight).toBe(50000);
    });

    it('increments votesFor for FOR votes', async () => {
      mockPrisma.grantProposal.findUnique.mockResolvedValue({
        id: 'p-1',
        status: 'VOTING',
        votingEndsAt: futureDate,
      });
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrisma.stake.findMany.mockResolvedValue([{ amount: BigInt(1000 * 10 ** MVGA_DECIMALS) }]);
      mockPrisma.vote.findUnique.mockResolvedValue(null);
      mockPrisma.vote.create.mockResolvedValue({
        weight: BigInt(1000 * 10 ** MVGA_DECIMALS),
        direction: 'FOR',
      });
      mockPrisma.grantProposal.update.mockResolvedValue({});

      await service.castVote('p-1', { voterAddress: 'wallet', direction: 'FOR' });

      expect(mockPrisma.grantProposal.update).toHaveBeenCalledWith({
        where: { id: 'p-1' },
        data: { votesFor: { increment: 1 } },
      });
    });

    it('increments votesAgainst for AGAINST votes', async () => {
      mockPrisma.grantProposal.findUnique.mockResolvedValue({
        id: 'p-1',
        status: 'VOTING',
        votingEndsAt: futureDate,
      });
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrisma.stake.findMany.mockResolvedValue([{ amount: BigInt(1000 * 10 ** MVGA_DECIMALS) }]);
      mockPrisma.vote.findUnique.mockResolvedValue(null);
      mockPrisma.vote.create.mockResolvedValue({
        weight: BigInt(1000 * 10 ** MVGA_DECIMALS),
        direction: 'AGAINST',
      });
      mockPrisma.grantProposal.update.mockResolvedValue({});

      await service.castVote('p-1', { voterAddress: 'wallet', direction: 'AGAINST' });

      expect(mockPrisma.grantProposal.update).toHaveBeenCalledWith({
        where: { id: 'p-1' },
        data: { votesAgainst: { increment: 1 } },
      });
    });
  });

  describe('tallyVotes', () => {
    it('approves proposal when quorum met and majority FOR', async () => {
      mockPrisma.grantProposal.findMany.mockResolvedValue([
        { id: 'p-1', businessName: 'Test', status: 'VOTING' },
      ]);
      mockPrisma.stake.aggregate.mockResolvedValue({
        _sum: { amount: BigInt(1000000 * 10 ** MVGA_DECIMALS) },
      });
      mockPrisma.vote.findMany.mockResolvedValue([
        { direction: 'FOR', weight: BigInt(200000 * 10 ** MVGA_DECIMALS) },
        { direction: 'AGAINST', weight: BigInt(50000 * 10 ** MVGA_DECIMALS) },
      ]);
      mockPrisma.grantProposal.update.mockResolvedValue({});

      await service.tallyVotes();

      expect(mockPrisma.grantProposal.update).toHaveBeenCalledWith({
        where: { id: 'p-1' },
        data: { status: 'APPROVED' },
      });
    });

    it('rejects proposal when quorum not met', async () => {
      mockPrisma.grantProposal.findMany.mockResolvedValue([
        { id: 'p-1', businessName: 'Test', status: 'VOTING' },
      ]);
      mockPrisma.stake.aggregate.mockResolvedValue({
        _sum: { amount: BigInt(1000000 * 10 ** MVGA_DECIMALS) },
      });
      // Only 5000 total weight, quorum is 100000 (10% of 1M)
      mockPrisma.vote.findMany.mockResolvedValue([
        { direction: 'FOR', weight: BigInt(5000 * 10 ** MVGA_DECIMALS) },
      ]);
      mockPrisma.grantProposal.update.mockResolvedValue({});

      await service.tallyVotes();

      expect(mockPrisma.grantProposal.update).toHaveBeenCalledWith({
        where: { id: 'p-1' },
        data: { status: 'REJECTED' },
      });
    });

    it('rejects proposal when majority votes AGAINST', async () => {
      mockPrisma.grantProposal.findMany.mockResolvedValue([
        { id: 'p-1', businessName: 'Test', status: 'VOTING' },
      ]);
      mockPrisma.stake.aggregate.mockResolvedValue({
        _sum: { amount: BigInt(1000000 * 10 ** MVGA_DECIMALS) },
      });
      mockPrisma.vote.findMany.mockResolvedValue([
        { direction: 'FOR', weight: BigInt(50000 * 10 ** MVGA_DECIMALS) },
        { direction: 'AGAINST', weight: BigInt(200000 * 10 ** MVGA_DECIMALS) },
      ]);
      mockPrisma.grantProposal.update.mockResolvedValue({});

      await service.tallyVotes();

      expect(mockPrisma.grantProposal.update).toHaveBeenCalledWith({
        where: { id: 'p-1' },
        data: { status: 'REJECTED' },
      });
    });

    it('does nothing when no expired proposals', async () => {
      mockPrisma.grantProposal.findMany.mockResolvedValue([]);
      mockPrisma.stake.aggregate.mockResolvedValue({
        _sum: { amount: BigInt(100000 * 10 ** MVGA_DECIMALS) },
      });

      await service.tallyVotes();
      expect(mockPrisma.grantProposal.update).not.toHaveBeenCalled();
    });
  });

  describe('postUpdate', () => {
    it('throws if proposal not found', async () => {
      mockPrisma.grantProposal.findUnique.mockResolvedValue(null);

      await expect(
        service.postUpdate('unknown', 'wallet', { title: 'Update', content: 'Content' })
      ).rejects.toThrow(NotFoundException);
    });

    it('throws if caller is not the applicant', async () => {
      mockPrisma.grantProposal.findUnique.mockResolvedValue({
        id: 'p-1',
        applicantAddress: 'original-wallet',
      });

      await expect(
        service.postUpdate('p-1', 'other-wallet', { title: 'Update', content: 'Content' })
      ).rejects.toThrow('Only the applicant can post updates');
    });

    it('creates update when authorized', async () => {
      mockPrisma.grantProposal.findUnique.mockResolvedValue({
        id: 'p-1',
        applicantAddress: 'wallet',
      });
      mockPrisma.grantUpdate.create.mockResolvedValue({
        id: 'u-1',
        title: 'Progress',
        content: 'We did it',
        createdAt: new Date(),
      });

      const result = await service.postUpdate('p-1', 'wallet', {
        title: 'Progress',
        content: 'We did it',
      });

      expect(result.title).toBe('Progress');
      expect(result.content).toBe('We did it');
    });
  });
});
