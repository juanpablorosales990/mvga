import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { StakingService } from './staking.service';
import { StakeDto, UnstakeDto } from './staking.dto';

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
  @ApiOperation({ summary: 'Create staking transaction' })
  async stake(@Body() dto: StakeDto) {
    return this.stakingService.createStakeTransaction(dto);
  }

  @Post('unstake')
  @ApiOperation({ summary: 'Create unstaking transaction' })
  async unstake(@Body() dto: UnstakeDto) {
    return this.stakingService.createUnstakeTransaction(dto);
  }

  @Post(':address/claim')
  @ApiOperation({ summary: 'Claim staking rewards' })
  @ApiParam({ name: 'address', description: 'Wallet address' })
  async claimRewards(@Param('address') address: string) {
    return this.stakingService.createClaimTransaction(address);
  }
}
