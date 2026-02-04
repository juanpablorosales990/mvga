interface TokenCardProps {
  token: {
    symbol: string;
    name: string;
    balance: number;
    usdValue: number;
    logoUrl?: string;
  };
}

export default function TokenCard({ token }: TokenCardProps) {
  return (
    <div className="card flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden">
          {token.logoUrl ? (
            <img src={token.logoUrl} alt={token.symbol} className="w-full h-full object-cover" />
          ) : (
            <span className="text-sm font-bold">{token.symbol.slice(0, 2)}</span>
          )}
        </div>
        <div>
          <p className="font-semibold">{token.symbol}</p>
          <p className="text-sm text-gray-500">{token.name}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-semibold">
          {token.balance.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 6,
          })}
        </p>
        <p className="text-sm text-gray-500">
          ${token.usdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </div>
    </div>
  );
}
