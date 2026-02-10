import { getDictionary, isValidLocale } from '@/i18n';
import HomeClient from './home-client';

export default async function Home({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const locale = isValidLocale(lang) ? lang : 'en';
  const dict = await getDictionary(locale);
  return <HomeClient dict={dict} lang={locale} />;
}
