import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import type { PricePoint } from '../services/priceHistory';

interface PriceChartProps {
  data: PricePoint[];
  positive?: boolean;
  height?: number;
  minimal?: boolean;
}

export default function PriceChart({
  data,
  positive = true,
  height = 200,
  minimal = false,
}: PriceChartProps) {
  const color = positive ? '#22c55e' : '#ef4444';

  const chartData = data.map((p) => ({
    time: p.timestamp,
    price: p.price,
  }));

  if (minimal) {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id={`gradient-${positive}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="price"
            stroke={color}
            strokeWidth={2}
            fill={`url(#gradient-${positive})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="time"
          tickFormatter={(ts) => {
            const d = new Date(ts);
            return `${d.getMonth() + 1}/${d.getDate()}`;
          }}
          stroke="#666"
          tick={{ fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          minTickGap={40}
        />
        <YAxis
          domain={['auto', 'auto']}
          stroke="#666"
          tick={{ fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `$${v < 1 ? v.toFixed(6) : v.toFixed(2)}`}
          width={60}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1a1a1a',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12,
            fontSize: 12,
          }}
          labelFormatter={(ts) => new Date(ts as number).toLocaleString()}
          formatter={(value: number | undefined) => {
            const v = value ?? 0;
            return [`$${v < 1 ? v.toFixed(8) : v.toFixed(2)}`, 'Price'];
          }}
        />
        <Area
          type="monotone"
          dataKey="price"
          stroke={color}
          strokeWidth={2}
          fill="url(#colorPrice)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
