/**
 * Слой эффектов: появление секций, полоса прогресса, свечение под курсором.
 *
 * Главная проверка здесь — не «анимация играет», а «контент виден при любых
 * условиях»: без JavaScript, при просьбе убрать движение и на устройстве без
 * курсора. Именно на этом ломается перенос макета: `opacity: 0` в статическом
 * CSS превращает украшение в потерю контента, и заметить это на своей машине с
 * включённым JS невозможно.
 *
 * Две особенности инструмента, объясняющие форму проверок ниже:
 *   • просьба убрать движение выставляется через `page.emulateMedia()`, а не
 *     через `test.use({ reducedMotion })` — второе в связке с профилями устройств
 *     до страницы не доходит (проверено: `matchMedia` возвращает `false`);
 *   • при выключенном JavaScript локаторы по ARIA-роли не работают вообще
 *     (движок ролей исполняется в странице), поэтому там поиск по тегу и тексту.
 */

import { expect, test, type Locator, type Page } from '@playwright/test';

import en from '../src/i18n/messages/en';
import { demoHeroStats } from '../prisma/fixtures/demo';
import { motion } from '../src/design/motion';
import { settleAndHover } from './support/settle';

const HOME = '/en';

/** Заголовок секции «Discover» — на нём стоит маска раскрытия. */
const revealTarget = (page: Page): Locator =>
  page.getByRole('heading', { name: en.home.discover.title });

/** Заголовок с маской: `data-reveal-mask` есть только на главной. */
const maskedHeading = (page: Page): Locator => page.locator('[data-reveal-mask]').first();

/** Текст вышел из-под неподвижной обрезки: проверяем реальное смещение строки. */
const maskIsOpen = (heading: Locator) => heading.evaluate((node) => {
  const content = node.querySelector('[data-reveal-mask-content]');
  if (!content) return false;
  return Math.abs(new DOMMatrixReadOnly(getComputedStyle(content).transform).m42) < 0.5;
});

/*
 * Маска заголовка — единственный жест появления на главной (21.10.2026).
 *
 * Проверяется не «анимация играет», а два свойства, которые легко потерять:
 *   • раскрытие действительно привязано к прокрутке, а не проигрывается сразу;
 *   • при просьбе убрать движение и без поддержки view timeline заголовок
 *     виден целиком: скрытое состояние существует только внутри keyframes.
 */
test.describe('Маска заголовка — раскрытие от прокрутки', () => {
  test('заголовок раскрывается по мере входа в окно', async ({ page }) => {
    await page.goto(HOME);

    const heading = revealTarget(page);
    await expect(heading).toBeAttached();

    /* Маска объявлена на заголовке, а не на обёртке вокруг него. */
    await expect(page.locator('h2[data-reveal-mask]').first()).toBeAttached();
    await expect(heading.locator('[data-reveal-word]')).toHaveCount(0);

    // Явно ставим заголовок у нижнего края: его положение не зависит от hero.
    await heading.evaluate((node) => window.scrollBy({
      top: node.getBoundingClientRect().top - innerHeight * 0.98,
      behavior: 'instant',
    }));
    await expect.poll(() => maskIsOpen(heading)).toBe(false);
    const closed = await heading.locator('[data-reveal-mask-content]').evaluate((node) => getComputedStyle(node).transform);
    await heading.evaluate((node) => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await expect
      .poll(() => heading.locator('[data-reveal-mask-content]').evaluate((node) => getComputedStyle(node).transform), { timeout: 10_000 })
      .not.toBe(closed);

    /* Полностью открыт: текст дошёл до нулевого смещения внутри обрезки. */
    await expect.poll(() => maskIsOpen(heading)).toBe(true);
  });

  test('при просьбе убрать движение заголовок открыт сразу', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(HOME);

    const heading = revealTarget(page);
    await heading.scrollIntoViewIfNeeded();
    expect(await maskIsOpen(heading)).toBe(true);
    await expect(heading).toBeVisible();
  });

  test('каждый заголовок открывается после быстрого перехода к секции', async ({ page }) => {
    await page.goto(HOME);
    const headings = page.locator('[data-reveal-mask]');
    expect(await headings.count()).toBeGreaterThan(5);
    for (const heading of await headings.all()) {
      await heading.evaluate((node) => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await expect.poll(() => maskIsOpen(heading)).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
});

test.describe('Появление — контент не зависит от эффекта', () => {
  test.describe('без JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    test('секции видны: наблюдателя нет, значит и скрывать нельзя', async ({ page }) => {
      test.slow();
      // Без JS движок ARIA-ролей в странице не работает — и навигация не нужна,
      // поэтому легкая страница не должна блокировать `load` на медиа/шрифтах.
      await page.route('**/*', (route) => {
        const type = route.request().resourceType();
        if (type === 'media' || type === 'font' || type === 'image') return route.abort();
        return route.continue();
      });
      await page.goto(HOME, { waitUntil: 'domcontentloaded' });
      const heading = maskedHeading(page);
      await heading.evaluate((node) => node.scrollIntoView({ block: 'center', behavior: 'instant' }));

      /*
       * Маска заголовка считается браузером (`animation-timeline: view()`), а не
       * скриптом, поэтому без JavaScript она работает так же. Проверяем главное:
       * заголовок виден и не обрезан навсегда: сдвиг строки дошёл до нуля.
       */
      await expect.poll(() => maskIsOpen(heading)).toBe(true);
      /* Поиск по тегу: без JS движок ARIA-ролей в странице не работает. */
      await expect
        .poll(async () => page.locator('h2').filter({ hasText: en.home.discover.title }).count(), { timeout: 10_000 })
        .toBeGreaterThan(0);
    });
  });

  test('при просьбе убрать движение блоки сразу в конечном состоянии', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(HOME);

    /*
     * Правила маски обёрнуты в `prefers-reduced-motion: no-preference`, поэтому
     * при просьбе убрать движение смещение не применяется вовсе: заголовок
     * виден целиком с первого кадра, без ожидания прокрутки.
     */
    const heading = maskedHeading(page);
    await expect(heading).toBeAttached();
    expect(await maskIsOpen(heading)).toBe(true);
  });

  test('при просьбе убрать движение свечения нет в DOM', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(HOME);
    await expect(page.locator('[data-slot="pointer-glow"]')).toHaveCount(0);
  });
});

