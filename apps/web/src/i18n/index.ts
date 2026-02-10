import type en from './en.json';

export type Locale = 'en' | 'es';
export type Dictionary = typeof en;

export const locales: Locale[] = ['en', 'es'];
export const defaultLocale: Locale = 'es';

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  en: () => import('./en.json').then((m) => m.default),
  es: () => import('./es.json').then((m) => m.default),
};

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  return dictionaries[locale]();
}

export function isValidLocale(lang: string): lang is Locale {
  return locales.includes(lang as Locale);
}
