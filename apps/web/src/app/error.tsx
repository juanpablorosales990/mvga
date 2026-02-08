'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
      <div className="text-center px-6">
        <h1 className="text-6xl font-display font-bold text-red-500 mb-4">Error</h1>
        <p className="text-xl text-gray-400 mb-2">Something went wrong</p>
        <p className="text-sm text-gray-600 mb-8">
          An unexpected error occurred. Please try again.
        </p>
        <button
          onClick={reset}
          className="inline-block bg-gradient-to-r from-gold-500 to-gold-600 text-white font-semibold px-8 py-3 rounded-full hover:opacity-90 transition"
        >
          Try Again
        </button>
      </div>
    </main>
  );
}
