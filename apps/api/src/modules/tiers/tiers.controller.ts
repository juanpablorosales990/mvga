import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TiersService } from './tiers.service';

@ApiTags('Tiers')
@Controller('tiers')
export class TiersController {
  constructor(private readonly tiersService: TiersService) {}

  @Get()
  @ApiOperation({ summary: 'Get all tier definitions' })
  getTiers() {
    return this.tiersService.getTiers();
  }

  @Get(':address')
  @ApiOperation({ summary: 'Get user tier info by wallet address' })
  async getUserTier(@Param('address') address: string) {
    return this.tiersService.getUserTier(address);
  }
}