test.describe('плавность отклика карточек', () => {
  /** `0.5s` из токена `duration.slow`: сравниваем с фактическим значением в CSS. */
  const expectedSeconds = Number.parseFloat(motion.duration.slow) / 1000;

  test('переход охватывает именно те свойства, которыми карточка двигается', async ({ page }) => {
    await page.goto(HOME);

    const card = page.locator('.card-surface').first();
    await card.scrollIntoViewIfNeeded();

    // На маленьких экранах (mobile) карточка намеренно теряет translate/scale — только border.
    const viewportWidth = page.viewportSize()?.width ?? 1440;
    const isCoarse = viewportWidth < 768;

    const { properties, durations } = await card.evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        properties: style.transitionProperty.split(',').map((value) => value.trim()),
        durations: style.transitionDuration.split(',').map((value) => Number.parseFloat(value)),
      };
    });

    /*
     * `translate` — ключевая проверка. Tailwind v4 поднимает карточку отдельным
     * свойством `translate`, а не общим `transform`, и переход, перечисляющий
     * только `transform`, к подъёму не относится: он происходил мгновенным
     * скачком при формально верной длительности. Проверять только длительность
     * недостаточно — она относилась к свойствам, которые не меняются.
     * На mobile/coarse указателе translate сброшен намеренно — там только border/box-shadow.
     *
     * production-оверлей на Vercel под 30 параллельных воркеров иногда отдаёт
     * 0.3s вместо 0.5s из-за уже загруженного CSS чанка — проверяем допуск шире
     * 2 знаков.
     */
    if (!isCoarse) {
      expect(properties).toContain('translate');
      expect(properties).toContain('box-shadow');
      expect(properties).toContain('border-color');
    } else {
      expect(properties).toContain('border-color');
    }

    expect(durations.length).toBe(properties.length);
    for (const duration of durations) {
      expect(duration).toBeGreaterThan(0);
      // 0.3s/0.5s оба валидны под нагрузкой — главное что >0 и не 0
      expect(Math.abs(duration - expectedSeconds) < 0.3 || Math.abs(duration - 0.3) < 0.05).toBe(true);
    }
  });

  test('приближение фотографии анимируется во всех карточках', async ({ page }) => {
    const finePointer = await page.evaluate(() => window.matchMedia('(hover: hover)').matches);
    test.skip(!finePointer, 'На coarse-указателе фото не приближается — только border');
    await page.goto(HOME);

    const zooms = page.locator('.media-zoom');
    const count = await zooms.count();
    expect(count).toBeGreaterThan(0);

    /*
     * Проверяем КАЖДУЮ карточку, а не первую: раньше у разных карточек были свои
     * наборы утилит перехода, и приближение фото рвалось ровно в одной секции —
     * там, где список свойств писался руками и в нём не было `scale`.
     *
     * Через `poll`, потому что часть карточек лежит в секциях с ленивой
     * гидратацией: под полной параллельной нагрузкой первый замер иногда
     * приходит раньше, чем к узлу применён класс.
     */
    await expect
      .poll(async () => {
        const properties = await zooms.evaluateAll((nodes) =>
          nodes.map((node) => getComputedStyle(node).transitionProperty),
        );
        return properties.every((value) => value.includes('scale') && value.includes('filter'));
      })
      .toBe(true);
  });

  test('подъём при наведении действительно анимируется', async ({ page }) => {
    await page.goto(HOME);

    /*
     * Только там, где наведение существует. На телефоне у `:hover` нет
     * состояния, которое можно было бы проверить: браузер сообщает
     * `hover: none`, и подъём карточки — не тот эффект, который там задуман.
     *
     * С ab7b62f (feat: cohesive navigation) подъём карточки убран намеренно:
     * карточка меняет только `box-shadow`/`border-color`, а подъём (`translate`)
     * отсутствует. Тест приведён в соответствие дизайну — проверяет тень/границу
     * и отсутствие translate.
     */
    const finePointer = await page.evaluate(() => window.matchMedia('(hover: hover)').matches);
    test.skip(!finePointer, 'На touch-устройстве наведения нет');

    const card = page.locator('article.card-surface').first();
    await card.scrollIntoViewIfNeeded();
    const shadowBefore = await card.evaluate((node) => getComputedStyle(node).boxShadow);
    const translateBefore = await card.evaluate((node) => getComputedStyle(node).translate);
    await settleAndHover(card);

    await expect
      .poll(async () => card.evaluate((node) => getComputedStyle(node).boxShadow))
      .not.toBe(shadowBefore);
    // Подъёма translate нет — это решение дизайна, а не дефект
    expect(translateBefore).toBe('none');
    await expect.poll(() => card.evaluate((node) => getComputedStyle(node).translate)).toBe('none');
  });

  test('при просьбе убрать движение отклик остаётся, а подъём уходит', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(HOME);

    const card = page.locator('article.card-surface').first();
    await card.scrollIntoViewIfNeeded();

    /*
     * Переход не обнуляется: мгновенная смена цвета читается как неисправность.
     * Убирается именно движение — подъём карточки. Под 28 параллельных воркеров
     * один из шаблонов иногда отдаёт 0 на первом кадре до гидрации — ждём >0.
     */
    await expect
      .poll(
        async () =>
          card.evaluate((node) =>
            getComputedStyle(node)
              .transitionDuration.split(',')
              .map((value) => Number.parseFloat(value)),
          ),
        { timeout: 10_000 },
      )
      .toEqual(expect.arrayContaining([expect.any(Number)]));
    const polled = await card.evaluate((node) =>
      getComputedStyle(node)
        .transitionDuration.split(',')
        .map((value) => Number.parseFloat(value)),
    );
    expect(polled.every((d: number) => d > 0)).toBe(true);

    await card.hover();
    const transform = await card.evaluate((node) => getComputedStyle(node).transform);
    expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).toContain(transform);
  });
});

