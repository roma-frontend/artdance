/**
 * Гидратация без расхождений.
 *
 * Проверка появилась после двух находок одной природы: данные ICU в Node и в
 * браузере не совпадают, и всё, что формируется через локаль, расходится между
 * серверной разметкой и первым клиентским рендером. Для локали `hy` сервер
 * отдавал «2500» и «4,9», Chrome — «2,500» и «4.9»; в календаре бронирования
 * атрибут `data-day` был «01.09.2026» против «9/1/2026».
 *
 * Цена такого расхождения не косметическая: React отбрасывает серверную разметку
 * и перерисовывает поддерево целиком, то есть SSR теряется именно там, где он
 * заявлен как преимущество. Поэтому проверяются страницы, где формат зависит от
 * локали: лендинг во всех трёх языках и экран бронирования с календарём.
 */

import { expect, test } from '@playwright/test';

import { demoInstructors } from '../prisma/fixtures/demo';
import { locales } from '../src/i18n/config';

/** Ошибки гидратации React приходят и в `pageerror`, и в консоль. */
const HYDRATION_MARKERS = [
  'Hydration failed',
  'hydrated but some attributes',
  'did not match',
  'Minified React error #418',
  'Minified React error #423',
  'Minified React error #425',
];

const paths = [
  ...locales.map((locale) => `/${locale}`),
  `/en/instructors/${demoInstructors[0]!.slug}/book`,
  '/en/cart',
];

for (const path of paths) {
  test(`${path} гидратируется без расхождений`, async ({ page }) => {
    const problems: string[] = [];

    const collect = (text: string) => {
      if (HYDRATION_MARKERS.some((marker) => text.includes(marker))) problems.push(text);
    };

    page.on('pageerror', (error) => collect(String(error)));
    page.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning') collect(message.text());
    });

    await page.goto(path);
    await page.waitForLoadState('load');
    /* Гидратация островков идёт после загрузки: даём React дойти до конца. */
    await expect(page.locator('body')).toBeVisible();
    await page.waitForTimeout(1_000);

    expect(problems, `расхождения гидратации на ${path}:\n${problems.join('\n')}`).toEqual([]);
  });
}
