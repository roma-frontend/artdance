/**
 * Карточки каталога и лента занятий.
 *
 * Проверяется то, что отличает карточку от картинки: она открывается кликом и с
 * клавиатуры, её ссылка имеет осмысленное имя, а лента прокручивается всеми
 * доступными способами и честно гасит кнопки на краях.
 */

import { expect, test, type Locator, type Page } from '@playwright/test';

import en from '../src/i18n/messages/en';
import { demoClasses, demoInstructors, demoVenues } from '../prisma/fixtures/demo';
import { commerce } from '../src/config/business';
import { carouselScroll } from '../src/design/motion';
import { settleAndHover } from './support/settle';

const { edgeTolerancePx, minHiddenStepRatio } = carouselScroll;

const HOME = '/en';

const carousel = (page: Page): Locator => page.getByRole('group', { name: en.home.popular.title });
const firstClass = demoClasses.find((item) => item.isTrending) ?? demoClasses[0]!;

test.describe('ClassCard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HOME);
  });

  test('ссылка карточки названа занятием, а не всем текстом блока', async ({ page }) => {
    const link = carousel(page).getByRole('link', { name: firstClass.title, exact: true });
    await expect(link).toHaveCount(1);
    await expect(link).toHaveAttribute('href', `/en/classes/${firstClass.slug}`);
  });

  /*
   * Запас по времени на переход. Раздел занятий появится волной booking, поэтому
   * сейчас ссылка ведёт на страницу, которой нет: Next отдаёт её через путь 404,
   * и под полной параллельной нагрузкой это не укладывается в дефолтные 5 секунд.
   * Проверяется при этом ровно то, что нужно — карточка ведёт куда обещала.
   */
  const NAVIGATION_TIMEOUT = 15_000;

  test('карточка открывается кликом по любому месту', async ({ page }) => {
    const card = carousel(page).locator('li').first();
    /* Клик по подписи, а не по ссылке: за это отвечает растянутый псевдоэлемент. */
    await card.getByText(firstClass.title).click();
    await expect(page).toHaveURL(new RegExp(`/en/classes/${firstClass.slug}$`), {
      timeout: NAVIGATION_TIMEOUT,
    });
  });

  test('карточка достижима с клавиатуры', async ({ page }) => {
    const link = carousel(page).getByRole('link', { name: firstClass.title, exact: true });
    await link.focus();
    await expect(link).toBeFocused();
    await link.press('Enter');
    await expect(page).toHaveURL(new RegExp(`/en/classes/${firstClass.slug}$`), {
      timeout: NAVIGATION_TIMEOUT,
    });
  });

  test('бейджи «в тренде» и «мест нет» не показываются вместе', async ({ page }) => {
    const cards = carousel(page).locator('li');
    const count = await cards.count();

    for (let index = 0; index < count; index += 1) {
      const card = cards.nth(index);
      const trending = await card.getByText(en.classDetail.trendingBadge, { exact: true }).count();
      const full = await card.getByText(en.classDetail.fullBadge, { exact: true }).count();
      expect(trending + full).toBeLessThanOrEqual(1);
    }
  });

  test('счётчик мест называет количество словами, а не только цветом', async ({ page }) => {
    const card = carousel(page).locator('li').first();
    const expected =
      firstClass.spotsLeft <= commerce.lowStockThreshold
        ? `${firstClass.spotsLeft} spot`
        : `${firstClass.spotsLeft} spots left`;

    await expect(card.getByText(new RegExp(expected))).toBeVisible();
  });
});

test.describe('ClassCarousel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HOME);
    await carousel(page).scrollIntoViewIfNeeded();
  });

  test('лента названа и фокусируема — прокрутка с клавиатуры возможна', async ({ page }) => {
    const list = carousel(page);
    await expect(list).toHaveAttribute('tabindex', '0');

    await list.focus();
    await expect(list).toBeFocused();
  });

  test('кнопки появляются только когда скрыто заметное количество контента', async ({ page }) => {
    const list = carousel(page);
    const next = page.getByRole('button', { name: en.a11y.carouselNext });

    const { maxScroll, step } = await list.evaluate((node) => {
      const first = node.firstElementChild as HTMLElement | null;
      const gap = Number.parseFloat(window.getComputedStyle(node).columnGap) || 0;
      return {
        maxScroll: node.scrollWidth - node.clientWidth,
        step: (first?.offsetWidth ?? 0) + gap,
      };
    });

    /*
     * Порог тот же, что в компоненте: лента, обрезанная на пару десятков
     * пикселей, не должна получать две кнопки, которые почти ничего не делают.
     */
    const shouldShow = maxScroll > Math.max(edgeTolerancePx, step * minHiddenStepRatio);
    await expect(next).toHaveCount(shouldShow ? 1 : 0);
  });

  test('кнопка «назад» погашена в начале и оживает после прокрутки', async ({ page }) => {
    const previous = page.getByRole('button', { name: en.a11y.carouselPrevious });
    const next = page.getByRole('button', { name: en.a11y.carouselNext });

    /* Кнопки существуют только если лента шире контейнера. */
    if ((await next.count()) === 0) {
      test.skip(true, 'Лента целиком видна — кнопки не нужны');
      return;
    }

    await expect(previous).toBeDisabled();
    await expect(next).toBeEnabled();

    await next.click();
    await expect(previous).toBeEnabled();
  });

  test('кнопки управляют именно лентой (aria-controls)', async ({ page }) => {
    const next = page.getByRole('button', { name: en.a11y.carouselNext });
    if ((await next.count()) === 0) {
      test.skip(true, 'Лента целиком видна — кнопки не нужны');
      return;
    }

    const controls = await next.getAttribute('aria-controls');
    expect(controls).toBeTruthy();
    await expect(carousel(page)).toHaveAttribute('id', controls!);
  });

  test('шаг прокрутки равен ширине карточки', async ({ page }) => {
    const next = page.getByRole('button', { name: en.a11y.carouselNext });
    if ((await next.count()) === 0) {
      test.skip(true, 'Лента целиком видна — кнопки не нужны');
      return;
    }

    const list = carousel(page);
    const cardWidth = await list
      .locator('li')
      .first()
      .evaluate((node) => node.getBoundingClientRect().width);

    await next.click();
    /* Плавная прокрутка: ждём, пока положение перестанет меняться. */
    await expect
      .poll(() => list.evaluate((node) => node.scrollLeft), { timeout: 5000 })
      .toBeGreaterThan(cardWidth * 0.8);
  });
});

