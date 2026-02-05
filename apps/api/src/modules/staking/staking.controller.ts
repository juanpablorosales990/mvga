import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { StakingService } from './staking.service';
import { StakeDto, UnstakeDto } from './staking.dto';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth.decorator';

@ApiTags('Staking')
@Controller('staking')
export class StakingController {
  constructor(private readonly stakingService: StakingService) {}

  @Get('info')
  @ApiOperation({ summary: 'Get staking pool information' })
  async getStakingInfo() {
    return this.stakingService.getStakingInfo();
  }

  @Get('tiers')
  @ApiOperation({ summary: 'Get staking tier information' })
  async getTiers() {
    return this.stakingService.getTiers();
  }

  @Get(':address')
  @ApiOperation({ summary: 'Get staking position for a wallet' })
  @ApiParam({ name: 'address', description: 'Wallet address' })
  async getStakingPosition(@Param('address') address: string) {
    return this.stakingService.getStakingPosition(address);
  }

  @Post('stake')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create staking transaction (returns vault info)' })
  async stake(
    @Body() dto: StakeDto,
    @CurrentUser('wallet') wallet: string,
  ) {
    dto.address = wallet;
    return this.stakingService.createStakeTransaction(dto);
  }

  @Post('confirm-stake')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirm stake after user signs the transaction' })
  async confirmStake(
    @CurrentUser('wallet') wallet: string,
    @Body() body: { signature: string; amount: number; lockPeriod: number },
  ) {
    return this.stakingService.confirmStake(
      wallet,
      body.signature,
      body.amount,
      body.lockPeriod,
    );
  }

  @Post('unstake')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unstake tokens (server-signed transfer from vault)' })
  async unstake(
    @Body() dto: UnstakeDto,
    @CurrentUser('wallet') wallet: string,
  ) {
    dto.address = wallet;
    return this.stakingService.createUnstakeTransaction(dto);
  }

  @Post(':address/claim')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Claim staking rewards' })
  async claimRewards(@CurrentUser('wallet') wallet: string) {
    return this.stakingService.createClaimTransaction(wallet);
  }
}
