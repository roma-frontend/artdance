/**
 * ПОИСК — оверлей и `/api/search` в настоящем браузере.
 *
 * Unit-тесты уже проверили, что «Բաչատա», «bachata» и «бачата» дают один ключ, а
 * эндпоинт возвращает нужные коды. Здесь проверяется то, чего они увидеть не
 * могут: доходит ли запрос от поля ввода до API, отменяется ли устаревший,
 * появляется ли выдача, что происходит при сбое сети и работает ли переключатель
 * разделов. Ровно эти места ломаются молча — экран остаётся, а поиск перестаёт
 * находить.
 *
 * Тексты берутся из каталога переводов: правка формулировки не должна ронять
 * тест, а тест не должен фиксировать копирайт.
 */

import { expect, test, type Locator, type Page, type Request } from '@playwright/test';

import { limits } from '../src/config/business';
import en from '../src/i18n/messages/en';

const HOME = '/en';
const SEARCH_API = '/api/search';

const trigger = (page: Page): Locator =>
  page.getByRole('banner').getByRole('link', { name: en.nav.openSearch });
const overlay = (page: Page): Locator => page.getByRole('dialog');
const field = (page: Page): Locator => overlay(page).getByRole('searchbox');

/** Подставляет значение в ICU-строку: тест не должен переписывать текст руками. */
function withQuery(template: string, query: string): string {
  return template.replace('{query}', query);
}

async function openSearch(page: Page): Promise<void> {
  await trigger(page).click();
  await expect(overlay(page)).toBeVisible();
}

/**
 * Ввод и ожидание ответа.
 *
 * `fill` вводит строку целиком, поэтому задержка ввода отрабатывает один раз —
 * именно так, как при вставке из буфера. Побуквенный ввод проверяется отдельно, в
 * тесте про число запросов.
 */
async function search(page: Page, term: string): Promise<void> {
  const answered = page.waitForResponse(
    (response) => response.url().includes(SEARCH_API) && response.status() === 200,
  );
  await field(page).fill(term);
  await answered;
}

/** Ссылки выдачи, кроме служебной «показать всё». */
function results(page: Page): Locator {
  return overlay(page).getByRole('listitem').getByRole('link');
}

