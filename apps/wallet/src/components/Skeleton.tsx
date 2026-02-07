import clsx from 'clsx';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
}

export function Skeleton({ className, variant = 'text', width, height }: SkeletonProps) {
  return (
    <div
      className={clsx(
        'animate-pulse bg-white/10',
        variant === 'circular' && 'rounded-full',
        variant === 'text' && 'rounded h-4',
        variant === 'rectangular' && '',
        className
      )}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

export function SkeletonCard({ lines = 2 }: { lines?: number }) {
  return (
    <div className="card animate-pulse" aria-hidden="true">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-white/10 rounded-full" />
        <div className="flex-1 space-y-2">
          {Array.from({ length: lines }).map((_, i) => (
            <div
              key={i}
              className="h-3 bg-white/10 rounded"
              style={{ width: i === 0 ? '60%' : '40%' }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function SkeletonStatCard() {
  return (
    <div className="card animate-pulse" aria-hidden="true">
      <div className="h-3 bg-white/10 rounded w-20 mb-2" />
      <div className="h-6 bg-white/10 rounded w-24 mb-1" />
      <div className="h-3 bg-white/10 rounded w-12" />
    </div>
  );
}
