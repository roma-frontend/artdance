/**
 * Карточки ссылок для соцсетей отдаются и выглядят как карточки.
 *
 * Проверка живёт в e2e, потому что ни одно из здешних утверждений нельзя сделать
 * без сборки: адрес картинки Next собирает сам и подписывает отпечатком, сама
 * картинка рисуется отдельным маршрутом, а разметку `<head>` формирует слияние
 * метаданных страницы, макета и файлового соглашения. Ровно на этом слиянии и
 * произошёл дефект, из-за которого проверка появилась: объявленный в метаданных
 * `openGraph.images` ОТМЕНЯЛ файловую карточку, и страница занятия отдавала общую
 * заглушку, хотя её собственная карточка собиралась и лежала рядом.
 *
 * Что здесь утверждается:
 *
 * 1. `og:image` есть, ведёт на собственную карточку страницы и отвечает
 *    картинкой — до этой задачи он на КАЖДОЙ странице указывал на
 *    `/media/og/default.jpg`, которого в `public` нет.
 * 2. Размер ровно 1200×630. Мессенджеры обрезают всё остальное по-своему, и
 *    «почти правильный» размер означает срезанный заголовок.
 * 3. Карточка локализована: армянская и английская версии одной страницы —
 *    разные картинки. Это единственная доступная снаружи проверка того, что
 *    армянские глифы вообще отрисовались: шрифт для них подключается отдельным
 *    файлом (`src/design/og-fonts/`), и его потеря не ломает ни типы, ни сборку.
 */

import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { demoClasses, demoEvents, demoInstructors, demoVenues } from '../prisma/fixtures/demo';
import { routes } from '../src/config/routes';
import { seo } from '../src/config/seo';

const LOCALE = 'en';
const localized = (path: string, locale = LOCALE): string => `/${locale}${path}`;

/** Аудит идёт на одной ширине: разметка `<head>` от размера окна не зависит. */
const AUDIT_PROJECT = 'desktop';

async function ogImageUrl(page: Page): Promise<string> {
  const content = await page
    .locator('meta[property="og:image"]')
    .first()
    .getAttribute('content');

  expect(content, 'на странице нет og:image').toBeTruthy();
  return content as string;
}

/**
 * Размеры PNG из заголовка файла.
 *
 * IHDR — первый чанк, ширина и высота лежат по фиксированным смещениям 16 и 20.
 * Разбор в четыре строки дешевле зависимости ради двух чисел.
 */
function pngSize(bytes: Buffer): { width: number; height: number } {
  expect(bytes.subarray(1, 4).toString('latin1'), 'это не PNG').toBe('PNG');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

async function fetchCard(request: APIRequestContext, url: string): Promise<Buffer> {
  const response = await request.get(url);

  expect(response.status(), `карточка ${url} не отдалась`).toBe(200);
  expect(response.headers()['content-type']).toContain('image/png');

  return Buffer.from(await response.body());
}

/**
 * Страницы разных видов: сущности со своей фотографией, раздел каталога,
 * контентная страница без кадра, правовой документ, хаб направления.
 */
const pages = [
  routes.home(),
  routes.class(demoClasses[0]!.slug),
  routes.instructor(demoInstructors[0]!.slug),
  routes.event(demoEvents[0]!.slug),
  routes.studio(demoVenues[0]!.slug),
  routes.style('hip-hop'),
  /* Направление без предложения: карточка нужна и закрытой от индексации странице. */
  routes.style('flamenco'),
  routes.styles(),
  routes.classes(),
  routes.about(),
  routes.faq(),
  routes.terms(),
];

test.describe('карточки для соцсетей', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== AUDIT_PROJECT, 'Разметка не зависит от ширины окна');
  });

  for (const path of pages) {
    test(`${localized(path)}: карточка отдаётся и имеет нужный размер`, async ({
      page,
      request,
    }) => {
      await page.goto(localized(path));

      const url = await ogImageUrl(page);

      /* Абсолютный адрес: относительный в Open Graph игнорируется мессенджерами. */
      expect(url).toMatch(/^https?:\/\//);
      /* Карточка своя, а не унаследованная от корня локали. */
      expect(url).toContain(`${localized(path)}${path === '/' ? '' : '/'}opengraph-image`);

      const bytes = await fetchCard(request, url);

      expect(pngSize(bytes)).toEqual({
        width: seo.openGraph.imageWidth,
        height: seo.openGraph.imageHeight,
      });
    });
  }

  test('размер и текстовая альтернатива объявлены рядом с картинкой', async ({ page }) => {
    await page.goto(localized(routes.class(demoClasses[0]!.slug)));

    const value = async (property: string): Promise<string | null> =>
      page.locator(`meta[property="${property}"]`).first().getAttribute('content');

    expect(await value('og:image:width')).toBe(String(seo.openGraph.imageWidth));
    expect(await value('og:image:height')).toBe(String(seo.openGraph.imageHeight));
    expect(await value('og:image:type')).toBe('image/png');
    expect(await value('og:image:alt')).toBeTruthy();
  });

  test('карточка одной страницы в двух локалях — разные картинки', async ({ page, request }) => {
    const path = routes.class(demoClasses[0]!.slug);

    await page.goto(localized(path, 'en'));
    const english = await fetchCard(request, await ogImageUrl(page));

    await page.goto(localized(path, 'hy'));
    const armenian = await fetchCard(request, await ogImageUrl(page));

    /*
     * Название занятия в фикстурах одно и то же на всех языках (это контент
     * макета), поэтому различие даёт подпись вида сущности и уровень — то есть
     * текст, набранный армянскими глифами. Совпадение байт означало бы, что
     * армянская карточка отрисовалась английским текстом.
     */
    expect(armenian.equals(english), 'карточка не переводится').toBe(false);
  });

  test('ни одна страница не ссылается на несуществующую заглушку', async ({ page }) => {
    /*
     * Ровно тот адрес, который стоял в `og:image` до этой задачи. Файла в
     * `public` нет, и появиться он не должен: карточки рисуются маршрутами.
     */
    for (const path of [routes.home(), routes.about(), routes.terms()]) {
      await page.goto(localized(path));
      expect(await ogImageUrl(page), `заглушка вернулась на ${path}`).not.toContain('/media/og/');
    }
  });
});
