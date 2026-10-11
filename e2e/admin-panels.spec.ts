import { expect, test } from '@playwright/test';

import { demoAccounts, demoPassword } from '../prisma/fixtures/demo';
import en from '../src/i18n/messages/en';

const admin = demoAccounts.find(account => account.role === 'ADMIN')!;
const supportOperator = demoAccounts.find(account => account.email === 'support@demo.artdance.am')!;

test('админка: общий скролл и правая sticky-колонка как у инструктора', async ({ page }, testInfo) => {
  await page.context().setExtraHTTPHeaders({ 'x-forwarded-for': `10.81.${testInfo.parallelIndex}.1` });
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
    await expect(sidebar).toHaveCSS('overflow-y', 'visible');
    await expect(content).toHaveCSS('position', 'sticky');
    await expect(content).toHaveCSS('align-self', 'start');
    const initialLeft = (await sidebar.boundingBox())!.y;
    const stickyTop = await content.evaluate(node => Number.parseFloat(getComputedStyle(node).top));
    await page.mouse.move(40, 300);
    await page.mouse.wheel(0, 200);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
    await expect.poll(async () => (await sidebar.boundingBox())!.y).toBeLessThan(initialLeft - 100);
    await expect.poll(async () => Math.abs((await content.boundingBox())!.y - stickyTop)).toBeLessThan(1);
    expect(await content.evaluate(node => node.scrollTop)).toBe(0);
    // At the grid boundary, the right column must leave with the left column.
    await page.evaluate(() => window.scrollTo({ top: Number.MAX_SAFE_INTEGER, behavior: 'instant' }));
    await expect.poll(async () => (await content.boundingBox())!.y).toBeLessThan(stickyTop - 20);
    await expect(page.getByRole('button', { name: 'Scroll to top', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Scroll to top', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
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
  await expect(page.getByRole('heading', { name: en.admin.support.queueTitle })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('heading', { name: en.admin.support.toolsTitle })).toBeVisible({ timeout: 30_000 });

  const queue = page.locator('section[aria-labelledby="support-queue"]');
  const tools = page.locator('section[aria-labelledby="support-tools"]');
  await expect(queue).toBeVisible();
  await expect(tools).toBeVisible();
  const toolsBox = await tools.boundingBox();
  expect(toolsBox?.width).toBeGreaterThan(300);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
