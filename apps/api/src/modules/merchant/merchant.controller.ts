import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { MerchantService } from './merchant.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth.decorator';

@ApiTags('Merchant')
@Controller('merchant')
export class MerchantController {
  constructor(private readonly merchantService: MerchantService) {}

  // ── Store ──────────────────────────────────────────────────

  @Post('store')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Create a store' })
  async createStore(
    @Body() dto: CreateStoreDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('wallet') wallet: string
  ) {
    return this.merchantService.createStore(userId, wallet, dto);
  }

  @Get('store')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my store' })
  async getMyStore(@CurrentUser('id') userId: string) {
    return this.merchantService.getMyStore(userId);
  }

  @Patch('store')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Update store' })
  async updateStore(@Body() dto: UpdateStoreDto, @CurrentUser('id') userId: string) {
    return this.merchantService.updateStore(userId, dto);
  }

  // ── Products ───────────────────────────────────────────────

  @Post('products')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Add product' })
  async createProduct(@Body() dto: CreateProductDto, @CurrentUser('id') userId: string) {
    return this.merchantService.createProduct(userId, dto);
  }

  @Patch('products/:id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Update product' })
  async updateProduct(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser('id') userId: string
  ) {
    return this.merchantService.updateProduct(userId, id, dto);
  }

  @Delete('products/:id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete product (soft)' })
  async deleteProduct(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.merchantService.deleteProduct(userId, id);
  }

  @Get('products')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List my products' })
  async listProducts(@CurrentUser('id') userId: string) {
    return this.merchantService.listProducts(userId);
  }

  // ── Checkout ───────────────────────────────────────────────

  @Post('checkout')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Create POS checkout' })
  async createCheckout(
    @Body() dto: CreateCheckoutDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('wallet') wallet: string
  ) {
    return this.merchantService.createQuickCheckout(userId, wallet, dto);
  }

  // ── Orders ─────────────────────────────────────────────────

  @Get('orders')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List orders' })
  async getOrders(@CurrentUser('id') userId: string, @Query('status') status?: string) {
    return this.merchantService.getOrders(userId, status);
  }

  // ── Dashboard ──────────────────────────────────────────────

  @Get('dashboard')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Dashboard stats' })
  async getDashboard(@CurrentUser('id') userId: string) {
    return this.merchantService.getDashboard(userId);
  }

  // ── Invoices ───────────────────────────────────────────────

  @Post('invoices')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Create invoice' })
  async createInvoice(@Body() dto: CreateInvoiceDto, @CurrentUser('id') userId: string) {
    return this.merchantService.createInvoice(userId, dto);
  }

  @Patch('invoices/:id/send')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send invoice (creates payment link)' })
  async sendInvoice(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.merchantService.sendInvoice(userId, id);
  }

  @Patch('invoices/:id/cancel')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel invoice' })
  async cancelInvoice(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.merchantService.cancelInvoice(userId, id);
  }

  @Get('invoices')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List invoices' })
  async listInvoices(@CurrentUser('id') userId: string) {
    return this.merchantService.listInvoices(userId);
  }

  // ── Public Storefront ──────────────────────────────────────

  @Get('s/:slug')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Public storefront' })
  async getStorefront(@Param('slug') slug: string) {
    return this.merchantService.getPublicStore(slug);
  }

  @Post('s/:slug/checkout')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Public checkout' })
  async storefrontCheckout(@Param('slug') slug: string, @Body() dto: CreateCheckoutDto) {
    if (!dto.items || dto.items.length === 0) {
      throw new Error('Items required for storefront checkout');
    }
    return this.merchantService.createStorefrontCheckout(slug, dto.items, dto.token);
  }
}
