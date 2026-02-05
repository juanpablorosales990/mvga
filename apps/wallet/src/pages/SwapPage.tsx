import { useState, useEffect, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { VersionedTransaction } from '@solana/web3.js';
import { useTranslation } from 'react-i18next';

const TOKENS = [
  {
    symbol: 'SOL',
    name: 'Solana',
    mint: 'So11111111111111111111111111111111111111112',
    decimals: 9,
    logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    decimals: 6,
    logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
  },
  {
    symbol: 'USDT',
    name: 'Tether USD',
    mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    decimals: 6,
    logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg',
  },
  {
    symbol: 'MVGA',
    name: 'Make Venezuela Great Again',
    mint: 'DRX65kM2n5CLTpdjJCemZvkUwE98ou4RpHrd8Z3GH5Qh',
    decimals: 9,
    logo: 'https://gateway.irys.xyz/J47ckDJCqKGrt5QHo4ZjDSa4LcaitMFXkcEJ3qyM2qnD',
  },
];

interface QuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      label: string;
    };
    percent: number;
  }>;
}

export default function SwapPage() {
  const { t } = useTranslation();
  const { connected, publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();

  const [fromToken, setFromToken] = useState(TOKENS[0]);
  const [toToken, setToToken] = useState(TOKENS[1]);
  const [fromAmount, setFromAmount] = useState('');
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [slippageBps, setSlippageBps] = useState(50);
  const [showSlippage, setShowSlippage] = useState(false);
  const [customSlippage, setCustomSlippage] = useState('');

  // Fetch quote when amount changes
  const fetchQuote = useCallback(async () => {
    if (!fromAmount || parseFloat(fromAmount) <= 0 || fromToken.mint === toToken.mint) {
      setQuote(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const amount = Math.floor(parseFloat(fromAmount) * Math.pow(10, fromToken.decimals));

      const response = await fetch(
        `https://quote-api.jup.ag/v6/quote?inputMint=${fromToken.mint}&outputMint=${toToken.mint}&amount=${amount}&slippageBps=${slippageBps}`
      );

      if (!response.ok) {
        throw new Error('Failed to get quote');
      }

      const data = await response.json();
      setQuote(data);
    } catch (err) {
      setError('Failed to get quote. Try again.');
      setQuote(null);
    } finally {
      setLoading(false);
    }
  }, [fromAmount, fromToken, toToken, slippageBps]);

  // Debounce quote fetching
  useEffect(() => {
    const timer = setTimeout(fetchQuote, 500);
    return () => clearTimeout(timer);
  }, [fetchQuote]);

  const handleSwapTokens = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
    setFromAmount('');
    setQuote(null);
  };

  const handleSwap = async () => {
    if (!connected || !publicKey || !signTransaction || !quote) return;

    setSwapping(true);
    setError(null);
    setTxSignature(null);

    try {
      // Get swap transaction
      const swapResponse = await fetch('https://quote-api.jup.ag/v6/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteResponse: quote,
          userPublicKey: publicKey.toString(),
          wrapAndUnwrapSol: true,
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports: 'auto',
        }),
      });

      if (!swapResponse.ok) {
        throw new Error('Failed to create swap transaction');
      }

      const { swapTransaction } = await swapResponse.json();

      // Deserialize and sign
      const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
      const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
      const signedTransaction = await signTransaction(transaction);

      // Send transaction
      const rawTransaction = signedTransaction.serialize();
      const signature = await connection.sendRawTransaction(rawTransaction, {
        skipPreflight: true,
        maxRetries: 2,
      });

      // Confirm
      await connection.confirmTransaction(signature, 'confirmed');
      setTxSignature(signature);
      setFromAmount('');
      setQuote(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Swap failed');
    } finally {
      setSwapping(false);
    }
  };

  const formatOutput = () => {
    if (!quote) return '0.00';
    return (parseInt(quote.outAmount) / Math.pow(10, toToken.decimals)).toFixed(6);
  };

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <p className="text-gray-400">{t('swap.connectPrompt')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('swap.title')}</h1>

      <div className="card space-y-4">
        {/* Slippage Settings */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">
            {t('swap.slippage')}: {(slippageBps / 100).toFixed(1)}%
          </span>
          <button
            onClick={() => setShowSlippage(!showSlippage)}
            className="text-xs text-primary-500 hover:text-primary-400"
          >
            {showSlippage ? t('common.cancel') : t('swap.settings')}
          </button>
        </div>

        {showSlippage && (
          <div className="bg-white/5 rounded-xl p-3 space-y-3">
            <div className="flex gap-2">
              {[10, 50, 100, 300].map((bps) => (
                <button
                  key={bps}
                  onClick={() => {
                    setSlippageBps(bps);
                    setCustomSlippage('');
                    setShowSlippage(false);
                  }}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium transition ${
                    slippageBps === bps && !customSlippage
                      ? 'bg-primary-500 text-black'
                      : 'bg-white/10 text-gray-300 hover:bg-white/20'
                  }`}
                >
                  {(bps / 100).toFixed(1)}%
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={customSlippage}
                onChange={(e) => {
                  setCustomSlippage(e.target.value);
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val) && val > 0 && val <= 50) {
                    setSlippageBps(Math.round(val * 100));
                  }
                }}
                placeholder={t('swap.customSlippage')}
                step="0.1"
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
              />
              <span className="text-sm text-gray-400">%</span>
            </div>
            {slippageBps > 300 && (
              <p className="text-xs text-yellow-400">{t('swap.highSlippageWarning')}</p>
            )}
          </div>
        )}

        {/* From Token */}
        <div className="bg-white/5 rounded-xl p-4">
          <div className="flex justify-between mb-2">
            <label className="text-sm text-gray-400">{t('swap.from')}</label>
          </div>
          <div className="flex gap-3">
            <input
              type="number"
              value={fromAmount}
              onChange={(e) => setFromAmount(e.target.value)}
              placeholder="0.00"
              className="flex-1 bg-transparent text-2xl font-semibold focus:outline-none"
            />
            <select
              value={fromToken.symbol}
              onChange={(e) => {
                const token = TOKENS.find((t) => t.symbol === e.target.value);
                if (token) setFromToken(token);
              }}
              className="bg-white/10 rounded-lg px-3 py-2 font-medium focus:outline-none"
            >
              {TOKENS.map((t) => (
                <option key={t.symbol} value={t.symbol} className="bg-gray-900">
                  {t.symbol}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Swap Direction Button */}
        <div className="flex justify-center -my-2 relative z-10">
          <button
            onClick={handleSwapTokens}
            className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center text-black hover:bg-primary-600 transition"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
              />
            </svg>
          </button>
        </div>

        {/* To Token */}
        <div className="bg-white/5 rounded-xl p-4">
          <div className="flex justify-between mb-2">
            <label className="text-sm text-gray-400">{t('swap.to')}</label>
          </div>
          <div className="flex gap-3">
            <div className="flex-1 text-2xl font-semibold">
              {loading ? (
                <span className="text-gray-500 animate-pulse">Loading...</span>
              ) : (
                formatOutput()
              )}
            </div>
            <select
              value={toToken.symbol}
              onChange={(e) => {
                const token = TOKENS.find((t) => t.symbol === e.target.value);
                if (token) setToToken(token);
              }}
              className="bg-white/10 rounded-lg px-3 py-2 font-medium focus:outline-none"
            >
              {TOKENS.map((t) => (
                <option key={t.symbol} value={t.symbol} className="bg-gray-900">
                  {t.symbol}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quote Details */}
        {quote && (
          <div className="bg-white/5 rounded-xl p-3 space-y-2 text-sm">
            <div className="flex justify-between text-gray-400">
              <span>{t('swap.priceImpact')}</span>
              <span
                className={parseFloat(quote.priceImpactPct) > 1 ? 'text-red-400' : 'text-green-400'}
              >
                {parseFloat(quote.priceImpactPct).toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>{t('swap.slippage')}</span>
              <span>{(slippageBps / 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>{t('swap.route')}</span>
              <span>{quote.routePlan.map((r) => r.swapInfo.label).join(' → ')}</span>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Success */}
        {txSignature && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-green-400 text-sm">
            <p>{t('swap.success')}</p>
            <a
              href={`https://solscan.io/tx/${txSignature}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              View on Solscan
            </a>
          </div>
        )}

        {/* Swap Button */}
        <button
          onClick={handleSwap}
          disabled={!quote || swapping || fromToken.mint === toToken.mint}
          className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {swapping
            ? t('swap.swapping')
            : fromToken.mint === toToken.mint
              ? t('swap.selectDifferent')
              : quote
                ? t('swap.swapButton')
                : t('swap.enterAmount')}
        </button>

        <p className="text-xs text-gray-500 text-center">{t('swap.poweredBy')}</p>
      </div>
    </div>
  );
}