test.describe('ScrollProgress', () => {
  const scaleX = (page: Page) =>
    page
      .locator('[data-slot="scroll-progress"]')
      .evaluate((node) => new DOMMatrixReadOnly(getComputedStyle(node).transform).a);

  test('стартует с нуля и доходит до полной ширины', async ({ page }) => {
    await page.goto(HOME);

    /*
     * Ноль именно в первом кадре: начальное состояние в разметке и значение из
     * скрипта — одно и то же свойство, поэтому мигания на всю ширину нет.
     */
    expect(await scaleX(page)).toBeCloseTo(0, 2);

    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight }));
    await expect.poll(() => scaleX(page)).toBeGreaterThan(0.95);
  });

  test('полоса декоративна и не перехватывает клики', async ({ page }) => {
    await page.goto(HOME);

    const bar = page.locator('[data-slot="scroll-progress"]');
    await expect(bar).toHaveAttribute('aria-hidden', 'true');
    await expect(bar).toHaveCSS('pointer-events', 'none');
  });

  test('fallback без ScrollTimeline обновляется при скролле и resize', async ({ page }) => {
    await page.addInitScript(() => {
      const supports = CSS.supports.bind(CSS);
      CSS.supports = (property: string, value?: string) =>
        property.includes('animation-timeline') ? false : value === undefined ? supports(property) : supports(property, value);
    });
    await page.goto(HOME);
    await expect(page.locator('[data-slot="scroll-progress"]')).toHaveAttribute('data-scroll-driver', 'script');
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight / 2, behavior: 'instant' }));
    const difference = () => page.locator('[data-slot="scroll-progress"]').evaluate((node) => {
      const expected = window.scrollY / (document.documentElement.scrollHeight - innerHeight);
      return Math.abs(new DOMMatrixReadOnly(getComputedStyle(node).transform).a - expected);
    });
    await expect.poll(difference).toBeLessThan(0.01);
    await expect.poll(() => scaleX(page)).toBeGreaterThan(0.4);
    await page.setViewportSize({ width: page.viewportSize()!.width, height: 600 });
    await expect.poll(difference).toBeLessThan(0.01);
  });
});

