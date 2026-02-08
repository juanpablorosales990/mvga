/**
 * Solana Pay URL builder — no @solana/pay dependency needed.
 * Spec: https://docs.solanapay.com/spec#transfer-request
 */

export const SUPPORTED_TOKENS: Record<string, { mint: string; decimals: number }> = {
  USDC: { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6 },
  USDT: { mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6 },
  MVGA: { mint: 'DRX65kM2n5CLTpdjJCemZvkUwE98ou4RpHrd8Z3GH5Qh', decimals: 9 },
};

export function buildSolanaPayUrl(
  address: string,
  opts?: { token?: string; amount?: string; memo?: string; label?: string }
): string {
  const base = `solana:${address}`;
  const params = new URLSearchParams();

  if (opts?.amount && parseFloat(opts.amount) > 0) {
    params.set('amount', opts.amount);
  }
  if (opts?.token && opts.token !== 'SOL') {
    const mint = SUPPORTED_TOKENS[opts.token]?.mint;
    if (mint) params.set('spl-token', mint);
  }
  if (opts?.memo) {
    params.set('memo', opts.memo);
  }
  if (opts?.label) {
    params.set('label', opts.label);
  }

  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export function formatTokenAmount(amount: number, token: string): string {
  const decimals = SUPPORTED_TOKENS[token]?.decimals ?? 6;
  return amount.toFixed(decimals <= 6 ? 2 : 4);
}

export function humanToSmallestUnit(amount: number, token: string): bigint {
  const decimals = SUPPORTED_TOKENS[token]?.decimals ?? 6;
  return BigInt(Math.round(amount * 10 ** decimals));
}

export function smallestUnitToHuman(amount: bigint, token: string): number {
  const decimals = SUPPORTED_TOKENS[token]?.decimals ?? 6;
  return Number(amount) / 10 ** decimals;
}