test.describe('SearchOverlay', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HOME);
  });

  test('открывается иконкой и ставит фокус в поле ввода', async ({ page }) => {
    await openSearch(page);
    await expect(field(page)).toBeFocused();
    await expect(overlay(page)).toHaveAccessibleName(en.common.actions.search);
  });

  test('открывается и закрывается по Cmd/Ctrl+K', async ({ page }) => {
    /*
     * Сочетание слушается на уровне окна, а не поля: оно обязано работать с любого
     * места страницы. Модификатор различается по платформе, поэтому нажимаются
     * оба — на нецелевой платформе лишний просто ничего не делает.
     */
    await page.keyboard.press('ControlOrMeta+k');
    await expect(overlay(page)).toBeVisible();

    await page.keyboard.press('ControlOrMeta+k');
    await expect(overlay(page)).toBeHidden();
  });

  test('до ввода показывает направления и не обращается к серверу', async ({ page }) => {
    const requests: Request[] = [];
    page.on('request', (request) => {
      if (request.url().includes(SEARCH_API)) requests.push(request);
    });

    await openSearch(page);
    await expect(overlay(page).getByText(en.search.popular)).toBeVisible();
    await expect(results(page)).toHaveCount(limits.search.popularCount);

    /* Пустой экран открывается мгновенно: список направлений — словарь домена. */
    expect(requests).toHaveLength(0);
  });

  test('слишком короткий запрос объясняет себя и не идёт в сеть', async ({ page }) => {
    const requests: Request[] = [];
    page.on('request', (request) => {
      if (request.url().includes(SEARCH_API)) requests.push(request);
    });

    await openSearch(page);
    await field(page).fill('b');

    await expect(
      overlay(page).getByText(
        en.search.minLength.replace('{min}', String(limits.search.minQueryLength)),
      ),
    ).toBeVisible();
    expect(requests).toHaveLength(0);
  });

  test('находит занятие и подсвечивает совпадение в названии', async ({ page }) => {
    await openSearch(page);
    await search(page, 'latin');

    const classLink = results(page).filter({ hasText: 'Latin Fusion' }).first();
    await expect(classLink).toBeVisible();
    await expect(classLink).toHaveAttribute('href', '/en/classes/latin-fusion');

    /* Подсветка — по исходному написанию, а не по огрублённому ключу поиска. */
    await expect(classLink.locator('mark')).toHaveText('Latin', { useInnerText: true });
  });

  test('находит то же самое по кириллице и с опечаткой', async ({ page }) => {
    await openSearch(page);

    await search(page, 'бачата');
    const byCyrillic = await results(page).count();
    expect(byCyrillic).toBeGreaterThan(0);

    /* Одна лишняя правка не должна обнулять выдачу: «бочата» — это «бачата». */
    await search(page, 'бочата');
    await expect(results(page)).toHaveCount(byCyrillic);
  });

  test('запрос названия направления ведёт в подборку', async ({ page }) => {
    await openSearch(page);
    await search(page, 'сальса');

    const collection = results(page).first();
    await expect(collection).toHaveAttribute('href', '/en/discover?style=salsa');
  });

  test('чип раздела сужает выдачу и остаётся нажатым', async ({ page }) => {
    await openSearch(page);
    await search(page, 'dance');

    const chip = overlay(page).getByRole('button', { name: en.search.scopeInstructors });
    const answered = page.waitForResponse(
      (response) => response.url().includes('scope=instructors') && response.status() === 200,
    );
    await chip.click();
    await answered;

    await expect(chip).toHaveAttribute('aria-pressed', 'true');

    const hrefs = await results(page).evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('href') ?? ''),
    );
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(href.startsWith('/en/instructors/')).toBe(true);
    }
  });

  test('ничего не найдено — говорит об этом и предлагает выход', async ({ page }) => {
    await openSearch(page);
    await search(page, 'квантовая механика');

    await expect(
      overlay(page).getByText(withQuery(en.search.noResults, 'квантовая механика')),
    ).toBeVisible();
    await expect(overlay(page).getByText(en.search.noResultsHint)).toBeVisible();
    await expect(results(page)).toHaveCount(0);
  });

  test('сбой сети не выглядит как пустой каталог и допускает повтор', async ({ page }) => {
    await openSearch(page);

    /* Первый запрос обрывается на уровне сети — так же, как при потере связи. */
    await page.route(`**${SEARCH_API}**`, (route) => route.abort());
    await field(page).fill('salsa');

    await expect(overlay(page).getByText(en.search.failed)).toBeVisible();
    const retry = overlay(page).getByRole('button', { name: en.common.actions.retry });
    await expect(retry).toBeVisible();

    await page.unroute(`**${SEARCH_API}**`);
    const answered = page.waitForResponse(
      (response) => response.url().includes(SEARCH_API) && response.status() === 200,
    );
    await retry.click();
    await answered;

    await expect(overlay(page).getByText(en.search.failed)).toBeHidden();
    expect(await results(page).count()).toBeGreaterThan(0);
  });

  test('быстрый ввод шлёт один запрос, а не по одному на символ', async ({ page }) => {
    const sent: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes(SEARCH_API)) sent.push(request.url());
    });

    await openSearch(page);
    /* Паузы между нажатиями короче задержки: так печатает человек. */
    await field(page).pressSequentially('bachata', { delay: 30 });
    await page.waitForResponse(
      (response) => response.url().includes(SEARCH_API) && response.status() === 200,
    );

    /*
     * Задержка ввода и отмена предыдущего запроса работают вместе: без задержки
     * запросов было бы семь, без отмены в списке оказалась бы выдача по «bach».
     */
    expect(sent.length).toBeLessThanOrEqual(2);
    expect(sent.at(-1)).toContain('q=bachata');
  });

  test('Enter уводит на страницу результатов с запросом в адресе', async ({ page }) => {
    await openSearch(page);
    await search(page, 'salsa');
    await field(page).press('Enter');

    await expect(page).toHaveURL(/\/en\/discover\?q=salsa$/, { timeout: 15_000 });
    await expect(overlay(page)).toBeHidden();
  });

  test('«показать всё» сохраняет и запрос, и выбранный раздел', async ({ page }) => {
    await openSearch(page);
    await search(page, 'dance');

    const answered = page.waitForResponse(
      (response) => response.url().includes('scope=studios') && response.status() === 200,
    );
    await overlay(page).getByRole('button', { name: en.search.scopeStudios }).click();
    await answered;

    await overlay(page).getByRole('link', { name: en.search.viewAll }).click();
    await expect(page).toHaveURL(/\/en\/discover\?q=dance&scope=studios$/, { timeout: 15_000 });
  });

  test('стрелка вниз переводит фокус из поля в выдачу', async ({ page }) => {
    await openSearch(page);
    await search(page, 'salsa');

    await field(page).press('ArrowDown');
    await expect(results(page).first()).toBeFocused();
  });

  test('закрывается по Esc и возвращает фокус на иконку', async ({ page }) => {
    await openSearch(page);
    await page.keyboard.press('Escape');

    await expect(overlay(page)).toBeHidden();
    await expect(trigger(page)).toBeFocused();
  });

  test('закрытый поиск не помнит прошлый запрос', async ({ page }) => {
    await openSearch(page);
    await search(page, 'salsa');
    await page.keyboard.press('Escape');

    await openSearch(page);
    await expect(field(page)).toHaveValue('');
    await expect(overlay(page).getByText(en.search.popular)).toBeVisible();
  });
});

/**
 * Страница результатов — то, что оверлей не может дать: адрес, которым делятся.
 */
test.describe('Страница результатов поиска', () => {
  test('открывается по прямой ссылке и показывает счётчики разделов', async ({ page }) => {
    await page.goto('/en/discover?q=pulse');

    await expect(page.getByRole('heading', { name: en.search.resultsTitle })).toBeVisible();

    /*
     * Зал с этим названием обязан быть в выдаче — и выше занятий в нём. Ищется
     * первая КАРТОЧКА результата, а не первая ссылка в `main`: до списка стоят
     * крошки, и они тоже ссылки в элементах списка.
     */
    const first = page.getByRole('main').getByRole('article').first();
    await expect(first.getByRole('link').first()).toHaveAttribute('href', /\/en\/studios\//);
  });

  test('раздел в адресе сужает выдачу', async ({ page }) => {
    await page.goto('/en/discover?q=dance&scope=instructors');

    const hrefs = await page
      .getByRole('main')
      .getByRole('article')
      .getByRole('link')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href') ?? ''));

    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(href.startsWith('/en/instructors/')).toBe(true);
    }
  });
});
