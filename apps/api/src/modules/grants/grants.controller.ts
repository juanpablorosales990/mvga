import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { GrantsService } from './grants.service';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { CastVoteDto, PostUpdateDto } from './dto/cast-vote.dto';
import { AuthGuard } from '../auth/auth.guard';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Grants')
@Controller('grants')
export class GrantsController {
  constructor(private readonly grantsService: GrantsService) {}

  @Get('proposals')
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
  @ApiOperation({ summary: 'Get proposal detail with votes and updates' })
  async getProposal(@Param('id') id: string) {
    return this.grantsService.getProposal(id);
  }

  @Post('proposals')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { ttl: 86400000, limit: 3 } })
  @ApiOperation({ summary: 'Create a grant proposal (must be staker, max 3/day)' })
  async createProposal(@Body() dto: CreateProposalDto) {
    return this.grantsService.createProposal(dto);
  }

  @Post('proposals/:id/vote')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'Cast a vote (weight = staked MVGA)' })
  async castVote(@Param('id') id: string, @Body() dto: CastVoteDto) {
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
    @Body() dto: PostUpdateDto & { applicantAddress: string }
  ) {
    return this.grantsService.postUpdate(id, dto.applicantAddress, dto);
  }
}
