import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaymentsService } from './payments.service';
import { CreatePaymentRequestDto, VerifyPaymentDto } from './dto/create-payment-request.dto';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('request')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  async createRequest(@CurrentUser('wallet') wallet: string, @Body() dto: CreatePaymentRequestDto) {
    return this.paymentsService.createRequest(wallet, dto.token, dto.amount, dto.memo);
  }

  @Get('request/:id')
  async getRequest(@Param('id') id: string) {
    return this.paymentsService.getRequest(id);
  }

  @Post('request/:id/verify')
  async verifyPayment(@Param('id') id: string, @Body() dto: VerifyPaymentDto) {
    return this.paymentsService.verifyPayment(id, dto.signature);
  }
}
