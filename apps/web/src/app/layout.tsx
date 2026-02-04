import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MVGA - Make Venezuela Great Again',
  description:
    "Venezuela's open-source financial infrastructure. Send money, hold stable value, support small businesses. By Venezuelans, for Venezuelans.",
  keywords: ['Venezuela', 'crypto', 'remittances', 'wallet', 'USDC', 'Solana', 'humanitarian'],
  openGraph: {
    title: 'MVGA - Make Venezuela Great Again',
    description: "Venezuela's open-source financial infrastructure",
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
