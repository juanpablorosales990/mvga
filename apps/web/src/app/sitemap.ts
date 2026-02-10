import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://mvga.io';
  const locales = ['en', 'es'];
  const now = new Date();

  const pages = [
    { path: '', changeFrequency: 'weekly' as const, priority: 1 },
    { path: '/grants', changeFrequency: 'daily' as const, priority: 0.8 },
    { path: '/transparency', changeFrequency: 'weekly' as const, priority: 0.7 },
    { path: '/privacy', changeFrequency: 'monthly' as const, priority: 0.3 },
    { path: '/terms', changeFrequency: 'monthly' as const, priority: 0.3 },
  ];

  return pages.flatMap((page) =>
    locales.map((locale) => ({
      url: `${baseUrl}/${locale}${page.path}`,
      lastModified: now,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
    }))
  );
}
