/**
 * Карта сайта не расходится с маршрутами.
 *
 * Главная проверка здесь — последняя: она сверяет состав карты с файлами страниц
 * в `src/app/[locale]`. Без неё карта живёт своей жизнью в двух направлениях, и
 * оба плохие: URL, отвечающий 404, обесценивает всю карту в Search Console, а
 * забытая в карте страница просто не попадает в индекс — и об этом никто не
 * узнаёт, потому что страница при этом работает.
 *
 * Сравнение идёт по файловой системе, а не по списку в тесте: список пришлось бы
 * поддерживать третьим местом.
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { locales } from '@/i18n/config';
import { isEnabled, legalDocuments, seo, type FeatureKey } from '@/config';

import { buildSitemap, hreflangAlternates, localeAlternates, sitemapPaths } from './sitemap';

const slugs = {
  classes: ['latin-fusion', 'street-flow'],
  instructors: ['anna-mkrtchyan'],
  venues: ['pulse-dance-studio'],
  events: ['bachata-night-workshop'],
  styles: ['hip-hop', 'salsa'],
};

describe('localeAlternates', () => {
  it('перечисляет все локали и x-default', () => {
    const alternates = localeAlternates('/classes');

    expect(Object.keys(alternates)).toHaveLength(locales.length + 1);
    expect(alternates['x-default']).toBe(`/${seo.hreflang.xDefault}/classes`);
  });

  it('использует языковые теги BCP 47, а не коды локалей', () => {
    const alternates = localeAlternates('/classes');

    expect(alternates['hy-AM']).toBe('/hy/classes');
    expect(alternates['ru-RU']).toBe('/ru/classes');
    expect(alternates['en-US']).toBe('/en/classes');
  });

  it('корень не превращается в двойной слеш', () => {
    expect(localeAlternates('/')['en-US']).toBe('/en');
  });
});

describe('hreflangAlternates', () => {
  it('отдаёт абсолютные адреса: относительный путь в карте сайта недопустим', () => {
    for (const url of Object.values(hreflangAlternates('/classes'))) {
      expect(url).toMatch(/^https?:\/\//);
    }
  });
});

describe('buildSitemap', () => {
  const entries = buildSitemap(slugs, new Date('2026-09-08T00:00:00.000Z'));

  it('даёт одну запись на страницу, а не на страницу × локаль', () => {
    expect(entries).toHaveLength(sitemapPaths(slugs).length);
    expect(new Set(entries.map((entry) => entry.url)).size).toBe(entries.length);
  });

  it('у каждой записи есть языковые альтернативы', () => {
    for (const entry of entries) {
      expect(Object.keys(entry.alternates?.languages ?? {})).toHaveLength(locales.length + 1);
    }
  });

  it('приоритет главной выше приоритета сущности', () => {
    const home = entries[0]!;
    const entity = entries.find((entry) => entry.url.includes('/classes/'))!;

    expect(home.priority).toBe(seo.sitemap.priorities.home);
    expect(entity.priority).toBeLessThan(home.priority!);
  });

  it('включает все переданные сущности', () => {
    const urls = entries.map((entry) => entry.url).join('\n');

    expect(urls).toContain('/classes/latin-fusion');
    expect(urls).toContain('/instructors/anna-mkrtchyan');
    expect(urls).toContain('/studios/pulse-dance-studio');
    expect(urls).toContain('/events/bachata-night-workshop');
  });

  it('включает контентные страницы и правовые документы', () => {
    const urls = entries.map((entry) => entry.url).join('\n');

    expect(urls).toContain('/about');
    expect(urls).toContain('/faq');
    expect(urls).toContain('/become-instructor');
    expect(urls).toContain('/legal/terms');
    expect(urls).toContain('/legal/privacy');
  });

  /*
   * Хаб направления — целевая страница органики, а не промежуточный экран:
   * пропавший из карты хаб означает потерянный вход по запросу «уроки сальсы в
   * Ереване». Перечень и сам раздел проверяются вместе, потому что раздел без
   * хабов бесполезен, а хабы без раздела — сироты.
   */
  it('включает перечень направлений и переданные хабы', () => {
    const urls = entries.map((entry) => entry.url).join('\n');

    expect(urls).toContain('/styles');
    expect(urls).toContain('/styles/hip-hop');
    expect(urls).toContain('/styles/salsa');
  });

  it('не приглашает поисковика на направления без предложения', () => {
    const urls = entries.map((entry) => entry.url);

    /* `flamenco` в `slugs.styles` не передан — значит его никто не ведёт. */
    expect(urls.some((url) => url.endsWith('/styles/flamenco'))).toBe(false);
  });

  it('правовой документ — самая низкая частота обновления и приоритет', () => {
    const legal = entries.find((entry) => entry.url.includes('/legal/terms'))!;
    const content = entries.find((entry) => entry.url.endsWith('/about'))!;

    expect(legal.priority).toBe(seo.sitemap.priorities.legal);
    expect(legal.priority).toBeLessThan(content.priority!);
    expect(legal.changeFrequency).toBe(seo.sitemap.changeFrequency.legal);
  });

  it('перечисляет все правовые документы, а не выборочно', () => {
    const legal = entries.filter((entry) => entry.url.includes('/legal/'));
    expect(legal).toHaveLength(legalDocuments.length);
  });
});

/* ───────────────── Сверка с реальными маршрутами ───────────────── */

const APP_DIR = join(process.cwd(), 'src', 'app', '[locale]');

