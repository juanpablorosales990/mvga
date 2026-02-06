import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function toApiBase(input: string) {
  const trimmed = input.replace(/\/$/, '');
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
}

export const API_BASE = toApiBase(process.env.NEXT_PUBLIC_API_URL || 'https://api.mvga.io');

export function formatNumber(num: number) {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(0)}K`;
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(num);
}

export function formatMvga(num: number) {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(num);
}
