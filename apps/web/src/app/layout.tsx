import type { Metadata } from 'next';
import { Archivo, JetBrains_Mono } from 'next/font/google';
import { Analytics } from '@vercel/analytics/react';
import './globals.css';

const ENABLE_VERCEL_ANALYTICS = process.env.NEXT_PUBLIC_VERCEL_ANALYTICS === '1';

const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-archivo',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800', '900'],
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['400', '500', '700'],
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
    images: [{ url: '/og-image.png', alt: 'MVGA - Make Venezuela Great Again' }],
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${archivo.variable} ${jetbrains.variable}`}>
      <body className="antialiased bg-black text-white grain">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-white focus:text-black focus:px-4 focus:py-2"
        >
          Skip to main content
        </a>
        {children}
        {ENABLE_VERCEL_ANALYTICS ? <Analytics /> : null}
      </body>
    </html>
  );
}
