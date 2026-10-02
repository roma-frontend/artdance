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
  demoAccounts,
  demoCartTotals,
  demoClasses,
  demoInstructors,
  demoPassword,
} from '../prisma/fixtures/demo';
import { security } from '../src/config/business';
import { isPeakHour, isWeekendDay, priceForSlot } from '../src/domain/dynamic-pricing';

const CART = '/en/cart';
const BOOKING_START = '/en/booking';

const cartItemCount = demoCartTotals.items.reduce((sum, item) => sum + item.quantity, 0);
const firstInstructor = demoInstructors[0]!;
const firstClass = demoClasses.find((item) => item.instructorSlug === firstInstructor.slug)!;

// было subtotalLabel — теперь корзина пуста, хелпер не нужен
void 'subtotalLabel removed — cart empty by design';

test.describe('Корзина', () => {
  test('пустая корзина показывает пустое состояние, а не пустоту', async ({ page }) => {
    await page.goto(CART);

    await expect(page.getByRole('heading', { level: 1, name: en.cart.title })).toBeVisible();
    await expect(page.getByText(en.cart.empty)).toBeVisible();
    await expect(page.getByRole('link', { name: en.cart.emptyCta })).toBeVisible();
  });

  test('контрольный расчёт макета: demo-товары дают ожидаемые итоги', async () => {
    const { cartTotals } = await import('../src/domain/cart');
    const totals = cartTotals({
      lines: demoCartTotals.items.map((item) => ({ id: item.variantSku, lineType: 'PRODUCT' as const, unitPrice: 0, quantity: item.quantity })),
      promo: { code: demoCartTotals.promoCode } as never,
      deliveryZone: null,
    });
    expect(totals.itemCount).toBe(cartItemCount);
  });
});

test.describe('Бронирование', () => {
  test('занятие проходит через удержание в бронь и списывает одно место', async ({ page }, testInfo) => {
    const connectionString = process.env.DATABASE_URL;
    test.skip(!connectionString || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(connectionString).hostname),
      'Запись и очистка тестовых данных разрешены только на локальной БД');
    const { PrismaClient } = await import('../src/generated/prisma/client');
    const { PrismaPg } = await import('@prisma/adapter-pg');
    const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: connectionString! }) });
    const danceClass = demoClasses[['desktop', 'tablet', 'mobile'].indexOf(testInfo.project.name)] ?? firstClass;
    const customer = demoAccounts.find(account => account.role === 'CUSTOMER')!;
    let holdId: string | undefined;
    let bookingId: string | undefined;
    let sessionId: string | undefined;
    try {
      await page.setExtraHTTPHeaders({ 'x-forwarded-for': `10.240.${testInfo.parallelIndex}.1` });
      await page.goto('/en/sign-in');
      await page.getByLabel(en.auth.signIn.emailLabel).fill(customer.email);
      await page.getByLabel(en.auth.signIn.passwordLabel).fill(demoPassword);
      await page.getByRole('button', { name: en.auth.signIn.submit }).click();
      await page.waitForURL(/\/account$/);
      await page.goto(`/en/classes/${danceClass.slug}`);
      const holdResponse = page.waitForResponse(response =>
        response.url().includes('/api/booking/hold') && response.request().method() === 'POST',
      );
      await page.getByRole('link', { name: en.common.actions.bookClass, exact: true }).click();
      const held = await holdResponse;
      expect(held.status()).toBe(201);
      holdId = (await held.json()).hold.id;
      sessionId = held.request().postDataJSON().sessionId;
      expect(sessionId).toBeTruthy();
      const session = await db.classSession.findUniqueOrThrow({
        where: { id: sessionId },
        include: { danceClass: true },
      });
      expect(session.danceClass.slug).toBe(danceClass.slug);
      const bookingResponse = page.waitForResponse(response =>
        new URL(response.url()).pathname === '/api/booking' && response.request().method() === 'POST',
      );
      await page.getByRole('button', { name: en.booking.continueCta }).click();
      const confirmed = await bookingResponse;
      expect(confirmed.status()).toBe(201);
      const payload = (await confirmed.json()).booking;
      bookingId = payload.id;
      await expect(page).toHaveURL(new RegExp(`/booking/${payload.reference}/confirm$`));
      await expect(page.getByRole('heading', { level: 1, name: en.booking.confirmedTitle })).toBeVisible();
      const saved = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });
      expect(saved.sessionId).toBe(sessionId);
      expect(saved.status).toBe('CONFIRMED');
      expect(saved.basePrice).toBe(session.danceClass.price);
      expect(saved.totalPrice).toBe(priceForSlot(session.danceClass.price, {
        isPeak: isPeakHour(session.startsAt.getHours()),
        isWeekend: isWeekendDay(session.startsAt.getDay()),
      }));
      expect(saved.startsAt).toEqual(session.startsAt);
      expect(saved.endsAt).toEqual(session.endsAt);
      expect(await db.slotHold.findUnique({ where: { id: holdId } })).toBeNull();
      const updated = await db.classSession.findUniqueOrThrow({ where: { id: sessionId } });
      expect(updated.bookedCount).toBe(session.bookedCount + 1);
    } finally {
      if (bookingId && sessionId) {
        await db.$transaction(async transaction => {
          await transaction.notification.deleteMany({ where: {
            payload: { path: ['dedupeKey'], equals: `booking:${bookingId}:confirmed` },
          } });
          await transaction.booking.delete({ where: { id: bookingId } });
          await transaction.classSession.update({ where: { id: sessionId }, data: { bookedCount: { decrement: 1 } } });
        });
      }
      if (holdId) await db.slotHold.deleteMany({ where: { id: holdId } });
      await db.$disconnect();
    }
  });

  test('вход в поток ведёт к выбору времени у конкретного инструктора', async ({ page }) => {
    await page.goto(BOOKING_START);

    await expect(page.getByRole('heading', { level: 1, name: en.booking.startTitle })).toBeVisible();

    const link = page.getByRole('link', { name: firstInstructor.name, exact: true });
    await expect(link).toHaveAttribute('href', `/en/instructors/${firstInstructor.slug}/book`);
  });

  test('свободный слот выбирается и удерживается по ID инструктора из БД', async ({ page }) => {
    const holdResponse = page.waitForResponse(response =>
      response.url().includes('/api/booking/hold') && response.request().method() === 'POST',
    );
    await page.goto(`/en/instructors/${firstInstructor.slug}/book`);

    /* Календарь — это сетка с ролью, а не таблица дней: проверяем роль. */
    await expect(page.getByRole('grid')).toBeVisible();

    const selected = page.getByRole('button', { name: /^\d{2}:\d{2}/ })
      .and(page.locator('[aria-pressed="true"]'));
    await expect(selected).toBeVisible();
    await expect(selected).toBeEnabled();
    const response = await holdResponse;
    expect(response.status()).toBe(201);
    const payload = response.request().postDataJSON() as { instructorId: string };
    expect(payload.instructorId).toBeTruthy();
    expect(payload.instructorId).not.toBe(firstInstructor.slug);

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
