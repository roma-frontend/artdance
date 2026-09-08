/**
 * Вход, регистрация и защита приватного раздела.
 *
 * Юнит-тестами это не проверяется: вход — это cookie, подпись, запись в базу и
 * узнавание сессии следующим запросом. `npm run verify:auth` проверяет контракт
 * эндпоинтов, а здесь — то же самое глазами человека: форма, ошибка на экране,
 * переход, выход.
 *
 * Тесты идут по демо-аккаунту из фикстур (`npm run db:seed`), поэтому база
 * обязана быть посеяна. Регистрация создаёт пользователя с адресом-меткой
 * времени: повторный запуск не спотыкается о занятый адрес. Такие адреса
 * помечены префиксом из `demoThrowawayPrefixes` — следующий `db:seed` их уберёт.
 */

import { expect, test } from '@playwright/test';

import { demoAccounts, demoPassword, demoThrowawayEmail } from '../prisma/fixtures/demo';
import { routes } from '../src/config/routes';
import { security } from '../src/config/business';
import en from '../src/i18n/messages/en';

const LOCALE = 'en';
const localized = (path: string): string => `/${LOCALE}${path}`;

const client = demoAccounts.find((account) => account.role === 'CUSTOMER')!;

/**
 * Каждый тест приходит с собственного адреса.
 *
 * Ограничение частоты (`rateLimits.signIn` — восемь попыток за пять минут)
 * считается по идентификатору клиента, и без этого набор тестов начал бы
 * проверять сам себя: попытки из теста про блокировку исчерпали бы лимит, и
 * следующий тест получил бы отказ по частоте вместо ожидаемого поведения.
 * Разделять адреса корректно и по смыслу: здесь проверяется lockout, а не rate
 * limit, — это разные механизмы (см. `lib/auth/lockout.ts`).
 */
let probeCounter = 0;

test.beforeEach(async ({ context }, testInfo) => {
  probeCounter += 1;
  await context.setExtraHTTPHeaders({
    'x-forwarded-for': `10.${testInfo.parallelIndex}.${probeCounter % 250}.1`,
  });
});

/** Заполнить форму входа и отправить. */
async function signIn(page: import('@playwright/test').Page, email: string, password: string) {
  await page.getByLabel(en.auth.signIn.emailLabel).fill(email);
  await page.getByLabel(en.auth.signIn.passwordLabel).fill(password);
  await page.getByRole('button', { name: en.auth.signIn.submit }).click();
}

/**
 * Сообщение об ошибке внутри формы.
 *
 * Именно внутри: Next держит на странице свой `role="alert"` для объявления
 * смены маршрута, и поиск по роли без области видимости находит два элемента.
 */
function formAlert(page: import('@playwright/test').Page) {
  return page.locator('form').getByRole('alert');
}

test.describe('Вход', () => {
  test('экран показывает подписи, а не placeholder’ы', async ({ page }) => {
    await page.goto(localized(routes.signIn()));

    await expect(page.getByRole('heading', { level: 1, name: en.auth.signIn.title })).toBeVisible();
    /* Подпись связана с полем: getByLabel находит поле только через label. */
    await expect(page.getByLabel(en.auth.signIn.emailLabel)).toBeVisible();
    await expect(page.getByLabel(en.auth.signIn.passwordLabel)).toBeVisible();
  });

  test('верные данные пускают в кабинет', async ({ page }) => {
    await page.goto(localized(routes.signIn()));
    await signIn(page, client.email, demoPassword);

    await page.waitForURL(new RegExp(`${routes.account()}$`));
    await expect(page.getByRole('heading', { level: 1, name: client.name })).toBeVisible();
    await expect(page.getByText(client.email)).toBeVisible();
  });

  test('неверный пароль показывает причину и оставляет на экране входа', async ({ page }) => {
    await page.goto(localized(routes.signIn()));
    await signIn(page, client.email, 'obviously-wrong-password');

    await expect(formAlert(page)).toHaveText(en.auth.signIn.invalidCredentials);
    expect(page.url()).toContain(routes.signIn());
  });

  test('ответ не различает существующий и несуществующий адрес', async ({ page }) => {
    await page.goto(localized(routes.signIn()));
    await signIn(page, demoThrowawayEmail('no-such'), 'obviously-wrong-password');

    /* Тот же текст, что и на неверный пароль: иначе форма перечисляет клиентов. */
    await expect(formAlert(page)).toHaveText(en.auth.signIn.invalidCredentials);
  });

  test('серия неудач блокирует аккаунт', async ({ page }) => {
    /*
     * Адрес выдуманный и уникальный: блокировать демо-клиента значило бы сломать
     * остальные тесты на четверть часа — блокировка живёт в базе, а не в памяти.
     * Префикс из фикстур: следы уберёт следующий `db:seed`.
     */
    const email = demoThrowawayEmail('lockout');

    for (let attempt = 0; attempt < security.login.maxFailures; attempt += 1) {
      await page.goto(localized(routes.signIn()));
      await signIn(page, email, 'obviously-wrong-password');
      await expect(formAlert(page)).toBeVisible();
    }

    await page.goto(localized(routes.signIn()));
    await signIn(page, email, 'obviously-wrong-password');

    /* Сообщение о блокировке содержит число минут, а не общий отказ. */
    await expect(formAlert(page)).toContainText(String(security.login.lockoutMinutes));
  });
});

