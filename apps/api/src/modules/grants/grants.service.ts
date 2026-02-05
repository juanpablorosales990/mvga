import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma.service';
import { TransactionLoggerService } from '../../common/transaction-logger.service';
import { SolanaService } from '../wallet/solana.service';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { CastVoteDto, PostUpdateDto } from './dto/cast-vote.dto';
import { Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from '@solana/spl-token';

const AMOUNT_SCALE = 1_000_000;
const MVGA_DECIMALS = 9;
const USDC_DECIMALS = 6;
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

@Injectable()
export class GrantsService {
  private readonly logger = new Logger(GrantsService.name);
  private humanitarianFundKeypair: Keypair | null = null;
  private usdcMint: PublicKey;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly txLogger: TransactionLoggerService,
    private readonly solana: SolanaService
  ) {
    this.usdcMint = new PublicKey(USDC_MINT);

    const keypairStr = this.config.get<string>('HUMANITARIAN_FUND_KEYPAIR');
    if (keypairStr) {
      try {
        const decoded = Buffer.from(keypairStr, 'base64');
        this.humanitarianFundKeypair = Keypair.fromSecretKey(
          new Uint8Array(JSON.parse(decoded.toString()))
        );
        this.logger.log('Humanitarian fund keypair loaded for grant disbursement');
      } catch (e) {
        this.logger.warn(`HUMANITARIAN_FUND_KEYPAIR invalid: ${(e as Error).message}`);
      }
    } else {
      this.logger.warn('HUMANITARIAN_FUND_KEYPAIR not set — grant disbursement unavailable');
    }
  }

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

  // Auto-disburse approved grants (runs every 15 minutes)
  @Cron('*/15 * * * *')
  async autoDisburseGrants() {
    if (!this.humanitarianFundKeypair) {
      return; // Can't disburse without keypair
    }

    const approvedGrants = await this.prisma.grantProposal.findMany({
      where: { status: 'APPROVED' },
      take: 5, // Process 5 at a time to avoid timeout
    });

    for (const grant of approvedGrants) {
      try {
        await this.disburseGrant(grant.id);
      } catch (e) {
        this.logger.error(`Failed to disburse grant ${grant.id}: ${(e as Error).message}`);
      }
    }

    if (approvedGrants.length > 0) {
      this.logger.log(`Processed ${approvedGrants.length} grant disbursements`);
    }
  }

  async disburseGrant(proposalId: string) {
    const proposal = await this.prisma.grantProposal.findUnique({
      where: { id: proposalId },
    });

    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    if (proposal.status !== 'APPROVED') {
      throw new BadRequestException('Only approved proposals can be funded');
    }

    if (!this.humanitarianFundKeypair) {
      throw new BadRequestException('Grant disbursement is not configured');
    }

    // Amount is stored as USD * AMOUNT_SCALE, convert to USDC (6 decimals)
    const usdAmount = Number(proposal.requestedAmount) / AMOUNT_SCALE;
    const usdcRawAmount = BigInt(Math.round(usdAmount * 10 ** USDC_DECIMALS));

    const connection = this.solana.getConnection();
    const recipientPubkey = new PublicKey(proposal.applicantAddress);

    const fundAta = await getAssociatedTokenAddress(
      this.usdcMint,
      this.humanitarianFundKeypair.publicKey
    );
    const recipientAta = await getAssociatedTokenAddress(this.usdcMint, recipientPubkey);

    const tx = new Transaction();

    // Create recipient ATA if needed
    try {
      await getAccount(connection, recipientAta);
    } catch {
      tx.add(
        createAssociatedTokenAccountInstruction(
          this.humanitarianFundKeypair.publicKey,
          recipientAta,
          recipientPubkey,
          this.usdcMint
        )
      );
    }

    // Transfer USDC from humanitarian fund to recipient
    tx.add(
      createTransferInstruction(
        fundAta,
        recipientAta,
        this.humanitarianFundKeypair.publicKey,
        usdcRawAmount
      )
    );

    const sig = await sendAndConfirmTransaction(connection, tx, [this.humanitarianFundKeypair]);

    // Update proposal status
    await this.prisma.grantProposal.update({
      where: { id: proposalId },
      data: {
        status: 'FUNDED',
        fundedAt: new Date(),
        fundingTx: sig,
      },
    });

    // Log transaction
    await this.txLogger.log({
      walletAddress: proposal.applicantAddress,
      type: 'GRANT_FUNDING',
      signature: sig,
      amount: usdAmount,
      token: 'USDC',
    });
    await this.txLogger.confirm(sig);

    this.logger.log(
      `Grant ${proposalId} (${proposal.businessName}) funded: $${usdAmount} USDC to ${proposal.applicantAddress}`
    );

    return {
      proposalId,
      amount: usdAmount,
      signature: sig,
      status: 'FUNDED',
    };
  }

  // Manual disbursement endpoint (admin use)
  async manualDisburse(proposalId: string, adminAddress: string) {
    // For now, any authenticated user can trigger disbursement
    // In production, add admin role check
    this.logger.log(`Manual disbursement triggered by ${adminAddress} for proposal ${proposalId}`);
    return this.disburseGrant(proposalId);
  }
}
