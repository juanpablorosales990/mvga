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
  title: 'MVGA - Digital Dollars for Venezuela',
  description:
    'Send money to Venezuela for free. Hold US dollars, get a Visa debit card, top up phones, earn interest, and cash out to local banks. Made by Venezuelans, for Venezuelans.',
  keywords: [
    'Venezuela',
    'remittances',
    'send money Venezuela',
    'digital dollars',
    'neobank',
    'Visa debit card',
    'phone top-up Venezuela',
    'P2P exchange',
    'USDC',
    'Venezuelan diaspora',
    'fintech Venezuela',
    'mobile wallet',
  ],
  openGraph: {
    title: 'MVGA - Digital Dollars for Venezuela',
    description:
      'Send money for free, get a Visa card, top up phones, and earn interest. One app for the Venezuelan diaspora.',
    type: 'website',
    url: 'https://mvga.io',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'MVGA' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@mvga',
    images: [{ url: '/og-image.png', alt: 'MVGA - Digital Dollars for Venezuela' }],
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${jetbrains.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'MVGA',
              url: 'https://mvga.io',
              logo: 'https://mvga.io/og-image.png',
              description:
                'Digital dollars for Venezuela. Send money for free, get a Visa debit card, top up phones, earn interest, and cash out to local banks.',
              sameAs: ['https://twitter.com/mvga', 'https://github.com/juanpablorosales990/mvga'],
              foundingDate: '2026',
              areaServed: 'Venezuela',
            }),
          }}
        />
      </head>
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
