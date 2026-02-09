import { describe, it, expect } from 'vitest';
import {
  buildSolanaPayUrl,
  parseSolanaPayUrl,
  formatTokenAmount,
  humanToSmallestUnit,
  smallestUnitToHuman,
  SUPPORTED_TOKENS,
} from '../utils/solana-pay';

describe('solana-pay utils', () => {
  const TEST_ADDR = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';

  describe('buildSolanaPayUrl', () => {
    it('builds a basic URL with just an address', () => {
      expect(buildSolanaPayUrl(TEST_ADDR)).toBe(`solana:${TEST_ADDR}`);
    });

    it('builds URL with amount', () => {
      const url = buildSolanaPayUrl(TEST_ADDR, { amount: '1.5' });
      expect(url).toBe(`solana:${TEST_ADDR}?amount=1.5`);
    });

    it('builds URL with SPL token', () => {
      const url = buildSolanaPayUrl(TEST_ADDR, { token: 'USDC' });
      expect(url).toContain(`spl-token=${SUPPORTED_TOKENS.USDC.mint}`);
    });

    it('does not add spl-token for SOL', () => {
      const url = buildSolanaPayUrl(TEST_ADDR, { token: 'SOL' });
      expect(url).toBe(`solana:${TEST_ADDR}`);
    });

    it('builds URL with memo', () => {
      const url = buildSolanaPayUrl(TEST_ADDR, { memo: 'rent' });
      expect(url).toContain('memo=rent');
    });

    it('builds URL with label', () => {
      const url = buildSolanaPayUrl(TEST_ADDR, { label: 'Coffee Shop' });
      expect(url).toContain('label=Coffee+Shop');
    });

    it('builds URL with all params', () => {
      const url = buildSolanaPayUrl(TEST_ADDR, {
        amount: '10',
        token: 'USDT',
        memo: 'invoice-42',
        label: 'Store',
      });
      expect(url).toContain(`solana:${TEST_ADDR}?`);
      expect(url).toContain('amount=10');
      expect(url).toContain(`spl-token=${SUPPORTED_TOKENS.USDT.mint}`);
      expect(url).toContain('memo=invoice-42');
      expect(url).toContain('label=Store');
    });

    it('ignores zero amount', () => {
      const url = buildSolanaPayUrl(TEST_ADDR, { amount: '0' });
      expect(url).toBe(`solana:${TEST_ADDR}`);
    });

    it('ignores negative amount', () => {
      const url = buildSolanaPayUrl(TEST_ADDR, { amount: '-5' });
      expect(url).toBe(`solana:${TEST_ADDR}`);
    });

    it('ignores unknown token', () => {
      const url = buildSolanaPayUrl(TEST_ADDR, { token: 'UNKNOWN' });
      expect(url).toBe(`solana:${TEST_ADDR}`);
    });
  });

  describe('parseSolanaPayUrl', () => {
    it('parses a basic solana: URL', () => {
      const result = parseSolanaPayUrl(`solana:${TEST_ADDR}`);
      expect(result).toEqual({ address: TEST_ADDR });
    });

    it('parses URL with amount', () => {
      const result = parseSolanaPayUrl(`solana:${TEST_ADDR}?amount=1.5`);
      expect(result).toEqual({ address: TEST_ADDR, amount: 1.5 });
    });

    it('parses URL with USDC spl-token', () => {
      const result = parseSolanaPayUrl(
        `solana:${TEST_ADDR}?spl-token=${SUPPORTED_TOKENS.USDC.mint}`
      );
      expect(result).toEqual({ address: TEST_ADDR, token: 'USDC' });
    });

    it('parses URL with USDT spl-token', () => {
      const result = parseSolanaPayUrl(
        `solana:${TEST_ADDR}?spl-token=${SUPPORTED_TOKENS.USDT.mint}`
      );
      expect(result).toEqual({ address: TEST_ADDR, token: 'USDT' });
    });

    it('parses URL with MVGA spl-token', () => {
      const result = parseSolanaPayUrl(
        `solana:${TEST_ADDR}?spl-token=${SUPPORTED_TOKENS.MVGA.mint}`
      );
      expect(result).toEqual({ address: TEST_ADDR, token: 'MVGA' });
    });

    it('parses URL with memo', () => {
      const result = parseSolanaPayUrl(`solana:${TEST_ADDR}?memo=rent-jan`);
      expect(result).toEqual({ address: TEST_ADDR, memo: 'rent-jan' });
    });

    it('parses URL with all params', () => {
      const result = parseSolanaPayUrl(
        `solana:${TEST_ADDR}?amount=10&spl-token=${SUPPORTED_TOKENS.USDC.mint}&memo=test`
      );
      expect(result).toEqual({
        address: TEST_ADDR,
        amount: 10,
        token: 'USDC',
        memo: 'test',
      });
    });

    it('returns null for non-solana URL', () => {
      expect(parseSolanaPayUrl('https://example.com')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(parseSolanaPayUrl('')).toBeNull();
    });

    it('returns null for solana: with no address', () => {
      expect(parseSolanaPayUrl('solana:')).toBeNull();
    });

    it('ignores invalid amount', () => {
      const result = parseSolanaPayUrl(`solana:${TEST_ADDR}?amount=abc`);
      expect(result).toEqual({ address: TEST_ADDR });
    });

    it('ignores zero amount', () => {
      const result = parseSolanaPayUrl(`solana:${TEST_ADDR}?amount=0`);
      expect(result).toEqual({ address: TEST_ADDR });
    });

    it('ignores negative amount', () => {
      const result = parseSolanaPayUrl(`solana:${TEST_ADDR}?amount=-5`);
      expect(result).toEqual({ address: TEST_ADDR });
    });

    it('handles unknown spl-token mint gracefully', () => {
      const result = parseSolanaPayUrl(`solana:${TEST_ADDR}?spl-token=UnknownMintAddress`);
      expect(result).toEqual({ address: TEST_ADDR });
      expect(result?.token).toBeUndefined();
    });
  });

  describe('round-trip: buildSolanaPayUrl -> parseSolanaPayUrl', () => {
    it('round-trips basic address', () => {
      const url = buildSolanaPayUrl(TEST_ADDR);
      const parsed = parseSolanaPayUrl(url);
      expect(parsed?.address).toBe(TEST_ADDR);
    });

    it('round-trips address with amount', () => {
      const url = buildSolanaPayUrl(TEST_ADDR, { amount: '5.25' });
      const parsed = parseSolanaPayUrl(url);
      expect(parsed?.address).toBe(TEST_ADDR);
      expect(parsed?.amount).toBe(5.25);
    });

    it('round-trips address with USDC token and amount', () => {
      const url = buildSolanaPayUrl(TEST_ADDR, { amount: '100', token: 'USDC' });
      const parsed = parseSolanaPayUrl(url);
      expect(parsed?.address).toBe(TEST_ADDR);
      expect(parsed?.amount).toBe(100);
      expect(parsed?.token).toBe('USDC');
    });

    it('round-trips address with memo', () => {
      const url = buildSolanaPayUrl(TEST_ADDR, { amount: '50', memo: 'payment' });
      const parsed = parseSolanaPayUrl(url);
      expect(parsed?.address).toBe(TEST_ADDR);
      expect(parsed?.amount).toBe(50);
      expect(parsed?.memo).toBe('payment');
    });
  });

  describe('formatTokenAmount', () => {
    it('formats USDC with 2 decimals', () => {
      expect(formatTokenAmount(10.123456, 'USDC')).toBe('10.12');
    });

    it('formats SOL with 4 decimals (fallback for > 6 decimals)', () => {
      // SOL is not in SUPPORTED_TOKENS, falls back to 6 decimals
      expect(formatTokenAmount(1.5, 'SOL')).toBe('1.50');
    });

    it('formats MVGA with 4 decimals (9 decimal token)', () => {
      expect(formatTokenAmount(100.123456789, 'MVGA')).toBe('100.1235');
    });

    it('formats USDT with 2 decimals', () => {
      expect(formatTokenAmount(25.999, 'USDT')).toBe('26.00');
    });
  });

  describe('humanToSmallestUnit', () => {
    it('converts 1 USDC to 1_000_000', () => {
      expect(humanToSmallestUnit(1, 'USDC')).toBe(1_000_000n);
    });

    it('converts 1.5 USDC to 1_500_000', () => {
      expect(humanToSmallestUnit(1.5, 'USDC')).toBe(1_500_000n);
    });

    it('converts 1 MVGA to 1_000_000_000', () => {
      expect(humanToSmallestUnit(1, 'MVGA')).toBe(1_000_000_000n);
    });

    it('uses 6 decimals for unknown tokens', () => {
      expect(humanToSmallestUnit(1, 'UNKNOWN')).toBe(1_000_000n);
    });
  });

  describe('smallestUnitToHuman', () => {
    it('converts 1_000_000 USDC units to 1', () => {
      expect(smallestUnitToHuman(1_000_000n, 'USDC')).toBe(1);
    });

    it('converts 1_500_000 USDC units to 1.5', () => {
      expect(smallestUnitToHuman(1_500_000n, 'USDC')).toBe(1.5);
    });

    it('converts 1_000_000_000 MVGA units to 1', () => {
      expect(smallestUnitToHuman(1_000_000_000n, 'MVGA')).toBe(1);
    });
  });

  describe('SUPPORTED_TOKENS', () => {
    it('has USDC with correct mint and 6 decimals', () => {
      expect(SUPPORTED_TOKENS.USDC.mint).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
      expect(SUPPORTED_TOKENS.USDC.decimals).toBe(6);
    });

    it('has USDT with correct mint and 6 decimals', () => {
      expect(SUPPORTED_TOKENS.USDT.mint).toBe('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB');
      expect(SUPPORTED_TOKENS.USDT.decimals).toBe(6);
    });

    it('has MVGA with correct mint and 9 decimals', () => {
      expect(SUPPORTED_TOKENS.MVGA.mint).toBe('DRX65kM2n5CLTpdjJCemZvkUwE98ou4RpHrd8Z3GH5Qh');
      expect(SUPPORTED_TOKENS.MVGA.decimals).toBe(9);
    });
  });
});
