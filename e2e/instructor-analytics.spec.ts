/**
 * Аналитика инструктора: демо-инструктор входит в кабинет и открывает страницу
 * с показателями за 30 дней. Запускается только в desktop: один вход на тестовую базу.
 */

import { expect, test } from '@playwright/test';

import { demoInstructors, demoPassword } from '../prisma/fixtures/demo';
import en from '../src/i18n/messages/en';
import { isolateRateLimit } from './support/rate-limit';
import { completeTwoFactor } from './support/two-factor';

const instructor = demoInstructors[0]!;

test.beforeEach(async ({ page }, testInfo) => {
  /* Вход ограничен по адресу клиента: у каждого теста свой адрес, чтобы соседи не делили лимит. */
  await isolateRateLimit(page, `${testInfo.project.name}-${testInfo.title}`);
});

test('инструктор открывает аналитику и видит показатели', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'один вход на тестовую базу: только в desktop');

  await page.goto(`/en/sign-in?redirectTo=${encodeURIComponent('/studio/analytics')}`);
  await page.getByLabel(en.auth.signIn.emailLabel).fill(instructor.email);
  await page.getByLabel(en.auth.signIn.passwordLabel).fill(demoPassword);
  await page.getByRole('button', { name: en.auth.signIn.submit }).click();
  await completeTwoFactor(page);

  await expect(page.getByRole('heading', { level: 1, name: en.analytics.title })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(en.analytics.cards.completed, { exact: true })).toBeVisible();
  await expect(page.getByText(en.analytics.cards.revenue, { exact: true })).toBeVisible();
  await expect(page.getByText(en.analytics.cards.rating, { exact: true })).toBeVisible();
});
