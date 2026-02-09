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

/** Reverse-parse a `solana:` URL back into structured data */
export function parseSolanaPayUrl(
  url: string
): { address: string; amount?: number; token?: string; memo?: string } | null {
  if (!url.startsWith('solana:')) return null;

  const withoutScheme = url.slice('solana:'.length);
  const [addressPart, queryString] = withoutScheme.split('?', 2);
  if (!addressPart) return null;

  const result: { address: string; amount?: number; token?: string; memo?: string } = {
    address: addressPart,
  };

  if (queryString) {
    const params = new URLSearchParams(queryString);
    const amountStr = params.get('amount');
    if (amountStr) {
      const parsed = parseFloat(amountStr);
      if (!isNaN(parsed) && parsed > 0) result.amount = parsed;
    }
    const splToken = params.get('spl-token');
    if (splToken) {
      const entry = Object.entries(SUPPORTED_TOKENS).find(([, v]) => v.mint === splToken);
      result.token = entry ? entry[0] : undefined;
    }
    const memo = params.get('memo');
    if (memo) result.memo = memo;
  }

  return result;
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
