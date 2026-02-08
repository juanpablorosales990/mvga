import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TopUpService } from './topup.service';
import { DetectOperatorDto, CreateTopUpDto } from './dto/topup.dto';

@ApiTags('TopUp')
@Controller('topup')
export class TopUpController {
  constructor(private readonly topUpService: TopUpService) {}

  @Get('operators/:countryCode')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  async getOperators(@Param('countryCode') countryCode: string) {
    return this.topUpService.getOperators(countryCode);
  }

  @Post('detect-operator')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  async detectOperator(@Body() dto: DetectOperatorDto) {
    return this.topUpService.detectOperator(dto.phone, dto.countryCode);
  }

  @Post('topup')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  async topUp(@CurrentUser('wallet') wallet: string, @Body() dto: CreateTopUpDto) {
    return this.topUpService.topUp(wallet, dto.phone, dto.countryCode, dto.operatorId, dto.amount);
  }

  @Get('history')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  async getHistory(@CurrentUser('wallet') wallet: string) {
    return this.topUpService.getHistory(wallet);
  }

  @Get('balance')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  async getBalance() {
    return this.topUpService.getBalance();
  }
}
