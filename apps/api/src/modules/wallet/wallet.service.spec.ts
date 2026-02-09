/* eslint-disable @typescript-eslint/no-explicit-any */
import { WalletService } from './wallet.service';

describe('WalletService', () => {
  let service: WalletService;
  let mockSolana: any;
  let mockSwap: any;

  beforeEach(() => {
    mockSolana = {
      getSolBalance: jest.fn(),
      getTokenAccounts: jest.fn(),
      getTransactionHistory: jest.fn(),
    };

    mockSwap = {
      getMultipleTokenPrices: jest.fn(),
      getMvgaPrice: jest.fn(),
    };

    service = new WalletService(mockSolana, mockSwap);
  });

  describe('getBalances', () => {
    it('returns SOL balance with USD value', async () => {
      mockSolana.getSolBalance.mockResolvedValue(10);
      mockSolana.getTokenAccounts.mockResolvedValue([]);
      mockSwap.getMultipleTokenPrices.mockResolvedValue({
        So11111111111111111111111111111111111111112: 150,
      });
      mockSwap.getMvgaPrice.mockResolvedValue(0.001);

      const balances = await service.getBalances('wallet1');
      expect(balances).toHaveLength(1);
      expect(balances[0].symbol).toBe('SOL');
      expect(balances[0].balance).toBe(10);
      expect(balances[0].usdValue).toBe(1500);
    });

    it('includes SPL token balances for known tokens', async () => {
      mockSolana.getSolBalance.mockResolvedValue(1);
      mockSolana.getTokenAccounts.mockResolvedValue([
        { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', amount: 500 },
        { mint: 'DRX65kM2n5CLTpdjJCemZvkUwE98ou4RpHrd8Z3GH5Qh', amount: 10000 },
      ]);
      mockSwap.getMultipleTokenPrices.mockResolvedValue({
        So11111111111111111111111111111111111111112: 150,
        EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: 1,
        DRX65kM2n5CLTpdjJCemZvkUwE98ou4RpHrd8Z3GH5Qh: 0.001,
      });
      mockSwap.getMvgaPrice.mockResolvedValue(0.001);

      const balances = await service.getBalances('wallet1');
      expect(balances).toHaveLength(3); // SOL + USDC + MVGA
      expect(balances[1].symbol).toBe('USDC');
      expect(balances[1].usdValue).toBe(500);
      expect(balances[2].symbol).toBe('MVGA');
    });

    it('skips unknown token mints', async () => {
      mockSolana.getSolBalance.mockResolvedValue(1);
      mockSolana.getTokenAccounts.mockResolvedValue([
        { mint: 'UnknownMintAddress123', amount: 100 },
      ]);
      mockSwap.getMultipleTokenPrices.mockResolvedValue({});
      mockSwap.getMvgaPrice.mockResolvedValue(0);

      const balances = await service.getBalances('wallet1');
      expect(balances).toHaveLength(1); // Only SOL
    });
  });

  describe('getTransactions', () => {
    it('delegates to solana service', async () => {
      mockSolana.getTransactionHistory.mockResolvedValue([{ sig: 'tx1' }]);
      const result = await service.getTransactions('wallet1');
      expect(result).toEqual([{ sig: 'tx1' }]);
      expect(mockSolana.getTransactionHistory).toHaveBeenCalledWith('wallet1');
    });
  });

  describe('getPrices', () => {
    it('returns prices from swap service', async () => {
      mockSwap.getMultipleTokenPrices.mockResolvedValue({
        So11111111111111111111111111111111111111112: 150,
        EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: 1,
        Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: 1,
        DRX65kM2n5CLTpdjJCemZvkUwE98ou4RpHrd8Z3GH5Qh: 0.001,
      });
      mockSwap.getMvgaPrice.mockResolvedValue(0.001);

      const prices = await service.getPrices();
      expect(prices).toHaveLength(4);
      expect(prices.find((p: any) => p.symbol === 'SOL')?.price).toBe(150);
      expect(prices.find((p: any) => p.symbol === 'USDC')?.price).toBe(1);
    });

    it('returns cached prices on second call within TTL', async () => {
      mockSwap.getMultipleTokenPrices.mockResolvedValue({
        So11111111111111111111111111111111111111112: 150,
        EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: 1,
        Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: 1,
        DRX65kM2n5CLTpdjJCemZvkUwE98ou4RpHrd8Z3GH5Qh: 0.001,
      });
      mockSwap.getMvgaPrice.mockResolvedValue(0.001);

      await service.getPrices();
      await service.getPrices();
      // Only called once due to cache
      expect(mockSwap.getMultipleTokenPrices).toHaveBeenCalledTimes(1);
    });

    it('falls back to stablecoin price of 1 when Jupiter returns 0', async () => {
      mockSwap.getMultipleTokenPrices.mockResolvedValue({
        So11111111111111111111111111111111111111112: 150,
        EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: 0,
        Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: 0,
        DRX65kM2n5CLTpdjJCemZvkUwE98ou4RpHrd8Z3GH5Qh: 0,
      });
      mockSwap.getMvgaPrice.mockResolvedValue(0.002);

      const prices = await service.getPrices();
      expect(prices.find((p: any) => p.symbol === 'USDC')?.price).toBe(1);
      expect(prices.find((p: any) => p.symbol === 'USDT')?.price).toBe(1);
      expect(prices.find((p: any) => p.symbol === 'MVGA')?.price).toBe(0.002);
    });

    it('returns hardcoded fallback when swap service throws', async () => {
      mockSwap.getMultipleTokenPrices.mockRejectedValue(new Error('Jupiter down'));

      const prices = await service.getPrices();
      expect(prices).toHaveLength(4);
      expect(prices.find((p: any) => p.symbol === 'SOL')?.price).toBe(150);
      expect(prices.find((p: any) => p.symbol === 'MVGA')?.price).toBe(0.001);
    });
  });
});
