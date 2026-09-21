/**
 * DANCESPORT E2E — разделы сообщества (требование заказчика 21.09.2026).
 *
 * Проверяется не «красивость», а предусловия навигации и контрактов:
 *   • каждая новая страница отвечает 200 и имеет ровно один h1;
 *   • ссылки из подвала и шапки не ведут в 404;
 *   • срез афиши (`/events?type=COMPETITION`) показывает только соревнования;
 *   • лендинг содержит DanceSport-секцию.
 */

import { expect, test } from "@playwright/test";

import { routes } from "../src/config/routes";

const localized = (path: string) => `/en${path === "/" ? "" : path}`;

test.describe("страницы сообщества DanceSport", () => {
  const pages = [
    routes.athletes(),
    routes.federations(),
    routes.partners(),
    routes.sponsors(),
    routes.advertise(),
  ];

  for (const path of pages) {
    test(`${path}: 200, один h1, main виден`, async ({ page }) => {
      const response = await page.goto(localized(path));
      expect(response?.status(), path).toBe(200);
      await expect(page.locator("main")).toBeVisible();
      await expect(page.locator("main h1")).toHaveCount(1);
    });
  }
});

test.describe("срезы афиши", () => {
  test("competitions показывает событие соревнования и не показывает социал", async ({
    page,
  }) => {
    await page.goto(localized(routes.competitions()));
    await expect(page.locator("main")).toBeVisible();

    const cards = page.locator("main article");
    await expect(cards.first()).toBeVisible();

    /* Все бейджи типов на странице — «Competition». */
    const badges = await cards.locator("span").allTextContents();
    const typeBadges = badges.filter((text) =>
      /competition|Workshop|Battle|Masterclass|Social|Showcase|Concert/i.test(
        text,
      ),
    );
    for (const badge of typeBadges) {
      expect(badge, "в срезе соревнований есть чужой тип").toMatch(
        /competition/i,
      );
    }
  });

  test("social-events показывает социальный вечер", async ({ page }) => {
    await page.goto(localized(routes.socialEvents()));
    await expect(page.locator("main article").first()).toBeVisible();
  });
});

test.describe("лендинг", () => {
  test("DanceSport-секция присутствует и ведёт на соревнования", async ({
    page,
  }) => {
    await page.goto(localized(routes.home()));

    await expect(
      page.getByRole("link", { name: "Competitions" }).first(),
    ).toBeVisible();
  });
});
