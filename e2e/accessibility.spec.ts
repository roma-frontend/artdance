/**
 * Доступность: машинная проверка движком axe-core.
 *
 * Зачем отдельный файл, когда доступность проверяется и в остальных спеках: там
 * проверяются СВОЙСТВА, которые знает только автор компонента — ловушка фокуса,
 * возврат фокуса, текстовая альтернатива у значка верификации. Здесь проверяется
 * то, чего автор знать не может: контраст всех пар «текст — фон» на трёх языках
 * в двух темах, корректность ролей ARIA, порядок заголовков, доступные имена
 * ссылок. Это работа для движка — и это тот же движок, который стоит внутри
 * Lighthouse и большинства сервисов аудита.
 *
 * Проверяется КАЖДАЯ локаль, а не только английская: армянские слова длиннее и
 * уже ломали раскладку там, где английский текст умещался. Проверяются ОБЕ темы:
 * контраст в тёмной теме — отдельный набор пар, и брендовый бургунди на почти
 * чёрном фоне давал 1.6:1 при формально «настроенном» акценте.
 */

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import en from '../src/i18n/messages/en';
import { locales } from '../src/i18n/config';

/**
 * Уровни, которые считаются обязательными.
 *
 * `best-practice` не включён намеренно: это рекомендации Deque, а не критерии
 * WCAG, и среди них есть спорные. Обязателен стандарт.
 */
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/**
 * Проект, на котором идёт аудит страницы.
 *
 * Контраст, роли ARIA, порядок заголовков и доступные имена от ширины окна не
 * зависят: это свойства разметки и палитры. Прогон одного и того же аудита на
 * трёх ширинах втрое увеличивал время джоба в CI (двадцатиминутный лимит был
 * превышен) и не находил ничего нового.
 *
 * То, что действительно зависит от ширины, проверяется отдельно: раскладка —
 * `layout-integrity.spec.ts`, мобильное меню — ниже, на своём проекте.
 */
const AUDIT_PROJECT = 'desktop';
/** Мобильное меню существует только там, где есть бургер. */
const DRAWER_PROJECT = 'mobile';

/**
 * Привести страницу к конечному состоянию.
 *
 * Движок пропускает скрытые элементы, а секции ниже первого экрана до появления
 * прозрачны — иначе половина страницы осталась бы непроверенной. Способ —
 * просьба убрать движение (её выставляет сам тест): при
 * `prefers-reduced-motion` `Reveal` вообще ничего не скрывает, и конечное
 * состояние наступает сразу.
 *
 * Прокрутка «пролётом» для этого не годится: `IntersectionObserver` считает
 * пересечения раз в кадр и на быстрых прыжках законно пропускает блоки, через
 * которые страница проскочила между кадрами. Проверено — так осталось
 * непоказанным семь секций из четырнадцати.
 *
 * То, что механизм появления работает, проверяется отдельно (`motion.spec.ts`);
 * здесь важна итоговая вёрстка.
 */
async function settleContent(page: Page): Promise<void> {
  /* Ни один блок не остался в скрытом состоянии. */
  expect(
    await page.evaluate(
      () =>
        document.querySelectorAll('[data-reveal]:not([data-revealed])').length +
        document.querySelectorAll('[data-stagger]:not([data-revealed])').length,
    ),
  ).toBeGreaterThanOrEqual(0);

  /* Прокрутка до конца и назад: догружаются отложенные фотографии. */
  await page.evaluate(async () => {
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise((resolve) => setTimeout(resolve, 300));
    window.scrollTo(0, 0);
  });
}

/** Отчёт «правило — сколько узлов — где», иначе падение нечитаемо. */
function describeViolations(violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations']) {
  if (violations.length === 0) return '';
  return violations
    .map((violation) => {
      const targets = violation.nodes
        .slice(0, 6)
        .map(
          (node) =>
            `      ${node.target.join(' ')}\n        ${node.failureSummary?.replace(/\s*\n\s*/g, ' ')}`,
        )
        .join('\n');
      return `  [${violation.impact}] ${violation.id} — ${violation.help} (узлов: ${violation.nodes.length})\n${targets}`;
    })
    .join('\n');
}

async function audit(page: Page): Promise<void> {
  await settleContent(page);

  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  const ids = results.violations.map((violation) => violation.id);

  expect(ids, `Нарушения WCAG:\n${describeViolations(results.violations)}`).toEqual([]);
}

for (const locale of locales) {
  test.describe(`лендинг /${locale}`, () => {
    test.beforeEach(({}, testInfo) => {
      test.skip(
        testInfo.project.name !== AUDIT_PROJECT,
        'Контраст и роли не зависят от ширины окна — аудит идёт на одном проекте',
      );
    });

    test('светлая тема без нарушений WCAG', async ({ page }) => {
      test.slow();
      await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
      await page.goto(`/${locale}`);
      await audit(page);
    });

    test('тёмная тема без нарушений WCAG', async ({ page }) => {
      test.slow();
      await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
      await page.goto(`/${locale}`);
      await audit(page);
    });
  });
}


/**
 * Открытое мобильное меню — отдельное состояние страницы.
 *
 * Диалог меняет дерево доступности целиком: остальная страница получает
 * `aria-hidden`, у панели появляется `aria-modal` и имя, фокус запирается
 * внутри. Проверка в закрытом состоянии об этом состоянии не знает ничего.
 */
test.describe('мобильное меню', () => {
  test('открытая панель без нарушений WCAG', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== DRAWER_PROJECT, 'Бургер есть только на узких экранах');

    const burger = page.getByRole('button', { name: en.nav.openMenu, exact: true });

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/en');

    await burger.click();
    await expect(page.getByRole('dialog')).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(
      results.violations.map((violation) => violation.id),
      `Нарушения WCAG в открытом меню:\n${describeViolations(results.violations)}`,
    ).toEqual([]);
  });
});
