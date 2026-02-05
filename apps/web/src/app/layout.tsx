import type { Metadata } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import { Analytics } from '@vercel/analytics/react';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://mvga.io'),
  title: 'MVGA - Make Venezuela Great Again',
  description:
    "Venezuela's open-source financial infrastructure. Send money, hold stable value, support small businesses. By Venezuelans, for Venezuelans.",
  keywords: ['Venezuela', 'crypto', 'remittances', 'wallet', 'USDC', 'Solana', 'humanitarian'],
  openGraph: {
    title: 'MVGA - Make Venezuela Great Again',
    description: "Venezuela's open-source financial infrastructure",
    type: 'website',
    url: 'https://mvga.io',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'MVGA' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@mvga',
    images: ['/og-image.png'],
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${plusJakarta.variable}`}>
      <body className="antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-white focus:text-black focus:px-4 focus:py-2 focus:rounded"
        >
          Skip to main content
        </a>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
