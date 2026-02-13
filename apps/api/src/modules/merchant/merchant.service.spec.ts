import { MerchantService } from './merchant.service';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

const mockPrisma = {
  store: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  storeProduct: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  storeOrder: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  storeInvoice: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  paymentRequest: {
    update: jest.fn(),
  },
  $transaction: jest.fn((fn: unknown) =>
    Array.isArray(fn) ? Promise.all(fn) : (fn as (p: unknown) => unknown)(mockPrisma)
  ),
};

const mockPaymentsService = {
  createRequest: jest.fn(),
};

const mockEventEmitter = {
  emit: jest.fn(),
};

describe('MerchantService', () => {
  let service: MerchantService;

  beforeEach(() => {
    service = new MerchantService(
      mockPrisma as never,
      mockPaymentsService as never,
      mockEventEmitter as never
    );
    jest.clearAllMocks();
  });

  describe('createStore', () => {
    it('creates a store with valid data', async () => {
      mockPrisma.store.findUnique
        .mockResolvedValueOnce(null) // slug check
        .mockResolvedValueOnce(null); // ownerId check
      mockPrisma.store.create.mockResolvedValue({
        id: 'store-1',
        ownerId: 'user-1',
        ownerAddress: 'wallet1',
        name: 'Test Store',
        slug: 'test-store',
        description: null,
        category: 'FOOD',
        logoBase64: null,
        acceptedTokens: ['USDC'],
        isActive: true,
        totalOrders: 0,
        totalRevenue: BigInt(0),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createStore('user-1', 'wallet1', {
        name: 'Test Store',
        slug: 'test-store',
        category: 'FOOD',
        acceptedTokens: ['USDC'],
      });

      expect(result.name).toBe('Test Store');
      expect(result.slug).toBe('test-store');
      expect(mockPrisma.store.create).toHaveBeenCalled();
    });

    it('rejects duplicate slug', async () => {
      mockPrisma.store.findUnique.mockResolvedValueOnce({ id: 'existing' });

      await expect(
        service.createStore('user-1', 'wallet1', {
          name: 'Store',
          slug: 'taken',
          category: 'OTHER',
          acceptedTokens: ['USDC'],
        })
      ).rejects.toThrow(ConflictException);
    });

    it('rejects second store for same user', async () => {
      mockPrisma.store.findUnique
        .mockResolvedValueOnce(null) // slug available
        .mockResolvedValueOnce({ id: 'existing' }); // user has store

      await expect(
        service.createStore('user-1', 'wallet1', {
          name: 'Store 2',
          slug: 'new-slug',
          category: 'OTHER',
          acceptedTokens: ['USDC'],
        })
      ).rejects.toThrow(ConflictException);
    });

    it('rejects invalid token', async () => {
      await expect(
        service.createStore('user-1', 'wallet1', {
          name: 'Store',
          slug: 'slug',
          category: 'OTHER',
          acceptedTokens: ['INVALID'],
        })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getMyStore', () => {
    it('returns null when no store exists', async () => {
      mockPrisma.store.findUnique.mockResolvedValue(null);
      const result = await service.getMyStore('user-1');
      expect(result).toBeNull();
    });

    it('returns formatted store', async () => {
      mockPrisma.store.findUnique.mockResolvedValue({
        id: 's1',
        ownerId: 'u1',
        ownerAddress: 'w1',
        name: 'Shop',
        slug: 'shop',
        description: 'A shop',
        category: 'RETAIL',
        logoBase64: null,
        acceptedTokens: ['USDC', 'USDT'],
        isActive: true,
        totalOrders: 5,
        totalRevenue: BigInt(50_000_000),
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-02-01'),
      });

      const result = await service.getMyStore('u1');
      expect(result).not.toBeNull();
      expect(result!.name).toBe('Shop');
      expect(result!.totalRevenue).toBe(50);
      expect(result!.url).toBe('/s/shop');
    });
  });

  describe('createProduct', () => {
    it('creates a product for the store', async () => {
      mockPrisma.store.findUnique.mockResolvedValue({ id: 'store-1', ownerId: 'user-1' });
      mockPrisma.storeProduct.count.mockResolvedValue(0);
      mockPrisma.storeProduct.create.mockResolvedValue({
        id: 'prod-1',
        storeId: 'store-1',
        name: 'Arepa',
        description: null,
        priceUsd: 3.5,
        imageBase64: null,
        isActive: true,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createProduct('user-1', { name: 'Arepa', priceUsd: 3.5 });
      expect(result.name).toBe('Arepa');
      expect(result.priceUsd).toBe(3.5);
    });

    it('rejects when product limit reached', async () => {
      mockPrisma.store.findUnique.mockResolvedValue({ id: 'store-1', ownerId: 'user-1' });
      mockPrisma.storeProduct.count.mockResolvedValue(100);

      await expect(
        service.createProduct('user-1', { name: 'Too Many', priceUsd: 1 })
      ).rejects.toThrow(BadRequestException);
    });

    it('throws if no store exists', async () => {
      mockPrisma.store.findUnique.mockResolvedValue(null);

      await expect(service.createProduct('user-1', { name: 'Arepa', priceUsd: 3 })).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('createQuickCheckout', () => {
    it('creates order with payment request (quick amount)', async () => {
      mockPrisma.store.findUnique.mockResolvedValue({
        id: 'store-1',
        ownerId: 'user-1',
        ownerAddress: 'wallet1',
        acceptedTokens: ['USDC'],
      });
      mockPrisma.storeOrder.findFirst.mockResolvedValue(null);
      mockPaymentsService.createRequest.mockResolvedValue({ id: 'pr-1', url: '/pay/pr-1' });
      mockPrisma.storeOrder.create.mockResolvedValue({ id: 'order-1', orderNumber: 1 });
      mockPrisma.paymentRequest.update.mockResolvedValue({});

      const result = await service.createQuickCheckout('user-1', 'wallet1', {
        amount: 10,
        token: 'USDC',
      });

      expect(result.paymentRequestId).toBe('pr-1');
      expect(result.amount).toBe(10);
      expect(result.orderNumber).toBe(1);
      expect(mockPaymentsService.createRequest).toHaveBeenCalledWith(
        'wallet1',
        'USDC',
        10,
        'Order #1'
      );
    });

    it('rejects token not accepted by store', async () => {
      mockPrisma.store.findUnique.mockResolvedValue({
        id: 'store-1',
        ownerId: 'user-1',
        ownerAddress: 'wallet1',
        acceptedTokens: ['USDC'],
      });

      await expect(
        service.createQuickCheckout('user-1', 'wallet1', { amount: 10, token: 'MVGA' })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('createInvoice', () => {
    it('creates invoice with auto-generated number', async () => {
      mockPrisma.store.findUnique.mockResolvedValue({ id: 'store-1', ownerId: 'user-1' });
      mockPrisma.storeInvoice.findFirst.mockResolvedValue(null);
      mockPrisma.storeInvoice.create.mockResolvedValue({
        id: 'inv-1',
        invoiceNumber: 'INV-001',
        totalAmount: 100,
        token: 'USDC',
        status: 'DRAFT',
      });

      const result = await service.createInvoice('user-1', {
        items: [{ description: 'Service', quantity: 1, unitPrice: 100 }],
        token: 'USDC',
      });

      expect(result.invoiceNumber).toBe('INV-001');
      expect(result.totalAmount).toBe(100);
    });

    it('increments invoice number', async () => {
      mockPrisma.store.findUnique.mockResolvedValue({ id: 'store-1', ownerId: 'user-1' });
      mockPrisma.storeInvoice.findFirst.mockResolvedValue({ invoiceNumber: 'INV-005' });
      mockPrisma.storeInvoice.create.mockResolvedValue({
        id: 'inv-2',
        invoiceNumber: 'INV-006',
        totalAmount: 100,
        token: 'USDC',
        status: 'DRAFT',
      });

      await service.createInvoice('user-1', {
        items: [{ description: 'Work', quantity: 2, unitPrice: 50 }],
        token: 'USDC',
      });

      expect(mockPrisma.storeInvoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ invoiceNumber: 'INV-006' }),
        })
      );
    });
  });

  describe('sendInvoice', () => {
    it('creates payment request and marks as sent', async () => {
      mockPrisma.store.findUnique.mockResolvedValue({
        id: 'store-1',
        ownerId: 'user-1',
        ownerAddress: 'wallet1',
      });
      mockPrisma.storeInvoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        storeId: 'store-1',
        status: 'DRAFT',
        totalAmount: 100,
        token: 'USDC',
        invoiceNumber: 'INV-001',
      });
      mockPaymentsService.createRequest.mockResolvedValue({ id: 'pr-1', url: '/pay/pr-1' });
      mockPrisma.storeInvoice.update.mockResolvedValue({});

      const result = await service.sendInvoice('user-1', 'inv-1');

      expect(result.status).toBe('SENT');
      expect(result.paymentRequestId).toBe('pr-1');
    });

    it('rejects sending non-draft invoice', async () => {
      mockPrisma.store.findUnique.mockResolvedValue({ id: 'store-1', ownerId: 'user-1' });
      mockPrisma.storeInvoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        storeId: 'store-1',
        status: 'SENT',
      });

      await expect(service.sendInvoice('user-1', 'inv-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('onPaymentRequestPaid', () => {
    it('updates store order when linked payment is paid', async () => {
      mockPrisma.storeOrder.findUnique.mockResolvedValue({
        id: 'order-1',
        storeId: 'store-1',
        orderNumber: 1,
        totalAmount: BigInt(10_000_000),
        token: 'USDC',
        store: { id: 'store-1', ownerAddress: 'wallet1', name: 'Test', slug: 'test' },
      });
      mockPrisma.storeOrder.update.mockResolvedValue({});
      mockPrisma.store.update.mockResolvedValue({});
      mockPrisma.storeInvoice.findUnique.mockResolvedValue(null);

      await service.onPaymentRequestPaid({
        requestId: 'pr-1',
        amount: 10,
        token: 'USDC',
      });

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'merchant.order.paid',
        expect.objectContaining({ merchantWallet: 'wallet1', orderNumber: 1 })
      );
    });

    it('ignores non-merchant payment requests', async () => {
      mockPrisma.storeOrder.findUnique.mockResolvedValue(null);

      await service.onPaymentRequestPaid({
        requestId: 'pr-other',
        amount: 5,
        token: 'USDC',
      });

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('getPublicStore', () => {
    it('returns store with active products', async () => {
      mockPrisma.store.findUnique.mockResolvedValue({
        name: 'Shop',
        slug: 'shop',
        description: null,
        category: 'FOOD',
        logoBase64: null,
        acceptedTokens: ['USDC'],
        isActive: true,
        products: [
          {
            id: 'p1',
            name: 'Item',
            description: null,
            priceUsd: 5,
            imageBase64: null,
            isActive: true,
          },
        ],
      });

      const result = await service.getPublicStore('shop');
      expect(result.products).toHaveLength(1);
    });

    it('throws for inactive store', async () => {
      mockPrisma.store.findUnique.mockResolvedValue({ isActive: false, products: [] });
      await expect(service.getPublicStore('inactive')).rejects.toThrow(NotFoundException);
    });

    it('throws for non-existent slug', async () => {
      mockPrisma.store.findUnique.mockResolvedValue(null);
      await expect(service.getPublicStore('nope')).rejects.toThrow(NotFoundException);
    });
  });
});
