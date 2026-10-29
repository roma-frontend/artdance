import { describe, expect, it } from 'vitest';

import { buildBlogRss, buildSitemapIndexXml, buildSitemapUrlsetXml, escapeXml } from './feeds';

describe('escapeXml', () => {
  it('экранирует разметочные символы', () => {
    expect(escapeXml(`<a href="x">Tom & 'Jerry'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;Tom &amp; &apos;Jerry&apos;&lt;/a&gt;',
    );
  });

  it('вырезает управляющие символы, которых нет в XML 1.0', () => {
    expect(escapeXml('a\u0000b\u0008c\u000Bd\u001Fe')).toBe('abcde');
  });

  it('сохраняет табуляцию, перевод строки и возврат каретки', () => {
    expect(escapeXml('a\tb\nc\rd')).toBe('a\tb\nc\rd');
  });

  it('не меняет обычный текст на русском и армянском', () => {
    expect(escapeXml('Занятия — Բաժին')).toBe('Занятия — Բաժին');
  });
});

describe('buildSitemapIndexXml', () => {
  it('перечисляет адреса в переданном порядке', () => {
    const xml = buildSitemapIndexXml([
      'https://artdance.am/sitemap/pages.xml',
      'https://artdance.am/sitemap/blog.xml',
    ]);

    expect(xml).toContain('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml.match(/<sitemap>/g)).toHaveLength(2);
    expect(xml.indexOf('pages.xml')).toBeLessThan(xml.indexOf('blog.xml'));
  });

  it('экранирует адреса', () => {
    const xml = buildSitemapIndexXml(['https://artdance.am/s?a=1&b=2']);
    expect(xml).toContain('<loc>https://artdance.am/s?a=1&amp;b=2</loc>');
  });

  it('пустой список даёт документ без записей', () => {
    const xml = buildSitemapIndexXml([]);
    expect(xml).toContain('<sitemapindex');
    expect(xml).not.toContain('<sitemap>');
  });
});

describe('buildSitemapUrlsetXml', () => {
  const home = 'https://artdance.am/hy';
  const alternates = {
    languages: {
      hy: 'https://artdance.am/hy',
      ru: 'https://artdance.am/ru',
      'x-default': 'https://artdance.am/hy',
    },
  };

  it('объявляет пространства имён sitemap и xhtml, пустой список без записей', () => {
    const xml = buildSitemapUrlsetXml([]);

    expect(xml).toContain(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    );
    expect(xml).not.toContain('<url>');
  });

  it('одна запись на страницу, версии по языкам в xhtml:link', () => {
    const xml = buildSitemapUrlsetXml([{ url: home, alternates }]);

    expect(xml.match(/<url>/g)).toHaveLength(1);
    expect(xml).toContain(`<loc>${home}</loc>`);
    expect(xml).toContain('<xhtml:link rel="alternate" hreflang="ru" href="https://artdance.am/ru" />');
    expect(xml).toContain(
      '<xhtml:link rel="alternate" hreflang="x-default" href="https://artdance.am/hy" />',
    );
  });

  it('дата в ISO 8601, частота и приоритет на месте', () => {
    const xml = buildSitemapUrlsetXml([
      {
        url: home,
        lastModified: new Date('2026-09-01T10:00:00.000Z'),
        changeFrequency: 'weekly',
        priority: 0.8,
      },
    ]);

    expect(xml).toContain('<lastmod>2026-09-01T10:00:00.000Z</lastmod>');
    expect(xml).toContain('<changefreq>weekly</changefreq>');
    expect(xml).toContain('<priority>0.8</priority>');
  });

  it('дата строкой тоже принимается', () => {
    const xml = buildSitemapUrlsetXml([{ url: home, lastModified: '2026-09-01T10:00:00.000Z' }]);

    expect(xml).toContain('<lastmod>2026-09-01T10:00:00.000Z</lastmod>');
  });

  it('битая дата и отсутствующие поля не попадают в документ', () => {
    const xml = buildSitemapUrlsetXml([{ url: home, lastModified: new Date('x') }]);

    expect(xml).not.toContain('<lastmod>');
    expect(xml).not.toContain('Invalid Date');
    expect(xml).not.toContain('<changefreq>');
    expect(xml).not.toContain('<priority>');
    expect(xml).not.toContain('<xhtml:link');
  });

  it('экранирует адрес страницы и адрес альтернативы', () => {
    const xml = buildSitemapUrlsetXml([
      {
        url: 'https://artdance.am/catalog?a=1&b=2',
        alternates: { languages: { ru: 'https://artdance.am/ru/catalog?a=1&b=2' } },
      },
    ]);

    expect(xml).toContain('<loc>https://artdance.am/catalog?a=1&amp;b=2</loc>');
    expect(xml).toContain('href="https://artdance.am/ru/catalog?a=1&amp;b=2"');
  });

  it('сохраняет порядок записей', () => {
    const xml = buildSitemapUrlsetXml([{ url: 'https://artdance.am/b' }, { url: 'https://artdance.am/a' }]);

    expect(xml.indexOf('/b</loc>')).toBeLessThan(xml.indexOf('/a</loc>'));
  });
});

const feed = {
  title: 'Блог ARTDANCE',
  description: 'Статьи о танце & ритме',
  link: 'https://artdance.am/ru/blog',
  selfLink: 'https://artdance.am/feed.xml?locale=ru',
  language: 'ru-RU',
};

describe('buildBlogRss', () => {
  it('описывает канал: название, ссылки, язык и самоссылку', () => {
    const xml = buildBlogRss({ ...feed, items: [] });

    expect(xml).toContain('<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">');
    expect(xml).toContain('<title>Блог ARTDANCE</title>');
    expect(xml).toContain('<link>https://artdance.am/ru/blog</link>');
    expect(xml).toContain('<description>Статьи о танце &amp; ритме</description>');
    expect(xml).toContain('<language>ru-RU</language>');
    expect(xml).toContain(
      '<atom:link href="https://artdance.am/feed.xml?locale=ru" rel="self" type="application/rss+xml" />',
    );
  });

  it('пустая лента не содержит записей', () => {
    expect(buildBlogRss({ ...feed, items: [] })).not.toContain('<item>');
  });

  it('одна запись на статью, дата в формате RFC 822', () => {
    const xml = buildBlogRss({
      ...feed,
      items: [
        {
          title: 'План на весну',
          link: 'https://artdance.am/ru/blog/spring-plan',
          description: 'Что будет в марте',
          pubDate: new Date('2026-09-01T10:00:00.000Z'),
        },
        { title: 'Дыхание', link: 'https://artdance.am/ru/blog/breathing-basics' },
      ],
    });

    expect(xml.match(/<item>/g)).toHaveLength(2);
    expect(xml).toContain('<pubDate>Tue, 01 Sep 2026 10:00:00 GMT</pubDate>');
    expect(xml).toContain('<guid isPermaLink="true">https://artdance.am/ru/blog/spring-plan</guid>');
  });

  it('без даты и описания тегов нет, а запись остаётся', () => {
    const xml = buildBlogRss({
      ...feed,
      items: [
        {
          title: 'Дыхание',
          link: 'https://artdance.am/ru/blog/breathing-basics',
          description: null,
          pubDate: null,
        },
      ],
    });

    expect(xml.match(/<item>/g)).toHaveLength(1);
    expect(xml).toContain('<title>Дыхание</title>');
    expect(xml).not.toContain('<pubDate>');
    // Одно вхождение приходится на описание канала, второго у записи нет.
    expect(xml.split('<description>')).toHaveLength(2);
  });

  it('битая дата не попадает в ленту', () => {
    const xml = buildBlogRss({
      ...feed,
      items: [{ title: 'Черновик', link: 'https://artdance.am/ru/blog/draft', pubDate: new Date('x') }],
    });

    expect(xml).not.toContain('<pubDate>');
    expect(xml).not.toContain('Invalid Date');
  });

  it('экранирует заголовок статьи', () => {
    const xml = buildBlogRss({
      ...feed,
      items: [{ title: 'Tom & Jerry <3', link: 'https://artdance.am/ru/blog/tom' }],
    });

    expect(xml).toContain('<title>Tom &amp; Jerry &lt;3</title>');
  });
});
