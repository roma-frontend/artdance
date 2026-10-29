/**
 * XML для карты сайта и RSS-ленты блога.
 *
 * Чистые функции: на входе готовые значения, на выходе строка документа. Без
 * обращений к данным и без `next/*`, поэтому проверяются тестом без сервера.
 *
 * Всё, что попадает в XML из данных (заголовки статей, описания), экранируется.
 * Символы, которых XML 1.0 не допускает (управляющие, кроме таба, перевода строки
 * и возврата каретки), вырезаются: один такой символ в описании статьи делает
 * ленту нечитаемой для читалки целиком.
 */

/** Символы, которых XML 1.0 не допускает даже в экранированном виде. */
function isForbiddenXmlChar(code: number): boolean {
  if (code === 0x09 || code === 0x0a || code === 0x0d) return false;
  return code < 0x20 || code === 0xfffe || code === 0xffff;
}

export function escapeXml(value: string): string {
  let cleaned = '';
  for (const char of value) {
    if (!isForbiddenXmlChar(char.codePointAt(0) ?? 0)) cleaned += char;
  }

  return cleaned
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Документ `sitemapindex`: список адресов разделов карты. Дат здесь нет намеренно. */
export function buildSitemapIndexXml(locations: readonly string[]): string {
  const entries = locations.map(
    (location) => `  <sitemap>\n    <loc>${escapeXml(location)}</loc>\n  </sitemap>`,
  );

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    '</sitemapindex>',
    '',
  ].join('\n');
}

/** Запись `urlset`. Форма совпадает с `MetadataRoute.Sitemap`, но без импорта `next`. */
export interface SitemapUrlEntry {
  url: string;
  lastModified?: Date | string | undefined;
  changeFrequency?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never' | undefined;
  priority?: number | undefined;
  alternates?: { languages?: Readonly<Record<string, string | undefined>> | undefined } | undefined;
}

/** Дата для `<lastmod>` в ISO 8601. Битая дата пропускается, а не пишется как `Invalid Date`. */
function formatLastModified(value: Date | string | undefined): string | null {
  if (value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Документ `urlset`: записи одного раздела карты. Одна страница — одна запись, а её
 * версии на других языках перечисляются в `xhtml:link` (hreflang внутри карты сайта).
 */
export function buildSitemapUrlsetXml(entries: readonly SitemapUrlEntry[]): string {
  const urls = entries.map((entry) => {
    const lines = ['  <url>', `    <loc>${escapeXml(entry.url)}</loc>`];

    const lastmod = formatLastModified(entry.lastModified);
    if (lastmod) lines.push(`    <lastmod>${lastmod}</lastmod>`);
    if (entry.changeFrequency) lines.push(`    <changefreq>${entry.changeFrequency}</changefreq>`);
    if (entry.priority !== undefined && Number.isFinite(entry.priority)) {
      lines.push(`    <priority>${entry.priority}</priority>`);
    }

    const languages: Readonly<Record<string, string | undefined>> = entry.alternates?.languages ?? {};
    for (const [hreflang, href] of Object.entries(languages)) {
      if (!href) continue;
      lines.push(
        `    <xhtml:link rel="alternate" hreflang="${escapeXml(hreflang)}" href="${escapeXml(href)}" />`,
      );
    }

    lines.push('  </url>');
    return lines.join('\n');
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}

export interface BlogFeedItem {
  title: string;
  link: string;
  description?: string | null;
  pubDate?: Date | null;
}

export interface BlogFeed {
  title: string;
  description: string;
  /** Страница блога на языке ленты. */
  link: string;
  /** Адрес самой ленты: по нему читалка узнаёт, откуда пришёл документ. */
  selfLink: string;
  /** Язык ленты по BCP 47, например `hy-AM`. */
  language: string;
  items: readonly BlogFeedItem[];
}

/** Дата в формате RFC 822, который требует RSS 2.0. Битая дата в ленту не попадает. */
function formatPubDate(date: Date | null | undefined): string | null {
  if (!date || Number.isNaN(date.getTime())) return null;
  return date.toUTCString();
}

export function buildBlogRss(feed: BlogFeed): string {
  const items = feed.items.map((item) => {
    const pubDate = formatPubDate(item.pubDate);

    return [
      '    <item>',
      `      <title>${escapeXml(item.title)}</title>`,
      `      <link>${escapeXml(item.link)}</link>`,
      `      <guid isPermaLink="true">${escapeXml(item.link)}</guid>`,
      ...(item.description
        ? [`      <description>${escapeXml(item.description)}</description>`]
        : []),
      ...(pubDate ? [`      <pubDate>${pubDate}</pubDate>`] : []),
      '    </item>',
    ].join('\n');
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    `    <title>${escapeXml(feed.title)}</title>`,
    `    <link>${escapeXml(feed.link)}</link>`,
    `    <description>${escapeXml(feed.description)}</description>`,
    `    <language>${escapeXml(feed.language)}</language>`,
    `    <atom:link href="${escapeXml(feed.selfLink)}" rel="self" type="application/rss+xml" />`,
    ...items,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');
}
