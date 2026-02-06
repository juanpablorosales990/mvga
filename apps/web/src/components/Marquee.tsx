'use client';

interface MarqueeProps {
  items: { label: string; value: string }[];
}

export default function Marquee({ items }: MarqueeProps) {
  const track = [...items, ...items];

  return (
    <div className="w-full overflow-hidden border-y border-white/5 py-4 select-none">
      <div className="marquee-track">
        {track.map((item, i) => (
          <div key={i} className="flex items-center gap-3 px-8 whitespace-nowrap">
            <span className="text-xs font-mono text-white/30 uppercase tracking-wider">
              {item.label}
            </span>
            <span className="text-sm font-mono text-white font-bold">{item.value}</span>
            <span className="text-white/10 mx-4">/</span>
          </div>
        ))}
      </div>
    </div>
  );
}