test.describe('Защита приватного раздела', () => {
  test('кабинет без сессии уводит на вход и запоминает, куда шёл человек', async ({ page }) => {
    await page.goto(localized(routes.account()));

    await page.waitForURL(new RegExp('/sign-in'));
    expect(page.url()).toContain(`redirectTo=${encodeURIComponent(routes.account())}`);  });

  test('после входа человек попадает туда, куда шёл', async ({ page }) => {
    await page.goto(localized(routes.account()));
    await page.waitForURL(new RegExp('/sign-in'));

    await signIn(page, client.email, demoPassword);

    await page.waitForURL(new RegExp(`${routes.account()}$`));
    await expect(page.getByRole('heading', { level: 1, name: client.name })).toBeVisible();
  });

  test('выход возвращает на главную и закрывает кабинет', async ({ page }) => {
    await page.goto(localized(routes.signIn()));
    await signIn(page, client.email, demoPassword);
    await page.waitForURL(new RegExp(`${routes.account()}$`));

    await page.getByRole('button', { name: en.common.actions.signOut }).click();
    await page.waitForURL(new RegExp(`/${LOCALE}$`));

    /* Сессии больше нет: кабинет снова уводит на вход. */
    await page.goto(localized(routes.account()));
    await page.waitForURL(new RegExp('/sign-in'));
  });
});

test.describe('Регистрация', () => {
  test('без согласия с условиями форма не отправляется', async ({ page }) => {
    await page.goto(localized(routes.signUp()));

    await page.getByLabel(en.auth.signUp.nameLabel).fill('Terms Probe');
    await page.getByLabel(en.auth.signIn.emailLabel).fill(demoThrowawayEmail('terms'));
    await page.getByLabel(en.auth.signIn.passwordLabel).fill(demoPassword);
    await page.getByRole('button', { name: en.auth.signUp.submit }).click();

    /* Остались на месте: галочка согласия обязательна и не предвыбрана. */
    expect(page.url()).toContain(routes.signUp());
  });

  test('новый аккаунт создаётся и сразу входит', async ({ page }) => {
    const email = demoThrowawayEmail('signup');

    await page.goto(localized(routes.signUp()));
    await page.getByLabel(en.auth.signUp.nameLabel).fill('New Dancer');
    await page.getByLabel(en.auth.signIn.emailLabel).fill(email);
    await page.getByLabel(en.auth.signIn.passwordLabel).fill(demoPassword);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: en.auth.signUp.submit }).click();

    await page.waitForURL(new RegExp(`${routes.account()}$`));
    await expect(page.getByText(email)).toBeVisible();
  });

  test('занятый адрес называет поле, а не общую ошибку', async ({ page }) => {
    await page.goto(localized(routes.signUp()));

    await page.getByLabel(en.auth.signUp.nameLabel).fill('Duplicate');
    await page.getByLabel(en.auth.signIn.emailLabel).fill(client.email);
    await page.getByLabel(en.auth.signIn.passwordLabel).fill(demoPassword);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: en.auth.signUp.submit }).click();

    await expect(formAlert(page)).toHaveText(en.auth.signUp.emailTaken);
  });
});

test.describe('Вошедший не видит форм входа', () => {
  test('экран входа перенаправляет в кабинет', async ({ page }) => {
    await page.goto(localized(routes.signIn()));
    await signIn(page, client.email, demoPassword);
    await page.waitForURL(new RegExp(`${routes.account()}$`));

    await page.goto(localized(routes.signIn()));
    await page.waitForURL(new RegExp(`${routes.account()}$`));
  });
});
