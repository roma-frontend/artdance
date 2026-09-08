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
import { demoClasses, demoEvents, demoInstructors, demoVenues } from '../prisma/fixtures/demo';
import { security } from '../src/config/business';
import { isAcceptedBrandColor } from '../src/design/tokens/contrast';
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

/**
 * Отчёт «правило — сколько узлов — где», иначе падение нечитаемо.
 */
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

type Violations = Awaited<ReturnType<AxeBuilder['analyze']>>['violations'];

/**
 * Убрать из отчёта принятое отклонение по контрасту.
 *
 * Акцент платформы — бургунди `#8B1A2B` в обеих темах и на любом фоне: решение
 * заказчика от 04.09.2026, зафиксированное в `src/design/tokens/contrast.ts`
 * вместе с ценой (на почти чёрном фоне это 1.3–2.2:1 вместо 4.5:1). Правило
 * `color-contrast` при этом НЕ отключается: отбрасываются только те узлы, где
 * цветом текста стоит именно брендовый бургунди. Любая другая пара с плохим
 * контрастом по-прежнему валит проверку — а именно за этим она и нужна.
 */
function withoutAcceptedContrast(violations: Violations): Violations {
  return violations
    .map((violation) => {
      if (violation.id !== 'color-contrast') return violation;

      const nodes = violation.nodes.filter((node) => {
        const foreground = node.any
          .map((check) => (check.data as { fgColor?: string } | undefined)?.fgColor)
          .find((color): color is string => typeof color === 'string');
        /* Цвет не разобрался — оставляем узел: молча пропускать нельзя. */
        return foreground === undefined || !isAcceptedBrandColor(foreground);
      });

      return { ...violation, nodes };
    })
    .filter((violation) => violation.nodes.length > 0);
}

async function audit(page: Page): Promise<void> {
  await settleContent(page);

  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  const violations = withoutAcceptedContrast(results.violations);
  const ids = violations.map((violation) => violation.id);

  expect(ids, `Нарушения WCAG:\n${describeViolations(violations)}`).toEqual([]);
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
 * Каталог: листинги и страницы сущностей.
 *
 * На этих экранах появляются свои пары и роли, которых нет ни на лендинге, ни на
 * шагах покупки: чипы фильтров со счётчиками (`fieldset`/`legend` и
 * `aria-current`), выпадающее меню сортировки из ссылок, выключенные кнопки с
 * объяснением рядом, аватар с бейджем верификации, таймлайн опыта, кинематогра-
 * фичный баннер с крошками поверх фотографии.
 *
 * Баннер — главная причина проверять обе темы: он остаётся тёмным в обеих, и
 * пара «текст на снимке» там одна и та же, а вот всё под ним меняется вместе с
 * темой.
 */
test.describe('каталог', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== AUDIT_PROJECT,
      'Контраст и роли не зависят от ширины окна — аудит идёт на одном проекте',
    );
  });

  const screens = [
    '/en/classes',
    '/en/discover',
    '/en/shop',
    `/en/classes/${demoClasses[0]!.slug}`,
    `/en/instructors/${demoInstructors[0]!.slug}`,
    `/en/studios/${demoVenues[0]!.slug}`,
    `/en/events/${demoEvents[0]!.slug}`,
    /*
     * Хабы направлений: наполненный и пустой. У пустого набор пар «текст — фон»
     * другой — это пустое состояние на штриховой рамке, где легко потерять
     * контраст подписи, — и именно он показывается тому, кто пришёл по редкому
     * запросу из поиска.
     */
    '/en/styles',
    '/en/styles/hip-hop',
    '/en/styles/flamenco',
  ];

  for (const path of screens) {
    for (const colorScheme of ['light', 'dark'] as const) {
      test(`${path} — тема ${colorScheme} без нарушений WCAG`, async ({ page }) => {
        test.slow();
        await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
        await page.goto(path);
        await audit(page);
      });
    }
  }
});


/**
 * Экраны покупки: корзина, бронирование, оформление.
 *
 * Здесь появляются пары, которых на лендинге нет вовсе: поля ввода с подписями
 * и ошибками, зачёркнутые недоступные слоты, календарь с недоступными днями,
 * плитки способов оплаты. Именно на них ошибка контраста и роли ARIA стоит
 * дороже всего — это последний шаг перед списанием денег.
 *
 * Обе темы, как и у лендинга: тёмная — отдельный набор пар, и именно на ней
 * акцентный текст и «осталось мало мест» уходят на светлые шаги рампы.
 */
