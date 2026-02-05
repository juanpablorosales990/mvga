import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma.service';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { CastVoteDto, PostUpdateDto } from './dto/cast-vote.dto';

const AMOUNT_SCALE = 1_000_000;
const MVGA_DECIMALS = 9;

@Injectable()
export class GrantsService {
  private readonly logger = new Logger(GrantsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getProposals(status?: string) {
    const where = status ? { status: status as any } : {};
    const proposals = await this.prisma.grantProposal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { votes: true } } },
    });

    return proposals.map((p) => ({
      id: p.id,
      businessName: p.businessName,
      businessLocation: p.businessLocation,
      description: p.description,
      requestedAmount: Number(p.requestedAmount) / AMOUNT_SCALE,
      videoUrl: p.videoUrl,
      applicantAddress: p.applicantAddress,
      status: p.status,
      votesFor: p.votesFor,
      votesAgainst: p.votesAgainst,
      totalVotes: p._count.votes,
      votingEndsAt: p.votingEndsAt,
      fundedAt: p.fundedAt,
      fundingTx: p.fundingTx,
      createdAt: p.createdAt,
    }));
  }

  async getProposal(id: string) {
    const p = await this.prisma.grantProposal.findUnique({
      where: { id },
      include: {
        votes: { include: { voter: true } },
        updates: { orderBy: { createdAt: 'desc' } },
        _count: { select: { votes: true } },
      },
    });
    if (!p) throw new NotFoundException('Proposal not found');

    return {
      id: p.id,
      businessName: p.businessName,
      businessLocation: p.businessLocation,
      description: p.description,
      requestedAmount: Number(p.requestedAmount) / AMOUNT_SCALE,
      videoUrl: p.videoUrl,
      applicantAddress: p.applicantAddress,
      status: p.status,
      votesFor: p.votesFor,
      votesAgainst: p.votesAgainst,
      totalVotes: p._count.votes,
      votingEndsAt: p.votingEndsAt,
      fundedAt: p.fundedAt,
      fundingTx: p.fundingTx,
      createdAt: p.createdAt,
      votes: p.votes.map((v) => ({
        voterAddress: v.voter.walletAddress,
        direction: v.direction,
        weight: Number(v.weight) / 10 ** MVGA_DECIMALS,
        createdAt: v.createdAt,
      })),
      updates: p.updates.map((u) => ({
        id: u.id,
        title: u.title,
        content: u.content,
        imageUrls: u.imageUrls,
        createdAt: u.createdAt,
      })),
    };
  }

  async createProposal(dto: CreateProposalDto) {
    // Must be a staker to create proposals
    const user = await this.prisma.user.findUnique({
      where: { walletAddress: dto.applicantAddress },
    });
    if (!user) throw new BadRequestException('You must have a wallet connected');

    const activeStake = await this.prisma.stake.findFirst({
      where: { userId: user.id, status: 'ACTIVE' },
    });
    if (!activeStake) {
      throw new BadRequestException('You must have an active MVGA stake to create proposals');
    }

    const votingEndsAt = new Date(Date.now() + (dto.votingDays || 7) * 24 * 60 * 60 * 1000);

    const proposal = await this.prisma.grantProposal.create({
      data: {
        businessName: dto.businessName,
        businessLocation: dto.businessLocation,
        description: dto.description,
        requestedAmount: BigInt(Math.round(dto.requestedAmount * AMOUNT_SCALE)),
        videoUrl: dto.videoUrl,
        applicantAddress: dto.applicantAddress,
        votingEndsAt,
      },
    });

    return {
      id: proposal.id,
      businessName: proposal.businessName,
      status: proposal.status,
      votingEndsAt: proposal.votingEndsAt,
    };
  }

  async castVote(proposalId: string, dto: CastVoteDto) {
    const proposal = await this.prisma.grantProposal.findUnique({
      where: { id: proposalId },
    });
    if (!proposal) throw new NotFoundException('Proposal not found');
    if (proposal.status !== 'VOTING') {
      throw new BadRequestException('Voting has ended for this proposal');
    }
    if (new Date() > proposal.votingEndsAt) {
      throw new BadRequestException('Voting period has expired');
    }

    const user = await this.prisma.user.findUnique({
      where: { walletAddress: dto.voterAddress },
    });
    if (!user) throw new BadRequestException('Wallet not found');

    // Calculate vote weight = total staked MVGA
    const stakes = await this.prisma.stake.findMany({
      where: { userId: user.id, status: 'ACTIVE' },
    });
    const totalStaked = stakes.reduce((sum, s) => sum + Number(s.amount), 0);
    if (totalStaked === 0) {
      throw new BadRequestException('You must have staked MVGA to vote');
    }

    // Check for existing vote
    const existing = await this.prisma.vote.findUnique({
      where: { proposalId_voterId: { proposalId, voterId: user.id } },
    });
    if (existing) {
      throw new BadRequestException('You have already voted on this proposal');
    }

    const vote = await this.prisma.vote.create({
      data: {
        proposalId,
        voterId: user.id,
        weight: BigInt(totalStaked),
        direction: dto.direction,
      },
    });

    // Update vote counts
    const weightNum = Number(vote.weight) / 10 ** MVGA_DECIMALS;
    if (dto.direction === 'FOR') {
      await this.prisma.grantProposal.update({
        where: { id: proposalId },
        data: { votesFor: { increment: 1 } },
      });
    } else {
      await this.prisma.grantProposal.update({
        where: { id: proposalId },
        data: { votesAgainst: { increment: 1 } },
      });
    }

    return {
      proposalId,
      direction: dto.direction,
      weight: weightNum,
    };
  }

  async getVotes(proposalId: string) {
    const votes = await this.prisma.vote.findMany({
      where: { proposalId },
      include: { voter: true },
      orderBy: { createdAt: 'desc' },
    });

    return votes.map((v) => ({
      voterAddress: v.voter.walletAddress,
      direction: v.direction,
      weight: Number(v.weight) / 10 ** MVGA_DECIMALS,
      createdAt: v.createdAt,
    }));
  }

  async postUpdate(proposalId: string, applicantAddress: string, dto: PostUpdateDto) {
    const proposal = await this.prisma.grantProposal.findUnique({
      where: { id: proposalId },
    });
    if (!proposal) throw new NotFoundException('Proposal not found');
    if (proposal.applicantAddress !== applicantAddress) {
      throw new BadRequestException('Only the applicant can post updates');
    }

    const update = await this.prisma.grantUpdate.create({
      data: {
        proposalId,
        title: dto.title,
        content: dto.content,
      },
    });

    return {
      id: update.id,
      title: update.title,
      content: update.content,
      createdAt: update.createdAt,
    };
  }

  // Hourly cron: tally votes for expired proposals
  @Cron('0 * * * *')
  async tallyVotes() {
    const expiredProposals = await this.prisma.grantProposal.findMany({
      where: {
        status: 'VOTING',
        votingEndsAt: { lt: new Date() },
      },
    });

    // Get total staked for quorum calculation
    const totalStakedResult = await this.prisma.stake.aggregate({
      where: { status: 'ACTIVE' },
      _sum: { amount: true },
    });
    const totalStaked = Number(totalStakedResult._sum.amount ?? 0) / 10 ** MVGA_DECIMALS;
    const quorum = totalStaked * 0.1; // 10% of total staked

    for (const proposal of expiredProposals) {
      // Get weighted votes
      const votes = await this.prisma.vote.findMany({
        where: { proposalId: proposal.id },
      });

      let weightedFor = 0;
      let weightedAgainst = 0;
      for (const v of votes) {
        const w = Number(v.weight) / 10 ** MVGA_DECIMALS;
        if (v.direction === 'FOR') weightedFor += w;
        else weightedAgainst += w;
      }

      const totalWeight = weightedFor + weightedAgainst;
      const quorumMet = totalWeight >= quorum;
      const approved = quorumMet && weightedFor > weightedAgainst;

      await this.prisma.grantProposal.update({
        where: { id: proposal.id },
        data: { status: approved ? 'APPROVED' : 'REJECTED' },
      });

      this.logger.log(
        `Proposal ${proposal.id} (${proposal.businessName}): ${approved ? 'APPROVED' : 'REJECTED'} ` +
          `(for: ${weightedFor}, against: ${weightedAgainst}, quorum: ${quorumMet ? 'met' : 'not met'})`
      );
    }

    if (expiredProposals.length > 0) {
      this.logger.log(`Tallied ${expiredProposals.length} proposals`);
    }
  }
}
