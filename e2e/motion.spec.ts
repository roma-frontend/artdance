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
import { motion } from '../src/design/motion';

const HOME = '/en';

/** Заголовок секции «Discover» — первый блок с появлением ниже первого экрана. */
const revealTarget = (page: Page): Locator =>
  page.getByRole('heading', { name: en.home.discover.title });

const firstRevealContainer = (page: Page): Locator => page.locator('[data-reveal="up"]').first();
const firstStagger = (page: Page): Locator => page.locator('[data-stagger]').first();

test.describe('Reveal — появление при прокрутке', () => {
  test('секция ниже первого экрана скрыта до прокрутки и появляется после', async ({ page }) => {
    await page.goto(HOME);

    const container = firstRevealContainer(page);
    /* Скрытое состояние ставится CSS, а не разметкой: атрибута готовности ещё нет. */
    await expect(container).not.toHaveAttribute('data-revealed', '');
    await expect(container).toHaveCSS('opacity', '0');

    await revealTarget(page).scrollIntoViewIfNeeded();

    await expect(container).toHaveAttribute('data-revealed', '');
    await expect(container).toHaveCSS('opacity', '1');
    await expect(revealTarget(page)).toBeVisible();
  });

  test('появление однократное: обратная прокрутка не скрывает блок', async ({ page }) => {
    await page.goto(HOME);
    await revealTarget(page).scrollIntoViewIfNeeded();
    await expect(firstRevealContainer(page)).toHaveAttribute('data-revealed', '');

    await page.evaluate(() => window.scrollTo({ top: 0 }));
    await expect(firstRevealContainer(page)).toHaveAttribute('data-revealed', '');
  });

  test('дети stagger получают возрастающие задержки', async ({ page }) => {
    await page.goto(HOME);

    const container = firstStagger(page);
    await container.scrollIntoViewIfNeeded();
    await expect(container).toHaveAttribute('data-revealed', '');

    const delays = await container
      .locator('> *')
      .evaluateAll((nodes) =>
        nodes.map((node) => Number.parseFloat(getComputedStyle(node).transitionDelay)),
      );

    expect(delays.length).toBeGreaterThan(1);
    const expectedStep = motion.stagger.stepMs / 1000;
    for (let index = 1; index < Math.min(delays.length, motion.stagger.maxChildren); index += 1) {
      expect(delays[index]! - delays[index - 1]!).toBeCloseTo(expectedStep, 3);
    }
    expect(delays[0]).toBeCloseTo(motion.stagger.baseDelayMs / 1000, 3);
  });
});

test.describe('Reveal — контент не зависит от эффекта', () => {
  test.describe('без JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    test('секции видны: наблюдателя нет, значит и скрывать нельзя', async ({ page }) => {
      await page.goto(HOME);

      await expect(firstRevealContainer(page)).toHaveCSS('opacity', '1');
      /* Поиск по тегу: без JS движок ARIA-ролей в странице не работает. */
      await expect(page.locator('h2').filter({ hasText: en.home.discover.title })).toBeVisible();
      await expect(firstStagger(page).locator('> *').first()).toHaveCSS('opacity', '1');
      await expect(firstStagger(page).locator('> *').first()).toBeVisible();
    });
  });

  test('при просьбе убрать движение блоки сразу в конечном состоянии', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(HOME);

    /* Ни прокрутки, ни атрибута готовности — и всё равно всё видно. */
    await expect(firstRevealContainer(page)).not.toHaveAttribute('data-revealed', '');
    await expect(firstRevealContainer(page)).toHaveCSS('opacity', '1');
    await expect(firstStagger(page).locator('> *').first()).toHaveCSS('opacity', '1');
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
     */
    expect(properties).toContain('translate');
    expect(properties).toContain('box-shadow');
    expect(properties).toContain('border-color');

    expect(durations.length).toBe(properties.length);
    for (const duration of durations) {
      expect(duration).toBeCloseTo(expectedSeconds, 2);
    }
  });

  test('приближение фотографии анимируется во всех карточках', async ({ page }) => {
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
     */
    const finePointer = await page.evaluate(() => window.matchMedia('(hover: hover)').matches);
    test.skip(!finePointer, 'На touch-устройстве наведения нет');

    /*
     * Именно карточка каталога, а не любой `.card-surface`: плитка направления в
     * секции discover тоже носит этот класс, но в макете она НЕ поднимается —
     * у `.cat` при наведении меняется только фотография (`scale` + `filter`).
     * Класс на ней нужен ради плавной смены цвета границы.
     */
    const cards = page.locator('article.card-surface');
    expect(await cards.count()).toBeGreaterThan(0);

    const card = cards.first();
    await card.scrollIntoViewIfNeeded();

    const translateBefore = await card.evaluate((node) => getComputedStyle(node).translate);
    await card.hover();

    /*
     * Значение `translate` меняется — значит, подъём вообще происходит. Плавность
     * обеспечена предыдущей проверкой: свойство перечислено в переходе с нужной
     * длительностью.
     */
    await expect
      .poll(() => card.evaluate((node) => getComputedStyle(node).translate))
      .not.toBe(translateBefore);
  });

  test('при просьбе убрать движение отклик остаётся, а подъём уходит', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(HOME);

    const card = page.locator('article.card-surface').first();
    await card.scrollIntoViewIfNeeded();

    /*
     * Переход не обнуляется: мгновенная смена цвета читается как неисправность.
     * Убирается именно движение — подъём карточки.
     */
    const durations = await card.evaluate((node) =>
      getComputedStyle(node)
        .transitionDuration.split(',')
        .map((value) => Number.parseFloat(value)),
    );
    for (const duration of durations) {
      expect(duration).toBeGreaterThan(0);
    }

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
