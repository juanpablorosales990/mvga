/* eslint-disable @typescript-eslint/no-explicit-any */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PayPalService } from './paypal.service';

describe('PayPalService', () => {
  let service: PayPalService;
  let mockPrisma: any;
  let mockAdapter: any;

  beforeEach(() => {
    mockPrisma = {
      paymentRequest: {
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    mockAdapter = {
      isEnabled: false,
      createOrder: jest.fn(),
      captureOrder: jest.fn(),
      getOrder: jest.fn(),
      verifyWebhookSignature: jest.fn(),
    };

    service = new PayPalService(mockPrisma, mockAdapter);
  });

  describe('isEnabled', () => {
    it('returns false when adapter is disabled', () => {
      expect(service.isEnabled).toBe(false);
    });

    it('returns true when adapter is enabled', () => {
      mockAdapter.isEnabled = true;
      expect(service.isEnabled).toBe(true);
    });
  });

  describe('createOrderForPayment', () => {
    it('throws NotFoundException when payment request does not exist', async () => {
      mockPrisma.paymentRequest.findUnique.mockResolvedValue(null);
      await expect(service.createOrderForPayment('nonexistent', 10)).rejects.toThrow(
        NotFoundException
      );
    });

    it('throws BadRequestException when payment is not PENDING', async () => {
      mockPrisma.paymentRequest.findUnique.mockResolvedValue({
        id: '1',
        status: 'PAID',
      });
      await expect(service.createOrderForPayment('1', 10)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when token is not a stablecoin', async () => {
      mockPrisma.paymentRequest.findUnique.mockResolvedValue({
        id: '1',
        status: 'PENDING',
        token: 'MVGA',
        amount: 1n,
        memo: null,
      });

      await expect(service.createOrderForPayment('1', 10)).rejects.toThrow(BadRequestException);
    });

    it('creates order and updates payment request', async () => {
      mockPrisma.paymentRequest.findUnique.mockResolvedValue({
        id: '1',
        status: 'PENDING',
        token: 'USDC',
        amount: 10_000_000n,
        memo: null,
      });
      mockAdapter.createOrder.mockResolvedValue({
        id: 'PP-ORDER-123',
        status: 'CREATED',
        links: [{ href: 'https://paypal.com/approve', rel: 'approve', method: 'GET' }],
      });
      mockPrisma.paymentRequest.update.mockResolvedValue({});

      const result = await service.createOrderForPayment('1', 10, 'Test payment');

      expect(result.orderId).toBe('PP-ORDER-123');
      expect(result.approveUrl).toBe('https://paypal.com/approve');
      expect(mockAdapter.createOrder).toHaveBeenCalledWith('10.00', 'Test payment', '1');
      expect(mockPrisma.paymentRequest.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { paypalOrderId: 'PP-ORDER-123', paymentMethod: 'paypal' },
      });
    });

    it('handles missing approve link gracefully', async () => {
      mockPrisma.paymentRequest.findUnique.mockResolvedValue({
        id: '1',
        status: 'PENDING',
        token: 'USDC',
        amount: 25_000_000n,
        memo: null,
      });
      mockAdapter.createOrder.mockResolvedValue({
        id: 'PP-ORDER-456',
        status: 'CREATED',
        links: [],
      });
      mockPrisma.paymentRequest.update.mockResolvedValue({});

      const result = await service.createOrderForPayment('1', 25);
      expect(result.approveUrl).toBeNull();
    });
  });

  describe('captureOrderForPayment', () => {
    it('throws NotFoundException when payment request does not exist', async () => {
      mockPrisma.paymentRequest.findUnique.mockResolvedValue(null);
      await expect(service.captureOrderForPayment('nonexistent', 'ORDER-1')).rejects.toThrow(
        NotFoundException
      );
    });

    it('throws BadRequestException when payment is not PENDING', async () => {
      mockPrisma.paymentRequest.findUnique.mockResolvedValue({
        id: '1',
        status: 'PAID',
      });
      await expect(service.captureOrderForPayment('1', 'ORDER-1')).rejects.toThrow(
        BadRequestException
      );
    });

    it('throws BadRequestException when order ID mismatches', async () => {
      mockPrisma.paymentRequest.findUnique.mockResolvedValue({
        id: '1',
        status: 'PENDING',
        paypalOrderId: 'ORDER-ORIGINAL',
      });
      await expect(service.captureOrderForPayment('1', 'ORDER-DIFFERENT')).rejects.toThrow(
        BadRequestException
      );
    });

    it('throws BadRequestException when token is not a stablecoin', async () => {
      mockPrisma.paymentRequest.findUnique.mockResolvedValue({
        id: '1',
        status: 'PENDING',
        paypalOrderId: 'ORDER-1',
        token: 'MVGA',
        amount: 1n,
      });
      await expect(service.captureOrderForPayment('1', 'ORDER-1')).rejects.toThrow(
        BadRequestException
      );
    });

    it('throws BadRequestException when capture is not COMPLETED', async () => {
      mockPrisma.paymentRequest.findUnique.mockResolvedValue({
        id: '1',
        status: 'PENDING',
        paypalOrderId: null,
        token: 'USDC',
        amount: 10_000_000n,
      });
      mockAdapter.captureOrder.mockResolvedValue({
        id: 'ORDER-1',
        status: 'VOIDED',
        purchase_units: [],
      });
      await expect(service.captureOrderForPayment('1', 'ORDER-1')).rejects.toThrow(
        BadRequestException
      );
    });

    it('throws BadRequestException when captured amount is less than requested', async () => {
      mockPrisma.paymentRequest.findUnique.mockResolvedValue({
        id: '1',
        status: 'PENDING',
        paypalOrderId: 'ORDER-1',
        token: 'USDC',
        amount: 10_000_000n,
      });
      mockAdapter.captureOrder.mockResolvedValue({
        id: 'ORDER-1',
        status: 'COMPLETED',
        purchase_units: [
          {
            payments: {
              captures: [
                {
                  id: 'CAP-1',
                  status: 'COMPLETED',
                  amount: { currency_code: 'USD', value: '5.00' },
                },
              ],
            },
          },
        ],
      });

      await expect(service.captureOrderForPayment('1', 'ORDER-1')).rejects.toThrow(
        BadRequestException
      );
    });

    it('captures order and marks payment as PAID', async () => {
      mockPrisma.paymentRequest.findUnique.mockResolvedValue({
        id: '1',
        status: 'PENDING',
        paypalOrderId: 'ORDER-1',
        token: 'USDC',
        amount: 10_000_000n,
      });
      mockAdapter.captureOrder.mockResolvedValue({
        id: 'ORDER-1',
        status: 'COMPLETED',
        purchase_units: [
          {
            payments: {
              captures: [
                {
                  id: 'CAP-1',
                  status: 'COMPLETED',
                  amount: { currency_code: 'USD', value: '10.00' },
                },
              ],
            },
          },
        ],
      });
      mockPrisma.paymentRequest.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.captureOrderForPayment('1', 'ORDER-1');
      expect(result.status).toBe('PAID');
      expect(result.capturedAmount).toBe('10.00');
      expect(mockPrisma.paymentRequest.updateMany).toHaveBeenCalledWith({
        where: { id: '1', status: 'PENDING' },
        data: { status: 'PAID', paypalOrderId: 'ORDER-1', paymentMethod: 'paypal' },
      });
    });

    it('throws when P2002 unique constraint violated', async () => {
      mockPrisma.paymentRequest.findUnique.mockResolvedValue({
        id: '1',
        status: 'PENDING',
        paypalOrderId: null,
        token: 'USDC',
        amount: 10_000_000n,
      });
      mockAdapter.captureOrder.mockResolvedValue({
        id: 'ORDER-1',
        status: 'COMPLETED',
        purchase_units: [
          {
            payments: {
              captures: [
                { id: 'C', status: 'COMPLETED', amount: { currency_code: 'USD', value: '5.00' } },
              ],
            },
          },
        ],
      });
      mockPrisma.paymentRequest.updateMany.mockRejectedValue({ code: 'P2002' });

      await expect(service.captureOrderForPayment('1', 'ORDER-1')).rejects.toThrow(
        BadRequestException
      );
    });

    it('throws when updateMany returns count 0 (race condition)', async () => {
      mockPrisma.paymentRequest.findUnique.mockResolvedValue({
        id: '1',
        status: 'PENDING',
        paypalOrderId: null,
        token: 'USDC',
        amount: 10_000_000n,
      });
      mockAdapter.captureOrder.mockResolvedValue({
        id: 'ORDER-1',
        status: 'COMPLETED',
        purchase_units: [
          {
            payments: {
              captures: [
                { id: 'C', status: 'COMPLETED', amount: { currency_code: 'USD', value: '5.00' } },
              ],
            },
          },
        ],
      });
      mockPrisma.paymentRequest.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.captureOrderForPayment('1', 'ORDER-1')).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('createOrderForDeposit', () => {
    it('creates order with correct amount and description', async () => {
      mockAdapter.createOrder.mockResolvedValue({
        id: 'DEP-ORDER-1',
        status: 'CREATED',
        links: [{ href: 'https://paypal.com/approve', rel: 'approve', method: 'GET' }],
      });

      const result = await service.createOrderForDeposit('wallet123', 25, 'USDC');
      expect(result.orderId).toBe('DEP-ORDER-1');
      expect(result.approveUrl).toBe('https://paypal.com/approve');
      expect(mockAdapter.createOrder).toHaveBeenCalledWith('25.00', 'MVGA Deposit: 25 USD → USDC');
    });
  });

  describe('captureOrderForDeposit', () => {
    it('throws when capture status is not COMPLETED', async () => {
      mockAdapter.captureOrder.mockResolvedValue({
        id: 'ORDER-1',
        status: 'VOIDED',
        purchase_units: [],
      });
      await expect(service.captureOrderForDeposit('wallet123', 'ORDER-1', 'USDC')).rejects.toThrow(
        BadRequestException
      );
    });

    it('returns completed status with captured amount', async () => {
      mockAdapter.captureOrder.mockResolvedValue({
        id: 'ORDER-1',
        status: 'COMPLETED',
        purchase_units: [
          {
            payments: {
              captures: [
                { id: 'C1', status: 'COMPLETED', amount: { currency_code: 'USD', value: '50.00' } },
              ],
            },
          },
        ],
      });

      const result = await service.captureOrderForDeposit('wallet123', 'ORDER-1', 'USDC');
      expect(result.status).toBe('COMPLETED');
      expect(result.capturedAmount).toBe('50.00');
      expect(result.token).toBe('USDC');
    });
  });
});
