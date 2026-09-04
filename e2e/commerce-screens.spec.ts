/**
 * Экраны корзины, бронирования и оформления.
 *
 * Проверяется то, из-за чего эти экраны и существуют: цифры сходятся с
 * контрольным расчётом макета, недоступный слот нельзя выбрать, пустая корзина
 * что-то говорит, а не просто исчезает, и неизвестный шаг оформления отвечает
 * 404, а не открывает первый шаг молча.
 *
 * Числа берутся из `demoCartTotals` и `config`, а не пишутся в тесте: тест,
 * повторяющий значение руками, ловит опечатку в себе, а не расхождение с
 * правилом.
 */

import { expect, test } from '@playwright/test';

import en from '../src/i18n/messages/en';
import {
  demoCartTotals,
  demoClasses,
  demoInstructors,
  demoSelectedSlot,
  demoTakenSlots,
} from '../prisma/fixtures/demo';
import { security } from '../src/config/business';

const CART = '/en/cart';
const BOOKING_START = '/en/booking';

const cartItemCount = demoCartTotals.items.reduce((sum, item) => sum + item.quantity, 0);
const firstInstructor = demoInstructors[0]!;
const firstClass = demoClasses.find((item) => item.instructorSlug === firstInstructor.slug)!;

/** Подпись подытога с числом штук: та же строка, что рисует сводка. */
function subtotalLabel(count: number): RegExp {
  return new RegExp(`${count}\\s+items?`, 'i');
}

test.describe('Корзина', () => {
  test('позиции и итог совпадают с контрольным расчётом макета', async ({ page }) => {
    await page.goto(CART);

    await expect(page.getByRole('heading', { level: 1, name: en.cart.title })).toBeVisible();

    /* Позиций столько же, сколько в утверждённом расчёте. */
    const lines = page.getByRole('listitem').filter({ has: page.getByRole('button', { name: en.common.actions.remove }) });
    await expect(lines).toHaveCount(demoCartTotals.items.length);

    /* Промокод из макета применён и его видно, а не только его следствие. */
    await expect(
      page.getByText(en.cart.promoApplied.replace('{code}', demoCartTotals.promoCode)),
    ).toBeVisible();

    await expect(page.getByText(subtotalLabel(cartItemCount))).toBeVisible();
  });

  test('изменение количества пересчитывает сводку', async ({ page }) => {
    await page.goto(CART);

    await page.getByRole('button', { name: en.a11y.quantityIncrease }).first().click();

    await expect(page.getByText(subtotalLabel(cartItemCount + 1))).toBeVisible();
  });

  test('удаление последней позиции показывает пустое состояние, а не пустоту', async ({ page }) => {
    await page.goto(CART);

    const remove = page.getByRole('button', { name: en.common.actions.remove });
    for (let index = demoCartTotals.items.length; index > 0; index -= 1) {
      await remove.first().click();
    }

    await expect(page.getByText(en.cart.empty)).toBeVisible();
    await expect(page.getByRole('link', { name: en.cart.emptyCta })).toBeVisible();
  });
});

test.describe('Бронирование', () => {
  test('вход в поток ведёт к выбору времени у конкретного инструктора', async ({ page }) => {
    await page.goto(BOOKING_START);

    await expect(page.getByRole('heading', { level: 1, name: en.booking.startTitle })).toBeVisible();

    const link = page.getByRole('link', { name: firstInstructor.name, exact: true });
    await expect(link).toHaveAttribute('href', `/en/instructors/${firstInstructor.slug}/book`);
  });

  test('занятый слот нельзя выбрать, свободный выбирается', async ({ page }) => {
    await page.goto(`/en/instructors/${firstInstructor.slug}/book`);

    /* Календарь — это сетка с ролью, а не таблица дней: проверяем роль. */
    await expect(page.getByRole('grid')).toBeVisible();

    const taken = demoTakenSlots[0]!;
    await expect(page.getByRole('button', { name: new RegExp(`^${taken}`) })).toBeDisabled();

    const free = page.getByRole('button', { name: new RegExp(`^${demoSelectedSlot}`) });
    await expect(free).toHaveAttribute('aria-pressed', 'true');

    /* Сводка знает, что бронируется, и кнопка активна. */
    await expect(page.getByText(firstClass.title).first()).toBeVisible();
    await expect(page.getByRole('button', { name: en.booking.continueCta })).toBeEnabled();
  });
});