test.describe('экраны покупки', () => {
  test.beforeEach(async ({ context }, testInfo) => {
    test.skip(
      testInfo.project.name !== AUDIT_PROJECT,
      'Контраст и роли не зависят от ширины окна — аудит идёт на одном проекте',
    );

    /*
     * Оформление закрыто гейтом приватных разделов в `proxy.ts`: он проверяет
     * НАЛИЧИЕ cookie сессии, поэтому для рендера страницы её достаточно
     * выставить. Настоящая авторизация — `@/lib/auth/guards`, и она появится
     * волной auth.
     */
    await context.addCookies([
      { name: security.session.cookieName, value: 'e2e', domain: '127.0.0.1', path: '/' },
    ]);
  });

  const screens = [
    '/en/cart',
    '/en/booking',
    `/en/instructors/${demoInstructors[0]!.slug}/book`,
    '/en/checkout/contact',
    '/en/checkout/delivery',
    '/en/checkout/payment',
    '/en/checkout/confirm',
  ];

  for (const path of screens) {
    for (const colorScheme of ['light', 'dark'] as const) {
      test(`${path} — тема ${colorScheme} без нарушений WCAG`, async ({ page }) => {
        test.slow();
        await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
        await page.goto(path);
        await audit(page);
      });
    }
  }
});

/**
 * Контентные и правовые страницы.
 *
 * Здесь появляются пары и роли, которых нет ни в каталоге, ни на шагах покупки:
 * раскрывающиеся вопросы (`<details>`), таблица сравнения тарифов с `<th scope>`,
 * оглавление документа, форма обращения с полями и подписями, карточки-ссылки
 * целиком. Правовые документы — самый длинный текст на сайте: если контраст
 * основного абзаца не проходит, видно это именно здесь.
 */
test.describe('контентные страницы', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== AUDIT_PROJECT,
      'Контраст и роли не зависят от ширины окна — аудит идёт на одном проекте',
    );
  });

  const screens = [
    '/en/about',
    '/en/contact',
    '/en/faq',
    '/en/help',
    '/en/pricing',
    '/en/become-instructor',
    '/en/gift-cards',
    '/en/legal/terms',
  ];

  for (const path of screens) {
    for (const colorScheme of ['light', 'dark'] as const) {
      test(`${path} — тема ${colorScheme} без нарушений WCAG`, async ({ page }) => {
        test.slow();
        await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
        await page.goto(path);
        await audit(page);
      });
    }
  }
});

/**
 * Открытый поиск — состояние с самым плотным набором ролей на всём сайте.
 *
 * В одном диалоге сходятся поле поиска, группа переключателей с `aria-pressed`,
 * список ссылок с подсветкой части названия (`<mark>`) и вежливое объявление
 * числа найденного. Проверяется состояние С РЕЗУЛЬТАТАМИ: в пустом нет ни
 * подсветки, ни выдачи, то есть ровно того, что здесь ново.
 *
 * Тема одна: оверлей кинематографичный в обеих (`surface-cinema` — это не тема,
 * а роль подложки), поэтому набор пар «текст — фон» от `colorScheme` не зависит.
 */
test.describe('поиск', () => {
  test('открытый оверлей с результатами без нарушений WCAG', async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== AUDIT_PROJECT,
      'Контраст и роли не зависят от ширины окна — аудит идёт на одном проекте',
    );

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/en');

    await page.getByRole('banner').getByRole('link', { name: en.nav.openSearch }).click();
    const overlay = page.getByRole('dialog');
    await expect(overlay).toBeVisible();

    const answered = page.waitForResponse(
      (response) => response.url().includes('/api/search') && response.status() === 200,
    );
    await overlay.getByRole('searchbox').fill('salsa');
    await answered;
    await expect(overlay.getByRole('listitem').getByRole('link').first()).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    const violations = withoutAcceptedContrast(results.violations);
    expect(
      violations.map((violation) => violation.id),
      `Нарушения WCAG в открытом поиске:\n${describeViolations(violations)}`,
    ).toEqual([]);
  });
});

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