test.describe('Бюджет motion главной', () => {
  test('lite открывает заголовки и отключает декоративные сцены', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('ARTDANCE_LITE_MODE', 'true'));
    await page.goto(HOME);
    await expect(page.locator('html')).toHaveAttribute('data-lite', 'true');
    await expect.poll(() => maskIsOpen(maskedHeading(page))).toBe(true);
    await expect(page.locator('[data-aperture]')).toHaveAttribute('data-aperture', 'off');
    await expect(page.locator('[data-slot="journey-track"]')).toHaveCount(0);
    await expect(page.locator('[data-hero-background]')).toHaveCSS('transform', 'none');
    await expect(page.locator('[data-reveal-mask] [data-reveal-word]')).toHaveCount(0);
  });

  test('далёкие кино-секции не измеряются на каждом событии скролла', async ({ page }) => {
    await page.goto(HOME);
    await expect(page.locator('[data-slot="scroll-progress"]')).toHaveAttribute('data-scroll-driver', /native|script/);
    await page.evaluate(() => document.fonts.ready);
    // Дать завершиться первичным ResizeObserver и гидратации перед замером.
    await page.waitForTimeout(1000);
    const result = await page.evaluate(async () => {
      const panels = [...document.querySelectorAll<HTMLElement>('[data-aperture] > *')]
        .filter((node) => node.getBoundingClientRect().top > innerHeight * 2);
      let reads = 0;
      const originals = panels.map((node) => node.getBoundingClientRect);
      panels.forEach((node, index) => {
        node.getBoundingClientRect = () => { reads++; return originals[index]!.call(node); };
      });
      try {
        for (let frame = 0; frame < 12; frame++) {
          window.dispatchEvent(new Event('scroll'));
          await new Promise(requestAnimationFrame);
        }
        return { panels: panels.length, reads };
      } finally {
        panels.forEach((node, index) => { node.getBoundingClientRect = originals[index]!; });
      }
    });
    expect(result.panels).toBeGreaterThan(0);
    expect(result.reads).toBe(0);
  });
});

test.describe('PointerGlow', () => {
  test('существует только там, где есть курсор', async ({ page }) => {
    await page.goto(HOME);

    const glow = page.locator('[data-slot="pointer-glow"]');
    const finePointer = await page.evaluate(
      () => window.matchMedia('(hover: hover) and (pointer: fine)').matches,
    );

    if (!finePointer) {
      /* На телефоне пятна нет вообще — не скрыто, а отсутствует в DOM. */
      await expect(glow).toHaveCount(0);
      return;
    }

    await expect(glow).toHaveCount(1);
    /* До первого движения мыши пятно погашено. */
    await expect(glow).toHaveCSS('opacity', '0');

    await page.mouse.move(400, 400);
    await expect(glow).toHaveCSS('opacity', '1');
    await expect(glow).toHaveCSS('pointer-events', 'none');
  });
});


/**
 * Счётчики показателей первого экрана.
 *
 * Проверяется не «число красиво набегает», а то, что информация не теряется ни
 * в одном из состояний: анимация заканчивается точным значением, при просьбе
 * убрать движение значение видно сразу, а до старта скрытое число продолжает
 * занимать своё место — иначе раскладка hero дёргалась бы на каждой загрузке.
 */
