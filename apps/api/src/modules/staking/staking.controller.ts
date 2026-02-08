import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { StakingService } from './staking.service';
import { StakeDto, UnstakeDto, ConfirmStakeDto, ToggleAutoCompoundDto } from './staking.dto';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth.decorator';
import { ParseSolanaAddressPipe } from '../../common/validators/solana-address.validator';

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
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Get staking position for a wallet' })
  @ApiParam({ name: 'address', description: 'Wallet address' })
  async getStakingPosition(@Param('address', ParseSolanaAddressPipe) address: string) {
    return this.stakingService.getStakingPosition(address);
  }

  @Post('stake')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create staking transaction (returns vault info)' })
  async stake(@Body() dto: StakeDto, @CurrentUser('wallet') wallet: string) {
    dto.address = wallet;
    return this.stakingService.createStakeTransaction(dto);
  }

  @Post('confirm-stake')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirm stake after user signs the transaction' })
  async confirmStake(@CurrentUser('wallet') wallet: string, @Body() dto: ConfirmStakeDto) {
    return this.stakingService.confirmStake(wallet, dto.signature, dto.amount, dto.lockPeriod);
  }

  @Post('unstake')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unstake tokens (server-signed transfer from vault)' })
  async unstake(@Body() dto: UnstakeDto, @CurrentUser('wallet') wallet: string) {
    dto.address = wallet;
    return this.stakingService.createUnstakeTransaction(dto);
  }

  @Post(':address/claim')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Claim staking rewards' })
  async claimRewards(@CurrentUser('wallet') wallet: string) {
    return this.stakingService.createClaimTransaction(wallet);
  }

  @Post('auto-compound')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle auto-compound for a stake' })
  async toggleAutoCompound(
    @CurrentUser('wallet') wallet: string,
    @Body() dto: ToggleAutoCompoundDto
  ) {
    return this.stakingService.toggleAutoCompound(wallet, dto.stakeId, dto.enabled);
  }
}
