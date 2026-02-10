import type { Metadata } from 'next';
import { getDictionary, locales, isValidLocale, type Locale } from '@/i18n';

export async function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const locale = isValidLocale(lang) ? lang : 'en';
  const dict = await getDictionary(locale);

  return {
    metadataBase: new URL('https://mvga.io'),
    title: dict.metadata.title,
    description: dict.metadata.description,
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
      ...(locale === 'es'
        ? [
            'enviar dinero Venezuela',
            'dólares digitales',
            'neobanco',
            'tarjeta de débito',
            'remesas gratis',
            'billetera digital',
          ]
        : []),
    ],
    openGraph: {
      title: dict.metadata.ogTitle,
      description: dict.metadata.ogDescription,
      type: 'website',
      url: `https://mvga.io/${locale}`,
      images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'MVGA' }],
      locale: locale === 'es' ? 'es_VE' : 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      site: '@mvga',
      images: [{ url: '/og-image.png', alt: dict.metadata.title }],
    },
    icons: {
      icon: '/favicon.ico',
      apple: '/apple-touch-icon.png',
    },
    alternates: {
      canonical: `https://mvga.io/${locale}`,
      languages: {
        en: 'https://mvga.io/en',
        es: 'https://mvga.io/es',
      },
    },
  };
}

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale: Locale = isValidLocale(lang) ? lang : 'en';
  const dict = await getDictionary(locale);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'MVGA',
            url: 'https://mvga.io',
            logo: 'https://mvga.io/og-image.png',
            description: dict.metadata.schemaDescription,
            sameAs: ['https://twitter.com/mvga', 'https://github.com/juanpablorosales990/mvga'],
            foundingDate: '2026',
            areaServed: 'Venezuela',
          }),
        }}
      />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-white focus:text-black focus:px-4 focus:py-2"
      >
        {dict.skipToContent}
      </a>
      {children}
    </>
  );
}