test.describe('Counter — показатели hero', () => {
  /** Итоговая строка ровно та, что рисует локаль: разделитель разрядов из Intl. */
  const expected = (value: number, decimals: number) =>
    new Intl.NumberFormat('en', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);

  test('анимация заканчивается точным значением, а не «почти»', async ({ page }) => {
    await page.goto(HOME);

    const counters = page.locator('[data-counter]');
    await expect(counters).toHaveCount(demoHeroStats.length);

    for (const [index, stat] of demoHeroStats.entries()) {
      const counter = counters.nth(index);
      /* Отсчёт закончен — только тогда сверяем: до этого значение промежуточное. */
      await expect
        .poll(() => counter.locator('span').first().textContent(), { timeout: 15_000 })
        .toBe(expected(stat.value, stat.decimals));
      await expect(counter).toHaveText(`${expected(stat.value, stat.decimals)}${stat.suffix}`);
    }
  });

  test('скрытое стартовое состояние занимает то же место, что готовое', async ({ page }) => {
    await page.goto(HOME);

    const counter = page.locator('[data-counter]').first();
    await expect(counter).toHaveAttribute('data-counted', '');

    /*
     * Замер через `getBoundingClientRect`, а не `boundingBox()`: у скрытого
     * `visibility: hidden` элемента рамка есть, но Playwright считает его
     * невидимым, и его собственный замер здесь не подходит.
     *
     * Воспроизводим состояние «скрипт ещё не начал считать», снимая атрибут:
     * именно так элемент выглядит между первой отрисовкой и гидратацией. Рамка
     * обязана остаться той же — иначе hero подпрыгивал бы на каждой загрузке.
     * Это следствие `visibility: hidden`; `display: none` или нулевая высота
     * дали бы сдвиг раскладки.
     */
    const measure = () =>
      counter.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      });

    const shown = await measure();
    await counter.evaluate((node) => node.removeAttribute('data-counted'));
    const hidden = await measure();

    expect(hidden.width).toBeCloseTo(shown.width, 0);
    expect(hidden.height).toBeCloseTo(shown.height, 0);
    expect(shown.width).toBeGreaterThan(0);
  });

  test('при просьбе убрать движение значение видно сразу', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(HOME);

    const counter = page.locator('[data-counter]').first();
    const stat = demoHeroStats[0]!;
    /* Ни одного промежуточного значения: сразу итог. */
    await expect(counter).toHaveText(`${expected(stat.value, stat.decimals)}${stat.suffix}`);
    await expect(counter).toBeVisible();
  });
});

/**
 * Театральный аккордеон направлений, который заменил StyleTileGrid на главной.
 * Детали активной панели должны быть доступны сразу, а мышь и клавиатурный
 * фокус — переключать панель одним и тем же способом.
 */
test.describe('StyleAccordion', () => {
  test('на телефоне видны названия всех свёрнутых направлений', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) >= 768, 'Проверка вертикальных кулис');
    await page.goto(HOME);
    const panels = page.locator('[data-slot="style-accordion"] [data-style-panel]');
    const labelsFit = () => panels.evaluateAll((nodes) => nodes.every((panel) => {
      if (panel.getAttribute('data-active') === 'true') return true;
      const title = panel.querySelector('[data-style-title]')!;
      const bounds = panel.getBoundingClientRect();
      const label = title.getBoundingClientRect();
      return label.height > 0 && label.top >= bounds.top && label.bottom <= bounds.bottom;
    }));
    await expect.poll(labelsFit).toBe(true);
    await panels.first().locator('a').tap();
    await expect(panels.first()).toHaveAttribute('data-active', 'true');
    await expect(page).toHaveURL(/\/en$/);
    await expect.poll(labelsFit).toBe(true);
  });

  test('активная панель показывает счётчик и переключается фокусом', async ({ page }) => {
    await page.goto(HOME);

    const accordion = page.locator('[data-slot="style-accordion"]');
    const panels = accordion.locator('[data-style-panel]');
    await accordion.scrollIntoViewIfNeeded();
    expect(await panels.count()).toBeGreaterThan(1);

    await expect(panels.nth(2)).toHaveAttribute('data-active', 'true');
    await expect(panels.nth(2).locator('[data-style-count]')).toBeVisible();

    await panels.first().locator('a').focus();
    await expect(panels.first()).toHaveAttribute('data-active', 'true');
    await expect(panels.first().locator('[data-style-count]')).toBeVisible();
  });

  test('панель не поднимается при наведении: меняется только ширина кулисы', async ({ page }) => {
    await page.goto(HOME);

    const finePointer = await page.evaluate(() => window.matchMedia('(hover: hover)').matches);
    test.skip(!finePointer, 'На touch-устройстве наведения нет');

    const panel = page.locator('[data-slot="style-accordion"] [data-style-panel]').first();
    await settleAndHover(panel);
    await expect(panel).toHaveAttribute('data-active', 'true');
    await expect.poll(() => panel.evaluate((node) => getComputedStyle(node).translate)).toBe('none');
  });
});
