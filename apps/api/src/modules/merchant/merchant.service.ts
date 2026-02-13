import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../common/prisma.service';
import { PaymentsService } from '../payments/payments.service';

const VALID_TOKENS = ['USDC', 'USDT', 'MVGA'];
const MAX_PRODUCTS = 100;
const TOKEN_DECIMALS: Record<string, number> = { USDC: 6, USDT: 6, MVGA: 9 };

@Injectable()
export class MerchantService {
  private readonly logger = new Logger(MerchantService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  // ── Store CRUD ─────────────────────────────────────────────

  async createStore(
    userId: string,
    walletAddress: string,
    dto: {
      name: string;
      slug: string;
      description?: string;
      category: string;
      acceptedTokens: string[];
    }
  ) {
    // Validate tokens
    for (const t of dto.acceptedTokens) {
      if (!VALID_TOKENS.includes(t)) {
        throw new BadRequestException(`Invalid token: ${t}. Accepted: ${VALID_TOKENS.join(', ')}`);
      }
    }

    // Check slug uniqueness
    const existingSlug = await this.prisma.store.findUnique({ where: { slug: dto.slug } });
    if (existingSlug) throw new ConflictException('Slug already taken');

    // One store per user
    const existingStore = await this.prisma.store.findUnique({ where: { ownerId: userId } });
    if (existingStore) throw new ConflictException('You already have a store');

    const store = await this.prisma.store.create({
      data: {
        ownerId: userId,
        ownerAddress: walletAddress,
        name: dto.name,
        slug: dto.slug,
        description: dto.description || null,
        category: dto.category as never,
        acceptedTokens: dto.acceptedTokens,
      },
    });

    return this.formatStore(store);
  }

  async getMyStore(userId: string) {
    const store = await this.prisma.store.findUnique({ where: { ownerId: userId } });
    if (!store) return null;
    return this.formatStore(store);
  }

  async updateStore(
    userId: string,
    dto: {
      name?: string;
      slug?: string;
      description?: string;
      category?: string;
      logoBase64?: string;
      acceptedTokens?: string[];
      isActive?: boolean;
    }
  ) {
    const store = await this.prisma.store.findUnique({ where: { ownerId: userId } });
    if (!store) throw new NotFoundException('Store not found');

    if (dto.acceptedTokens) {
      for (const t of dto.acceptedTokens) {
        if (!VALID_TOKENS.includes(t)) {
          throw new BadRequestException(`Invalid token: ${t}`);
        }
      }
    }

    if (dto.slug && dto.slug !== store.slug) {
      const existing = await this.prisma.store.findUnique({ where: { slug: dto.slug } });
      if (existing) throw new ConflictException('Slug already taken');
    }

    const updated = await this.prisma.store.update({
      where: { ownerId: userId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.slug !== undefined && { slug: dto.slug }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.category !== undefined && { category: dto.category as never }),
        ...(dto.logoBase64 !== undefined && { logoBase64: dto.logoBase64 }),
        ...(dto.acceptedTokens !== undefined && { acceptedTokens: dto.acceptedTokens }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    return this.formatStore(updated);
  }

  async getPublicStore(slug: string) {
    const store = await this.prisma.store.findUnique({
      where: { slug },
      include: {
        products: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!store || !store.isActive) throw new NotFoundException('Store not found');

    return {
      name: store.name,
      slug: store.slug,
      description: store.description,
      category: store.category,
      logoBase64: store.logoBase64,
      acceptedTokens: store.acceptedTokens,
      products: store.products.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        priceUsd: p.priceUsd,
        imageBase64: p.imageBase64,
      })),
    };
  }

  // ── Products ───────────────────────────────────────────────

  async createProduct(
    userId: string,
    dto: {
      name: string;
      description?: string;
      priceUsd: number;
      imageBase64?: string;
      sortOrder?: number;
    }
  ) {
    const store = await this.prisma.store.findUnique({ where: { ownerId: userId } });
    if (!store) throw new NotFoundException('Create a store first');

    const count = await this.prisma.storeProduct.count({ where: { storeId: store.id } });
    if (count >= MAX_PRODUCTS) {
      throw new BadRequestException(`Maximum ${MAX_PRODUCTS} products allowed`);
    }

    return this.prisma.storeProduct.create({
      data: {
        storeId: store.id,
        name: dto.name,
        description: dto.description || null,
        priceUsd: dto.priceUsd,
        imageBase64: dto.imageBase64 || null,
        sortOrder: dto.sortOrder ?? count,
      },
    });
  }

  async updateProduct(
    userId: string,
    productId: string,
    dto: {
      name?: string;
      description?: string;
      priceUsd?: number;
      imageBase64?: string;
      sortOrder?: number;
      isActive?: boolean;
    }
  ) {
    const store = await this.prisma.store.findUnique({ where: { ownerId: userId } });
    if (!store) throw new NotFoundException('Store not found');

    const product = await this.prisma.storeProduct.findUnique({ where: { id: productId } });
    if (!product || product.storeId !== store.id) throw new NotFoundException('Product not found');

    return this.prisma.storeProduct.update({
      where: { id: productId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.priceUsd !== undefined && { priceUsd: dto.priceUsd }),
        ...(dto.imageBase64 !== undefined && { imageBase64: dto.imageBase64 }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async deleteProduct(userId: string, productId: string) {
    const store = await this.prisma.store.findUnique({ where: { ownerId: userId } });
    if (!store) throw new NotFoundException('Store not found');

    const product = await this.prisma.storeProduct.findUnique({ where: { id: productId } });
    if (!product || product.storeId !== store.id) throw new NotFoundException('Product not found');

    return this.prisma.storeProduct.update({
      where: { id: productId },
      data: { isActive: false },
    });
  }

  async listProducts(userId: string) {
    const store = await this.prisma.store.findUnique({ where: { ownerId: userId } });
    if (!store) return [];

    return this.prisma.storeProduct.findMany({
      where: { storeId: store.id },
      orderBy: { sortOrder: 'asc' },
    });
  }

  // ── Checkout / Orders ──────────────────────────────────────

  async createQuickCheckout(
    userId: string,
    walletAddress: string,
    dto: { amount?: number; token: string; items?: { productId: string; quantity: number }[] }
  ) {
    const store = await this.prisma.store.findUnique({ where: { ownerId: userId } });
    if (!store) throw new NotFoundException('Store not found');

    if (!store.acceptedTokens.includes(dto.token)) {
      throw new BadRequestException(`Token ${dto.token} not accepted by this store`);
    }

    let totalUsd: number;
    let itemsJson: { name: string; qty: number; price: number }[] | null = null;

    if (dto.items && dto.items.length > 0) {
      // Catalog checkout
      const products = await this.prisma.storeProduct.findMany({
        where: { storeId: store.id, id: { in: dto.items.map((i) => i.productId) }, isActive: true },
      });

      totalUsd = 0;
      itemsJson = [];
      for (const item of dto.items) {
        const product = products.find((p) => p.id === item.productId);
        if (!product) throw new BadRequestException(`Product ${item.productId} not found`);
        totalUsd += product.priceUsd * item.quantity;
        itemsJson.push({ name: product.name, qty: item.quantity, price: product.priceUsd });
      }
    } else if (dto.amount && dto.amount > 0) {
      totalUsd = dto.amount;
    } else {
      throw new BadRequestException('Provide either amount or items');
    }

    // Auto-increment order number
    const lastOrder = await this.prisma.storeOrder.findFirst({
      where: { storeId: store.id },
      orderBy: { orderNumber: 'desc' },
    });
    const orderNumber = (lastOrder?.orderNumber ?? 0) + 1;

    // Create payment request
    const pr = await this.paymentsService.createRequest(
      walletAddress,
      dto.token,
      totalUsd,
      `Order #${orderNumber}`
    );

    const decimals = TOKEN_DECIMALS[dto.token] ?? 6;
    const totalSmallest = BigInt(Math.round(totalUsd * 10 ** decimals));

    // Create store order
    const order = await this.prisma.storeOrder.create({
      data: {
        storeId: store.id,
        orderNumber,
        paymentRequestId: pr.id,
        items: itemsJson,
        totalAmount: totalSmallest,
        token: dto.token,
      },
    });

    // Link payment request to store order
    await this.prisma.paymentRequest.update({
      where: { id: pr.id },
      data: { storeOrderId: order.id },
    });

    return {
      orderId: order.id,
      orderNumber,
      paymentRequestId: pr.id,
      paymentUrl: pr.url,
      amount: totalUsd,
      token: dto.token,
      items: itemsJson,
    };
  }

  async createStorefrontCheckout(
    slug: string,
    items: { productId: string; quantity: number }[],
    token: string
  ) {
    const store = await this.prisma.store.findUnique({ where: { slug } });
    if (!store || !store.isActive) throw new NotFoundException('Store not found');

    if (!store.acceptedTokens.includes(token)) {
      throw new BadRequestException(`Token ${token} not accepted`);
    }

    const products = await this.prisma.storeProduct.findMany({
      where: { storeId: store.id, id: { in: items.map((i) => i.productId) }, isActive: true },
    });

    let totalUsd = 0;
    const itemsJson: { name: string; qty: number; price: number }[] = [];

    for (const item of items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) throw new BadRequestException(`Product not found`);
      totalUsd += product.priceUsd * item.quantity;
      itemsJson.push({ name: product.name, qty: item.quantity, price: product.priceUsd });
    }

    const lastOrder = await this.prisma.storeOrder.findFirst({
      where: { storeId: store.id },
      orderBy: { orderNumber: 'desc' },
    });
    const orderNumber = (lastOrder?.orderNumber ?? 0) + 1;

    const pr = await this.paymentsService.createRequest(
      store.ownerAddress,
      token,
      totalUsd,
      `Order #${orderNumber}`
    );

    const decimals = TOKEN_DECIMALS[token] ?? 6;
    const totalSmallest = BigInt(Math.round(totalUsd * 10 ** decimals));

    const order = await this.prisma.storeOrder.create({
      data: {
        storeId: store.id,
        orderNumber,
        paymentRequestId: pr.id,
        items: itemsJson,
        totalAmount: totalSmallest,
        token,
      },
    });

    await this.prisma.paymentRequest.update({
      where: { id: pr.id },
      data: { storeOrderId: order.id },
    });

    return {
      paymentRequestId: pr.id,
      paymentUrl: pr.url,
    };
  }

  async getOrders(userId: string, status?: string) {
    const store = await this.prisma.store.findUnique({ where: { ownerId: userId } });
    if (!store) return [];

    return this.prisma.storeOrder.findMany({
      where: {
        storeId: store.id,
        ...(status && { status: status as never }),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // ── Dashboard ──────────────────────────────────────────────

  async getDashboard(userId: string) {
    const store = await this.prisma.store.findUnique({ where: { ownerId: userId } });
    if (!store) return null;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);

    const [todayOrders, weekOrders, recentOrders] = await Promise.all([
      this.prisma.storeOrder.findMany({
        where: { storeId: store.id, status: 'PAID', paidAt: { gte: todayStart } },
      }),
      this.prisma.storeOrder.findMany({
        where: { storeId: store.id, status: 'PAID', paidAt: { gte: weekStart } },
      }),
      this.prisma.storeOrder.findMany({
        where: { storeId: store.id },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    const sumRevenue = (orders: { totalAmount: bigint; token: string }[]) =>
      orders.reduce((sum, o) => {
        const dec = TOKEN_DECIMALS[o.token] ?? 6;
        return sum + Number(o.totalAmount) / 10 ** dec;
      }, 0);

    return {
      storeName: store.name,
      slug: store.slug,
      todaySales: todayOrders.length,
      todayRevenue: sumRevenue(todayOrders),
      weekRevenue: sumRevenue(weekOrders),
      totalOrders: store.totalOrders,
      totalRevenue: Number(store.totalRevenue) / 10 ** 6, // assume USDC scale
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        items: o.items,
        totalAmount: Number(o.totalAmount) / 10 ** (TOKEN_DECIMALS[o.token] ?? 6),
        token: o.token,
        status: o.status,
        createdAt: o.createdAt,
        paidAt: o.paidAt,
      })),
    };
  }

  // ── Invoices ───────────────────────────────────────────────

  async createInvoice(
    userId: string,
    dto: {
      customerName?: string;
      customerEmail?: string;
      customerAddress?: string;
      items: { description: string; quantity: number; unitPrice: number }[];
      token: string;
      memo?: string;
      dueDate?: string;
    }
  ) {
    const store = await this.prisma.store.findUnique({ where: { ownerId: userId } });
    if (!store) throw new NotFoundException('Create a store first');

    const total = dto.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
    const itemsJson = dto.items.map((i) => ({
      description: i.description,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      subtotal: i.quantity * i.unitPrice,
    }));

    // Auto-increment invoice number
    const lastInvoice = await this.prisma.storeInvoice.findFirst({
      where: { storeId: store.id },
      orderBy: { createdAt: 'desc' },
    });
    const lastNum = lastInvoice?.invoiceNumber
      ? parseInt(lastInvoice.invoiceNumber.replace('INV-', ''), 10)
      : 0;
    const invoiceNumber = `INV-${String(lastNum + 1).padStart(3, '0')}`;

    const invoice = await this.prisma.storeInvoice.create({
      data: {
        storeId: store.id,
        invoiceNumber,
        customerName: dto.customerName || null,
        customerEmail: dto.customerEmail || null,
        customerAddress: dto.customerAddress || null,
        items: itemsJson,
        totalAmount: total,
        token: dto.token,
        memo: dto.memo || null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      },
    });

    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      totalAmount: invoice.totalAmount,
      token: invoice.token,
      status: invoice.status,
    };
  }

  async sendInvoice(userId: string, invoiceId: string) {
    const store = await this.prisma.store.findUnique({ where: { ownerId: userId } });
    if (!store) throw new NotFoundException('Store not found');

    const invoice = await this.prisma.storeInvoice.findUnique({ where: { id: invoiceId } });
    if (!invoice || invoice.storeId !== store.id) throw new NotFoundException('Invoice not found');
    if (invoice.status !== 'DRAFT')
      throw new BadRequestException('Only draft invoices can be sent');

    const pr = await this.paymentsService.createRequest(
      store.ownerAddress,
      invoice.token,
      invoice.totalAmount,
      `Invoice ${invoice.invoiceNumber}`
    );

    await this.prisma.storeInvoice.update({
      where: { id: invoiceId },
      data: {
        status: 'SENT',
        paymentRequestId: pr.id,
        paymentUrl: pr.url,
        sentAt: new Date(),
      },
    });

    return { status: 'SENT', paymentRequestId: pr.id, paymentUrl: pr.url };
  }

  async cancelInvoice(userId: string, invoiceId: string) {
    const store = await this.prisma.store.findUnique({ where: { ownerId: userId } });
    if (!store) throw new NotFoundException('Store not found');

    const invoice = await this.prisma.storeInvoice.findUnique({ where: { id: invoiceId } });
    if (!invoice || invoice.storeId !== store.id) throw new NotFoundException('Invoice not found');
    if (!['DRAFT', 'SENT'].includes(invoice.status)) {
      throw new BadRequestException('Cannot cancel this invoice');
    }

    await this.prisma.storeInvoice.update({
      where: { id: invoiceId },
      data: { status: 'CANCELLED' },
    });

    return { status: 'CANCELLED' };
  }

  async listInvoices(userId: string) {
    const store = await this.prisma.store.findUnique({ where: { ownerId: userId } });
    if (!store) return [];

    return this.prisma.storeInvoice.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // ── Event Listener ─────────────────────────────────────────

  @OnEvent('payment.request.paid')
  async onPaymentRequestPaid(event: {
    requestId: string;
    amount: number;
    token: string;
    storeOrderId?: string | null;
  }) {
    // Check if this payment is linked to a store order
    const order = await this.prisma.storeOrder.findUnique({
      where: { paymentRequestId: event.requestId },
      include: { store: true },
    });

    if (!order) return; // Not a merchant payment

    const decimals = TOKEN_DECIMALS[order.token] ?? 6;
    const revenueAmount = order.totalAmount;

    await this.prisma.$transaction([
      this.prisma.storeOrder.update({
        where: { id: order.id },
        data: { status: 'PAID', paidAt: new Date() },
      }),
      this.prisma.store.update({
        where: { id: order.storeId },
        data: {
          totalOrders: { increment: 1 },
          totalRevenue: { increment: revenueAmount },
        },
      }),
    ]);

    // Also check if there's a linked invoice
    const invoice = await this.prisma.storeInvoice.findUnique({
      where: { paymentRequestId: event.requestId },
    });
    if (invoice) {
      await this.prisma.storeInvoice.update({
        where: { id: invoice.id },
        data: { status: 'PAID', paidAt: new Date() },
      });
    }

    this.eventEmitter.emit('merchant.order.paid', {
      merchantWallet: order.store.ownerAddress,
      storeName: order.store.name,
      orderNumber: order.orderNumber,
      amount: Number(order.totalAmount) / 10 ** decimals,
      token: order.token,
    });

    this.logger.log(`Order #${order.orderNumber} paid for store ${order.store.slug}`);
  }

  // ── Helpers ────────────────────────────────────────────────

  private formatStore(store: {
    id: string;
    ownerId: string;
    ownerAddress: string;
    name: string;
    slug: string;
    description: string | null;
    category: string;
    logoBase64: string | null;
    acceptedTokens: string[];
    isActive: boolean;
    totalOrders: number;
    totalRevenue: bigint;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: store.id,
      name: store.name,
      slug: store.slug,
      description: store.description,
      category: store.category,
      logoBase64: store.logoBase64,
      acceptedTokens: store.acceptedTokens,
      isActive: store.isActive,
      totalOrders: store.totalOrders,
      totalRevenue: Number(store.totalRevenue) / 10 ** 6,
      url: `/s/${store.slug}`,
      createdAt: store.createdAt,
      updatedAt: store.updatedAt,
    };
  }
}