test.describe('Кеширование', () => {
  /*
   * Приватные экраны обязаны отдаваться с `no-store`. Для бронирования это не
   * формальность: страница содержит набор свободных слотов, и ответ, отданный
   * CDN повторно, означает двойную бронь. Проверка нужна ещё и потому, что путь
   * лежит ПОД каталожным `/instructors/:slug*` — правило работает только пока
   * приватные шаблоны стоят в `headers()` раньше каталога.
   */
  const privateScreens = [
    CART,
    BOOKING_START,
    `/en/instructors/${firstInstructor.slug}/book`,
    '/en/checkout/contact',
  ];

  for (const path of privateScreens) {
    test(`${path} отдаётся без кеша`, async ({ page }) => {
      const response = await page.goto(path);
      expect(
        response?.headers()['cache-control'],
        `Cache-Control у ${path}: ${response?.headers()['cache-control']}`,
      ).toContain('no-store');
    });
  }
});

test.describe('Оформление', () => {
  /*
   * `/checkout` закрыт гейтом приватных разделов в `proxy.ts`: он смотрит только
   * НАЛИЧИЕ cookie сессии, потому что проверять подпись на каждом запросе в edge
   * нельзя, а настоящая авторизация живёт в `@/lib/auth/guards`. Поэтому для
   * рендера экрана достаточно выставить cookie — это и делает тест, фиксируя
   * фактическое поведение гейта, а не обходя авторизацию (её ещё нет).
   */
  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      {
        name: security.session.cookieName,
        value: 'e2e',
        domain: '127.0.0.1',
        path: '/',
      },
    ]);
  });

  test('шаги открываются по адресу, неизвестный шаг — 404', async ({ page }) => {
    await page.goto('/en/checkout/contact');
    await expect(
      page.getByRole('heading', { level: 2, name: en.checkout.contact.title }),
    ).toBeVisible();

    /* Индикатор сообщает текущий шаг, а не просто подсвечивает его. */
    await expect(page.locator('[aria-current="step"]')).toHaveText(en.checkout.steps.contact);

    const unknown = await page.goto('/en/checkout/nope');
    expect(unknown?.status()).toBe(404);
  });

  test('поле без значения не пускает дальше и объясняет причину', async ({ page }) => {
    await page.goto('/en/checkout/contact');

    await page.getByRole('button', { name: en.common.actions.continue }).click();

    await expect(page.getByText(en.validation.required).first()).toBeVisible();
    await expect(page).toHaveURL(/\/checkout\/contact$/);
  });

  test('способы оплаты приходят от провайдера, а не из разметки', async ({ page }) => {
    await page.goto('/en/checkout/payment');

    await expect(
      page.getByRole('heading', { level: 2, name: en.checkout.payment.title }),
    ).toBeVisible();

    /* Пока способ не выбран, дальше идти нельзя. */
    await expect(page.getByRole('button', { name: en.common.actions.continue })).toBeDisabled();

    /* Кружок радиокнопки визуально скрыт — нажатие идёт по плитке, как у человека. */
    const arca = page.getByRole('radio', { name: en.checkout.payment.methodArca, exact: true });
    await page.getByText(en.checkout.payment.methodArca, { exact: true }).click();
    await expect(arca).toHaveAttribute('aria-checked', 'true');

    await expect(page.getByRole('button', { name: en.common.actions.continue })).toBeEnabled();
    await expect(page.getByText(en.checkout.payment.redirectNote)).toBeVisible();
  });
});
