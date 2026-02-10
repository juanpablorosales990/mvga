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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html className={`${archivo.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <body className="antialiased bg-black text-white grain">
        {children}
        {ENABLE_VERCEL_ANALYTICS ? <Analytics /> : null}
      </body>
    </html>
  );
}
