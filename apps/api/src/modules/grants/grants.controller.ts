import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { GrantsService } from './grants.service';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { CastVoteDto, PostUpdateDto } from './dto/cast-vote.dto';
import { AuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUser } from '../auth/auth.decorator';
import { Roles } from '../auth/roles.decorator';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Grants')
@Controller('grants')
export class GrantsController {
  constructor(private readonly grantsService: GrantsService) {}

  @Get('proposals')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'List grant proposals' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['VOTING', 'APPROVED', 'REJECTED', 'FUNDED', 'COMPLETED'],
  })
  async getProposals(@Query('status') status?: string) {
    return this.grantsService.getProposals(status);
  }

  @Get('proposals/:id')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Get proposal detail with votes and updates' })
  async getProposal(@Param('id') id: string) {
    return this.grantsService.getProposal(id);
  }

  @Post('proposals')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { ttl: 86400000, limit: 3 } })
  @ApiOperation({ summary: 'Create a grant proposal (must be staker, max 3/day)' })
  async createProposal(@CurrentUser('wallet') wallet: string, @Body() dto: CreateProposalDto) {
    dto.applicantAddress = wallet;
    return this.grantsService.createProposal(dto);
  }

  @Post('proposals/:id/vote')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'Cast a vote (weight = staked MVGA)' })
  async castVote(
    @Param('id') id: string,
    @CurrentUser('wallet') wallet: string,
    @Body() dto: CastVoteDto
  ) {
    dto.voterAddress = wallet;
    return this.grantsService.castVote(id, dto);
  }

  @Get('proposals/:id/votes')
  @ApiOperation({ summary: 'List votes for a proposal' })
  async getVotes(@Param('id') id: string) {
    return this.grantsService.getVotes(id);
  }

  @Post('proposals/:id/updates')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'Post an update (applicant only)' })
  async postUpdate(
    @Param('id') id: string,
    @CurrentUser('wallet') wallet: string,
    @Body() dto: PostUpdateDto
  ) {
    return this.grantsService.postUpdate(id, wallet, dto);
  }

  @Post('proposals/:id/disburse')
  @UseGuards(AuthGuard, AdminGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @ApiOperation({ summary: 'Manually trigger grant disbursement (admin only)' })
  async disburseGrant(@Param('id') id: string, @CurrentUser('wallet') wallet: string) {
    return this.grantsService.manualDisburse(id, wallet);
  }
}
