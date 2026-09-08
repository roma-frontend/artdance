/**
 * SEO-сигналы в готовом HTML.
 *
 * Юнит-тесты проверяют, что помощники собирают правильные объекты. Они не
 * отвечают на вопрос, доехали ли эти объекты до документа: `generateMetadata`
 * можно забыть вызвать, схему — не отрендерить, а `noindex` поставить на
 * публичной странице. Это видно только в собранном ответе.
 *
 * Отдельно проверяется карта сайта: она отдаётся как XML, и ошибка в ней
 * означает, что поисковик не найдёт ни одной страницы каталога.
 */

import { expect, test, type Page } from '@playwright/test';

import { demoClasses, demoEvents, demoInstructors, demoVenues } from '../prisma/fixtures/demo';
import { routes } from '../src/config/routes';
import { localeMeta, locales } from '../src/i18n/config';

const LOCALE = 'en';
const localized = (path: string): string => `/${LOCALE}${path}`;

/** Аудит идёт на одной ширине: метаданные от размера окна не зависят. */
const AUDIT_PROJECT = 'desktop';

async function attribute(page: Page, selector: string, name: string): Promise<string | null> {
  return page.locator(selector).first().getAttribute(name);
}

async function structuredData(page: Page): Promise<unknown[]> {
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  return blocks.map((block) => JSON.parse(block));
}

/** Все типы схем на странице, включая вложенные в `@graph`. */
function schemaTypes(payloads: readonly unknown[]): string[] {
  const types: string[] = [];

  for (const payload of payloads) {
    const node = payload as Record<string, unknown>;
    const graph = node['@graph'];

    if (Array.isArray(graph)) {
      for (const item of graph) {
        const type = (item as Record<string, unknown>)['@type'];
        if (typeof type === 'string') types.push(type);
      }
      continue;
    }

    if (typeof node['@type'] === 'string') types.push(node['@type']);
  }

  return types;
}

const pages = [
  { path: routes.home(), schema: 'Organization' },
  { path: routes.classes(), schema: 'WebSite' },
  { path: routes.class(demoClasses[0]!.slug), schema: 'Course' },
  { path: routes.instructor(demoInstructors[0]!.slug), schema: 'Person' },
  { path: routes.studio(demoVenues[0]!.slug), schema: 'LocalBusiness' },
  { path: routes.event(demoEvents[0]!.slug), schema: 'Event' },
  /* Контентные страницы: своей схемы сущности у них нет, кроме вопросов и ответов. */
  { path: routes.faq(), schema: 'FAQPage' },
  { path: routes.about(), schema: 'WebSite' },
  { path: routes.terms(), schema: 'WebSite' },
  /*
   * Хабы направлений — целевые страницы органики, и метаданные на них важнее, чем
   * где-либо: потерянный canonical здесь означает конкуренцию хаба с каталогом за
   * один и тот же запрос.
   */
  { path: routes.styles(), schema: 'WebSite' },
  { path: routes.style('hip-hop'), schema: 'BreadcrumbList' },
];