test.describe('InstructorCard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HOME);
  });

  test('верификация имеет текстовую альтернативу, а не только значок', async ({ page }) => {
    const verified = demoInstructors.find((item) => item.isVerified)!;
    const card = page
      .getByRole('link', { name: verified.name, exact: true })
      .locator('xpath=ancestor::article');

    await expect(card.getByText(en.instructor.verifiedBadge)).toHaveCount(1);
  });

  test('цена инструктора подписана как «от» и за час', async ({ page }) => {
    const first = demoInstructors[0]!;
    const card = page
      .getByRole('link', { name: first.name, exact: true })
      .locator('xpath=ancestor::article');

    await expect(card.getByText(en.common.labels.from, { exact: true })).toBeVisible();
    await expect(card.getByText(en.common.labels.perHour, { exact: true })).toBeVisible();
  });
});

test.describe('VenueCard', () => {
  test('оснащение сокращается до трёх метк и «ещё N»', async ({ page }) => {
    await page.goto(HOME);

    const venue = demoVenues.find((item) => item.amenities.length > 3)!;
    const card = page
      .getByRole('link', { name: venue.name, exact: true })
      .locator('xpath=ancestor::article');

    const badges = card.locator('ul li');
    await expect(badges).toHaveCount(4);

    const hidden = venue.amenities.length - 3;
    await expect(card.getByText(`+${hidden} more`)).toBeVisible();
  });
});

test.describe('CardTilt', () => {
  test('наклон применяется там, где есть курсор, и сбрасывается при уходе', async ({ page }) => {
    await page.goto(HOME);

    const finePointer = await page.evaluate(
      () => window.matchMedia('(hover: hover) and (pointer: fine)').matches,
    );
    test.skip(!finePointer, 'Наклон существует только при точном указателе');

    const tilt = page.locator('[data-slot="card-tilt"]').first();

    /*
     * Ждём гидратацию: слушатель наклона появляется только после неё, а свечение
     * под курсором — надёжный признак того, что она прошла (оба эффекта включены
     * одним и тем же условием «есть точный указатель»). Без ожидания наведение
     * иногда происходит раньше подписки, и тест падает без дефекта в коде.
     */
    await expect(page.locator('[data-slot="pointer-glow"]')).toHaveCount(1);

    /*
     * `hover` с позицией, а не `mouse.move` по координатам: Playwright сам
     * доводит элемент до видимой области и проверяет, что его не перекрывает
     * фиксированная шапка. Точка смещена от центра — в центре наклон нулевой.
     */
    await settleAndHover(tilt, { xRatio: 0.85, yRatio: 0.7 });

    /*
     * Курсор шевелится между попытками. У живого пользователя `pointermove`
     * идёт потоком, и наклон подхватывается на любом из событий; синтетическое
     * наведение — это ОДНО событие, и если оно пришло в момент, когда блок ещё
     * доезжал, второго не будет. Здесь каждая попытка сама создаёт событие.
     */
    const box = (await tilt.boundingBox())!;
    const point = { x: box.x + box.width * 0.85, y: box.y + box.height * 0.7 };

    await expect
      .poll(async () => {
        await page.mouse.move(point.x, point.y + 1);
        await page.mouse.move(point.x, point.y);
        return tilt.evaluate((node) => (node as HTMLElement).style.transform);
      })
      .toContain('rotate');

    /* Курсор ушёл с карточки — наклон снимается, управление возвращается CSS. */
    await page.mouse.move(0, 0);
    await expect
      .poll(() => tilt.evaluate((node) => (node as HTMLElement).style.transform))
      .toBe('');
  });
});
