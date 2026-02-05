import { usePrices } from '../hooks/usePrices';
import { useWalletStore } from '../stores/walletStore';

interface FiatValueProps {
  amount: number;
  token: string;
  className?: string;
}

export default function FiatValue({
  amount,
  token,
  className = 'text-sm text-gray-500',
}: FiatValueProps) {
  const { formatFiat } = usePrices();
  const preferredCurrency = useWalletStore((s) => s.preferredCurrency);

  if (amount === 0) return null;

  return <span className={className}>{formatFiat(amount, token, preferredCurrency)}</span>;
}
