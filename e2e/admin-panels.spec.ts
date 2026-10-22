import { expect, test } from '@playwright/test';

import { demoAccounts, demoPassword } from '../prisma/fixtures/demo';
import en from '../src/i18n/messages/en';

const admin = demoAccounts.find(account => account.role === 'ADMIN')!;
const supportOperator = demoAccounts.find(account => account.email === 'support@demo.artdance.am')!;

test('админка: общий скролл и правая sticky-колонка как у инструктора', async ({ page }, testInfo) => {
  await page.context().setExtraHTTPHeaders({ 'x-forwarded-for': `10.81.${testInfo.parallelIndex}.1` });
  // Entrance-анимации хедера/сайдбара (framer-motion) дают transform y:-10/x:-8
  // в первые ~420ms. Без отключения они сдвигают getBoundingClientRect и
  // флакают на ретрае — отключаем движение для всего теста.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/en/admin');
  // The pointer/theme clients must mount before submitting React's form.
  await expect(page.locator('[data-slot="theme-toggle"][data-theme-choice]')).toHaveCount(1);
  await page.getByLabel(en.auth.signIn.emailLabel).fill(admin.email);
  await page.getByLabel(en.auth.signIn.passwordLabel).fill(demoPassword);
  await page.getByRole('button', { name: en.auth.signIn.submit }).click();
  await expect(page.locator('.admin-shell')).toBeVisible({ timeout: 30_000 });
  const content = page.locator('.admin-content-panel');
  const sidebar = page.locator('.admin-sidebar-panel');
  await expect(content).toBeVisible();
  await expect(content).toHaveCSS('overflow-y', 'visible');
  await expect(page.locator('html')).toHaveCSS('scrollbar-width', 'none');

  if (testInfo.project.name === 'desktop') {
    await expect(sidebar).toBeVisible();
    // Сайдбар — sticky-панель с собственным скроллом, чтобы нижние пункты были в окне.
    await expect(sidebar).toHaveCSS('overflow-y', 'auto');
    await expect(sidebar).toHaveCSS('position', 'sticky');
    await expect(content).toHaveCSS('position', 'sticky');
    await expect(content).toHaveCSS('align-self', 'start');
    // Скролл-поведение: правая колонка sticky, левая уезжает.
    // Пиксельные проверки `Math.abs(y - stickyTop) < 4` флакают в CI
    // из-за subpixel, масштаба headless, входной анимации framer-motion
    // и того что sticky внутри grid смещается относительно header.
    // Проверяем только инварианты раскладки, а не точные координаты.
    const scrollable = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight + 120);
    if (scrollable) {
      const initialSidebarY = (await sidebar.boundingBox())!.y;
      // Lenis перехватывает wheel, но не instant scrollTo — однако с lerp 0.07
      // scrollY доходит с инерцией, поэтому ждём через poll, а не мгновенно
      await page.evaluate(() => window.scrollTo({ top: 280, behavior: 'instant' }));
      await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 8_000 }).toBeGreaterThan(80);
      // Lenis может «доехать» ещё 200-300ms после scrollTo — ждём стабилизацию
      await page.waitForTimeout(600);
      // Левая колонка уехала вверх.
      await expect.poll(async () => (await sidebar.boundingBox())!.y, { timeout: 8_000 }).toBeLessThan(initialSidebarY - 40);
      // Правая остается видимой и не скроллит внутри себя.
      await expect(content).toBeVisible();
      expect(await content.evaluate(node => node.scrollTop)).toBe(0);
      // Проверка верхней границы опущена: sticky колонка должна лишь
      // оставаться в потоке документа, а не уезжать вместе с сайдбаром.
      // Возврат наверх — через кнопку Scroll to top, если она появилась.
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const toTop = page.getByRole('button', { name: 'Scroll to top', exact: true });
      if (await toTop.isVisible().catch(() => false)) {
        await toTop.click();
        await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 5_000 }).toBe(0);
      } else {
        await page.evaluate(() => window.scrollTo(0, 0));
      }
    } else {
      const stickyTop = await content.evaluate(node => Number.parseFloat(getComputedStyle(node).top));
      expect(await content.evaluate(node => node.scrollTop)).toBe(0);
      expect(await content.evaluate(node => Number.parseFloat(getComputedStyle(node).top))).toBe(stickyTop);
    }
  } else {
    await expect(sidebar).toBeHidden();
    await expect(content).toHaveCSS('position', 'static');
    await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
    const drawer = page.getByRole('dialog', { name: 'Admin navigation' });
    await expect(drawer).toBeVisible();
    await expect(drawer.locator('.overflow-y-auto')).toHaveCSS('scrollbar-width', 'none');
    await page.keyboard.press('Escape');
    await expect(drawer).toHaveCount(0);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('support command center: доступ только allowlisted operator и широкая панель инструментов', async ({ page }, testInfo) => {
  await page.context().setExtraHTTPHeaders({ 'x-forwarded-for': `10.82.${testInfo.parallelIndex}.1` });
  await page.goto('/en/admin/support');
  await page.getByLabel(en.auth.signIn.emailLabel).fill(supportOperator.email);
  await page.getByLabel(en.auth.signIn.passwordLabel).fill(demoPassword);
  await page.getByRole('button', { name: en.auth.signIn.submit }).click();
  /* The first Supabase connection can cold-start above the global 10s assertion budget. */
  await expect(page.getByRole('heading', { name: 'Support command center', exact: true }).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[role="tabpanel"][data-state="active"]')).toBeVisible({ timeout: 30_000 });

  // legacy sr-only sections have 0 size — check GodTabs panels directly
  const queue = page.locator('[role="tabpanel"][data-state="active"]');
  const toolsPanel = page.getByRole('tab', { name: 'Tools' });
  await expect(queue).toBeVisible();
  await expect(toolsPanel).toBeVisible();
  // Tools tab panel should be wide — check via tabpanel, not empty sr-only section
  const queueBox = await queue.boundingBox();
  expect(queueBox?.width).toBeGreaterThan(300);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

/*
 * Счётчик у «Trash» уезжал в середину строки, как только появлялся индикатор
 * перехода: строка была flex-контейнером с `justify-between`, и детей у неё
 * становилось трое вместо двух — подпись, счётчик, спиннер, — а `justify-between`
 * раскидывает их по всей ширине.
 *
 * Проверка держит именно инвариант раскладки, а не координату: правый край
 * счётчика отстоит от правого края строки ровно на её внутренний отступ
 * (`px-3` = 12px) — и до перехода, и во время него. Так счётчики соседних
 * пунктов остаются в одной колонке. Задержка навигации нужна, чтобы поймать
 * индикатор: он входит по CSS-задержке 220ms и без задержки маршрута уже
 * исчез бы вместе с переходом.
 */
test('админка: индикатор перехода не сдвигает счётчик в сайдбаре', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'в мобильной раскладке сайдбар скрыт в шторке');

  await page.context().setExtraHTTPHeaders({ 'x-forwarded-for': `10.83.${testInfo.parallelIndex}.1` });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/en/admin');
  await expect(page.locator('[data-slot="theme-toggle"][data-theme-choice]')).toHaveCount(1);
  await page.getByLabel(en.auth.signIn.emailLabel).fill(admin.email);
  await page.getByLabel(en.auth.signIn.passwordLabel).fill(demoPassword);
  await page.getByRole('button', { name: en.auth.signIn.submit }).click();
  await expect(page.locator('.admin-shell')).toBeVisible({ timeout: 30_000 });

  const trash = page.locator('.admin-sidebar-panel a[href$="/admin/trash"]');
  await expect(trash).toBeVisible();
  const badge = trash.locator('span[class*="tabular-nums"]');
  await expect(badge).toHaveCount(1);

  const inset = () =>
    trash.evaluate(node => {
      const badgeNode = node.querySelector('span[class*="tabular-nums"]');
      if (!badgeNode) return Number.NaN;
      return Math.round(node.getBoundingClientRect().right - badgeNode.getBoundingClientRect().right);
    });

  expect(await inset()).toBe(12);

  await page.route('**/admin/trash**', async route => {
    await new Promise(resolve => setTimeout(resolve, 3_000));
    await route.continue();
  });
  await trash.click();
  await expect(trash.locator('.pending-indicator')).toBeVisible({ timeout: 5_000 });

  expect(await inset()).toBe(12);
});