test.describe('метаданные публичных страниц', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== AUDIT_PROJECT, 'Метаданные не зависят от ширины окна');
  });

  for (const { path, schema } of pages) {
    test(`${localized(path)}: canonical, hreflang и ${schema}`, async ({ page }) => {
      await page.goto(localized(path));

      /* Канонический адрес — абсолютный и указывает на текущую локаль. */
      const canonical = await attribute(page, 'link[rel="canonical"]', 'href');
      expect(canonical, 'нет canonical').not.toBeNull();
      expect(canonical).toMatch(new RegExp(`/${LOCALE}${path === '/' ? '$' : path}`));

      /* Альтернатива для каждой локали плюс x-default. */
      const alternates = page.locator('link[rel="alternate"][hreflang]');
      const hreflangs = await alternates.evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute('hreflang')),
      );

      for (const locale of locales) {
        expect(hreflangs, `нет hreflang для ${locale}`).toContain(localeMeta[locale].bcp47);
      }
      expect(hreflangs).toContain('x-default');

      /* Публичная страница обязана быть индексируемой. */
      const robots = await attribute(page, 'meta[name="robots"]', 'content');
      expect(robots ?? 'index').not.toContain('noindex');

      /* Схема сущности на месте, и JSON разбирается. */
      expect(schemaTypes(await structuredData(page))).toContain(schema);
    });
  }

  test('карточка для соцсетей заполнена', async ({ page }) => {
    await page.goto(localized(routes.class(demoClasses[0]!.slug)));

    for (const property of ['og:title', 'og:description', 'og:url', 'og:image']) {
      const content = await attribute(page, `meta[property="${property}"]`, 'content');
      expect(content, `пусто в ${property}`).toBeTruthy();
    }

    expect(await attribute(page, 'meta[name="twitter:card"]', 'content')).toBe(
      'summary_large_image',
    );
  });

  test('приватный раздел закрыт от индексации и не объявляет canonical', async ({ page }) => {
    await page.goto(localized(routes.cart()));

    expect(await attribute(page, 'meta[name="robots"]', 'content')).toContain('noindex');
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  });

  /**
   * Направление без предложения закрыто от индексации.
   *
   * Это не приватность, а честность выдачи: страница фламенко правдиво описывает
   * танец, но обещать «уроки фламенко в Ереване», которых никто не ведёт, —
   * значит получить отказ на первом же переходе из поиска. Признак выводится из
   * данных, поэтому проверка идёт против живой сборки: в юнит-тесте виден только
   * состав карты сайта, а не то, что попало в разметку страницы.
   */
  test('направление без занятий и преподавателей не приглашает поисковика', async ({ page }) => {
    await page.goto(localized(routes.style('flamenco')));

    expect(await attribute(page, 'meta[name="robots"]', 'content')).toContain('noindex');
    /* Страница при этом работает: описание направления на месте. */
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});

test.describe('карта сайта', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== AUDIT_PROJECT, 'Карта сайта не зависит от ширины окна');
  });

  test('отдаётся XML со всеми разделами и языковыми версиями', async ({ request }) => {
    const response = await request.get('/sitemap.xml');

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('xml');

    const xml = await response.text();

    /* Разделы каталога. */
    for (const path of [routes.classes(), routes.instructors(), routes.studios()]) {
      expect(xml, `нет раздела ${path}`).toContain(path);
    }

    /* Сущности из демо-данных. */
    expect(xml).toContain(demoClasses[0]!.slug);
    expect(xml).toContain(demoInstructors[0]!.slug);
    expect(xml).toContain(demoVenues[0]!.slug);

    /* Контентные страницы и правовые документы: ссылки на них есть в подвале. */
    for (const path of [routes.about(), routes.faq(), routes.becomeInstructor(), routes.terms()]) {
      expect(xml, `нет страницы ${path}`).toContain(path);
    }

    /*
     * Хабы направлений: в карте только те, у которых есть предложение. Пятьдесят
     * четыре адреса, из которых треть отвечает «пока никто не ведёт»,
     * обесценивают карту целиком.
     */
    expect(xml, 'нет перечня направлений').toContain(routes.styles());
    expect(xml, 'нет хаба направления с занятиями').toContain(routes.style('hip-hop'));
    expect(xml, 'в карте направление, которого никто не ведёт').not.toContain(
      routes.style('flamenco'),
    );

    /* Языковые версии объявлены альтернативами, а не отдельными записями. */
    expect(xml).toContain('xhtml:link');
    for (const locale of locales) {
      expect(xml, `нет альтернативы ${locale}`).toContain(localeMeta[locale].bcp47);
    }
  });

  /**
   * В непроизводственной сборке `robots.ts` закрывает весь сайт целиком, и
   * ссылки на карту сайта в нём нет — превью, попавшее в индекс, конкурирует с
   * продакшеном за те же запросы. Проверяется именно этот контракт: тест идёт
   * против локальной сборки, и ждать в ней продакшен-правил было бы неверно.
   */
  test('непроизводственная сборка закрыта от индексации целиком', async ({ request }) => {
    const response = await request.get('/robots.txt');
    const text = await response.text();

    expect(response.status()).toBe(200);
    expect(text).toContain('Disallow: /');
    expect(text).not.toContain('Sitemap:');
  });
});
