import { expect, test } from '@playwright/test';

import { demoInstructors, demoPassword, demoVenueOwnerEmail, demoVenues } from '../prisma/fixtures/demo';
import { routes } from '../src/config/routes';
import en from '../src/i18n/messages/en';
import { completeTwoFactor } from './support/two-factor';

const instructor = demoInstructors[0]!;
const venue = demoVenues[0]!;

type DashboardSection = { role: 'link' | 'heading'; name: string };

const dashboards: Array<{
  path: string;
  email: string;
  name: string;
  title: string;
  sections: DashboardSection[];
}> = [
  {
    path: routes.instructorDashboard(),
    email: instructor.email,
    name: instructor.name,
    title: en.footer.studioDashboardTitle,
    sections: [{ role: 'link', name: en.footer.studioCheckInTitle }],
  },
  {
    path: routes.venueDashboard(),
    email: demoVenueOwnerEmail(venue.slug),
    name: `${venue.name} Owner`,
    title: en.footer.venueDashboardTitle,
    sections: [{ role: 'heading', name: en.footer.venueDashboardRooms }],
  },
];

for (const dashboard of dashboards) {
  test(`${dashboard.path}: demo-вход работает, будущие разделы не ведут на 404`, async ({ page, baseURL }, testInfo) => {
    test.setTimeout(60_000);
    // Диагностический IP нужен только нашему origin, не внешним media-запросам.
    await page.route(`${baseURL}/**`, route => route.continue({
      headers: { ...route.request().headers(), 'x-forwarded-for': `10.83.${testInfo.workerIndex % 250}.1` },
    }));
    const failures: string[] = [];
    page.on('response', response => {
      if (response.status() >= 400 && new URL(response.url()).origin === baseURL) {
        failures.push(`${response.status()} ${response.url()}`);
      }
    });

    await page.goto(`/en${dashboard.path}`);
    await expect(page.locator('[data-slot="theme-toggle"][data-theme-choice]')).toHaveCount(1);
    await page.getByLabel(en.auth.signIn.emailLabel).fill(dashboard.email);
    await page.getByLabel(en.auth.signIn.passwordLabel).fill(demoPassword);
    await page.getByRole('button', { name: en.auth.signIn.submit }).click();
    await completeTwoFactor(page);
    await expect(page.getByRole('heading', { level: 1, name: dashboard.title, exact: true })).toBeVisible({ timeout: 30_000 });
    for (const section of dashboard.sections) {
      const locator = section.role === 'heading'
        ? page.getByRole('heading', { level: 3, name: section.name, exact: true }).first()
        : page.getByRole('link', { name: section.name, exact: true });
      await expect(locator).toBeVisible();
    }
    await page.getByRole('link', { name: en.common.actions.continue, exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: dashboard.name, exact: true })).toBeVisible();
    expect(failures).toEqual([]);
  });
}
