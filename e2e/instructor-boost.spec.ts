/**
 * Буст инструктора: заявка из студии, одобрение в админке и место в выдаче.
 *
 * Инструктор, который в выдаче стоит последним, подаёт заявку на промо-размещение.
 * Админ одобряет её. После одобрения инструктор должен подняться в каталоге.
 *
 * Тест создаёт заявку и меняет `boostedUntil` в тестовой базе; после себя убирает и то,
 * и другое. Запускается только в desktop: один вход на тестовую базу.
 */

import { expect, test, type Page } from '@playwright/test';
import { PrismaPg } from '@prisma/adapter-pg';

import { demoAccounts, demoPassword } from '../prisma/fixtures/demo';
import { PrismaClient } from '../src/generated/prisma/client';
import en from '../src/i18n/messages/en';
import { isolateRateLimit } from './support/rate-limit';
import { completeTwoFactor } from './support/two-factor';

const admin = demoAccounts.find((account) => account.role === 'ADMIN')!;
const DAY_MS = 86_400_000;

async function signIn(page: Page, email: string, redirectTo: string): Promise<void> {
  await page.goto(`/en/sign-in?redirectTo=${encodeURIComponent(redirectTo)}`);
  await page.getByLabel(en.auth.signIn.emailLabel).fill(email);
  await page.getByLabel(en.auth.signIn.passwordLabel).fill(demoPassword);
  await page.getByRole('button', { name: en.auth.signIn.submit }).click();
  await completeTwoFactor(page);
}

/** Слаги инструкторов в каталоге сверху вниз. */
async function instructorOrder(page: Page): Promise<string[]> {
  await page.goto('/en/instructors');
  const hrefs = await page
    .locator('main a[href*="/instructors/"]')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href') ?? ''));
  const slugs: string[] = [];
  for (const href of hrefs) {
    const slug = href.split('?')[0]!.split('/').pop() ?? '';
    if (slug && !slugs.includes(slug)) slugs.push(slug);
  }
  return slugs;
}

/** Значение для поля `datetime-local` в формате `ГГГГ-ММ-ДДTЧЧ:ММ`. */
function localInput(date: Date): string {
  return date.toISOString().slice(0, 16);
}

test.beforeEach(async ({ page }, testInfo) => {
  /* Вход ограничен по адресу клиента: у каждого теста свой адрес, чтобы соседи не делили лимит. */
  await isolateRateLimit(page, `${testInfo.project.name}-${testInfo.title}`);
});

test('одобренный буст поднимает инструктора в выдаче', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'один вход на тестовую базу: только в desktop');

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  let instructorId: string | undefined;
  let previousBoostedUntil: Date | null = null;
  try {
    const before = await instructorOrder(page);
    const slug = before[before.length - 1]!;
    const oldIndex = before.indexOf(slug);

    const instructor = await db.instructorProfile.findUniqueOrThrow({
      where: { slug },
      select: { id: true, boostedUntil: true, user: { select: { email: true, name: true } } },
    });
    instructorId = instructor.id;
    previousBoostedUntil = instructor.boostedUntil;
    /* Старые заявки этого инструктора мешают: в админке они попадут в ту же строку. */
    await db.boostCampaign.deleteMany({ where: { instructorId: instructor.id } });

    /* 1. Инструктор подаёт заявку в студии. */
    await signIn(page, instructor.user.email, '/studio/boost');
    await page.waitForURL(/\/studio\/boost/, { timeout: 30_000 });
    await page.getByLabel(en.boost.studio.bid).fill('1000');
    await page.getByLabel(en.boost.studio.start).fill(localInput(new Date(Date.now() + DAY_MS)));
    await page.getByLabel(en.boost.studio.end).fill(localInput(new Date(Date.now() + 8 * DAY_MS)));
    await page.getByRole('button', { name: en.boost.studio.submit }).click();
    await expect(page.getByText(en.boost.studio.requested)).toBeVisible();

    /* 2. Админ одобряет заявку. */
    await page.context().clearCookies();
    await signIn(page, admin.email, '/admin/boosts');
    await page.waitForURL(/\/admin\/boosts/, { timeout: 30_000 });
    const row = page.locator('tr').filter({ hasText: instructor.user.name });
    await expect(row).toHaveCount(1);
    await row.getByRole('button', { name: en.boost.moderate.approve }).click();
    await expect(row).toContainText(en.boost.status.APPROVED);

    /* 3. Публичная выдача: одобренный инструктор поднялся. */
    await page.context().clearCookies();
    /* Первая загрузка после одобрения может отдать предыдущий ответ кеша, поэтому проверяем с повторами. */
    await expect
      .poll(async () => (await instructorOrder(page)).indexOf(slug), { timeout: 30_000 })
      .toBeLessThan(oldIndex);
  } finally {
    if (instructorId) {
      await db.boostCampaign.deleteMany({ where: { instructorId } });
      await db.instructorProfile.update({ where: { id: instructorId }, data: { boostedUntil: previousBoostedUntil } });
    }
    await db.$disconnect();
  }
});