/**
 * Публичные маршруты по файлам страниц.
 *
 * Динамические сегменты (`[slug]`) сворачиваются в шаблон: конкретные слаги
 * приходят из данных, и сравнивать их с файлами бессмысленно. Приватные разделы
 * пропускаются — они закрыты от индексации и в карте им не место.
 */
function routeTemplates(dir: string = APP_DIR, prefix = ''): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);

    if (entry === 'page.tsx') {
      found.push(prefix === '' ? '/' : prefix);
      continue;
    }

    if (!statSync(full).isDirectory()) continue;
    /* Группы маршрутов и приватные служебные папки в URL не участвуют. */
    if (entry.startsWith('(') || entry.startsWith('_') || entry.startsWith('@')) continue;

    found.push(...routeTemplates(full, `${prefix}/${entry}`));
  }

  return found;
}

/** Путь карты сайта → шаблон маршрута: `/classes/latin-fusion` → `/classes/[slug]`. */
function toTemplate(path: string): string {
  /*
   * У направлений сегмент назван по смыслу (`[style]`, а не `[slug]`): фильтр
   * каталога называется `style`, и хаб обязан читаться так же. Поэтому отдельная
   * ветка, а не общий `[slug]`.
   */
  const style = /^\/styles\/([^/]+)$/.exec(path);
  if (style) return '/styles/[style]';

  const dynamic = /^\/(classes|instructors|studios|events|shop|legal)\/([^/]+)$/.exec(path);
  return dynamic ? `/${dynamic[1]}/[slug]` : path;
}

/**
 * Маршруты, которых в карте нет намеренно.
 *
 * Приватное и служебное: корзина, оформление, бронирование. Они закрыты
 * `noIndexPathPrefixes` и `privatePaths`; появление любого из них в карте
 * означало бы приглашение проиндексировать чужой заказ.
 */
const NOT_IN_SITEMAP = ['/cart', '/checkout', '/checkout/[step]', '/booking', '/instructors/[slug]/book'];

/**
 * Разделы за флагом поставки.
 *
 * Страница существует, но при выключенном флаге не должна быть ни в навигации,
 * ни в карте: карта — обещание, что раздел работает. Без этого списка тест давал
 * бы ложную тревогу ровно в тот момент, когда флаг выключают.
 */
const FEATURE_GATED: ReadonlyArray<{ prefix: string; feature: FeatureKey }> = [
  { prefix: '/shop', feature: 'shop' },
  { prefix: '/courses', feature: 'courses' },
  { prefix: '/events', feature: 'events' },
  { prefix: '/pricing', feature: 'subscriptions' },
  { prefix: '/gift-cards', feature: 'shop' },
];

function isGatedOff(route: string): boolean {
  return FEATURE_GATED.some(
    ({ prefix, feature }) =>
      (route === prefix || route.startsWith(`${prefix}/`)) && !isEnabled(feature),
  );
}

describe('состав карты сайта', () => {
  const templates = new Set(sitemapPaths(slugs).map(toTemplate));
  const routes = routeTemplates();

  it('каждая страница карты существует как маршрут', () => {
    const missing = [...templates].filter((template) => !routes.includes(template));
    expect(missing, `в карте есть путь без страницы: ${missing.join(', ')}`).toEqual([]);
  });

  it('каждая публичная страница попала в карту', () => {
    const forgotten = routes.filter(
      (route) => !templates.has(route) && !NOT_IN_SITEMAP.includes(route) && !isGatedOff(route),
    );
    expect(forgotten, `страница есть, а в карте её нет: ${forgotten.join(', ')}`).toEqual([]);
  });
});

/**
 * Карточка для соцсетей есть у каждой публичной страницы.
 *
 * Проверка живёт здесь, а не в отдельном файле, потому что опирается на то же
 * самое: обход маршрутов и список разделов, которых в индексе нет намеренно.
 * Второй такой список означал бы, что однажды они разойдутся.
 *
 * Почему это вообще нужно проверять. `opengraph-image` привязан к СЕГМЕНТУ и не
 * наследуется вложенными: файл в `app/[locale]` даёт картинку главной и только
 * ей — `/about` остаётся без `og:image` совсем. Предположение об обратном стоило
 * одной сборки, и заметить его можно было только по разметке. Отсутствие файла в
 * новом разделе ничего не ломает и ничего не сообщает: ссылка просто приходит в
 * мессенджер строкой текста.
 *
 * Приватные разделы (корзина, оформление, бронирование) исключены: они закрыты от
 * индексации, и превью для них — обещание показать чужой заказ.
 */
describe('карточки для соцсетей', () => {
  const routes = routeTemplates();

  function hasOgImage(route: string): boolean {
    const dir = route === '/' ? APP_DIR : join(APP_DIR, ...route.slice(1).split('/'));
    return existsSync(join(dir, 'opengraph-image.tsx'));
  }

  it('у каждой публичной страницы есть своя карточка', () => {
    const missing = routes.filter(
      (route) => !hasOgImage(route) && !NOT_IN_SITEMAP.includes(route) && !isGatedOff(route),
    );

    expect(
      missing,
      `нет opengraph-image.tsx: ${missing.join(', ')} — ссылка на такую страницу придёт без превью`,
    ).toEqual([]);
  });

  it('приватные разделы карточки не получают', () => {
    for (const route of NOT_IN_SITEMAP) {
      expect(hasOgImage(route), `у приватного «${route}» есть карточка`).toBe(false);
    }
  });
});
