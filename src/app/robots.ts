import type { MetadataRoute } from 'next';

import { absoluteUrl, noIndexPathPrefixes } from '@/config';
import { isProduction } from '@/config/env';

/**
 * robots.txt генерируется из `noIndexPathPrefixes`: закрытый раздел нельзя
 * забыть добавить сюда, потому что список тот же, что использует middleware.
 */
export default function robots(): MetadataRoute.Robots {
  if (!isProduction) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: noIndexPathPrefixes.map((prefix) => `${prefix}/`),
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
