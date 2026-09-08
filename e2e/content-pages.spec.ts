/**
 * Контентные и правовые страницы.
 *
 * Причина этой проверки прямая: подвал стоит на КАЖДОЙ странице сайта и до этой
 * задачи вёл в 404 четырнадцатью ссылками. Поэтому главный тест здесь — не «страница
 * открылась», а «ни одна ссылка подвала не отвечает ошибкой»: он ловит и забытую
 * страницу, и опечатку в маршруте, и рассинхрон между `routes` и файлами.
 *
 * Остальное — свойства, которых не видно ни в сборке, ни в типах:
 *   • вопрос FAQ раскрывается и без JavaScript (`<details>`), а схема `FAQPage`
 *     совпадает с видимыми вопросами;
 *   • оглавление правового документа ведёт к своему разделу;
 *   • числа в документах и на лендингах приходят из бизнес-правил, а не из текста;
 *   • контактная форма не выдаёт недоставленное письмо за отправленное.
 */

import { expect, test, type Page } from '@playwright/test';

import { booking, commission, promotions } from '../src/config/business';
import { legalDocuments } from '../src/config/legal';
import { orderedSubscriptionPlans } from '../src/config/pricing';
import { routes } from '../src/config/routes';
import { site } from '../src/config/site';
import en from '../src/i18n/messages/en';

const LOCALE = 'en';
const localized = (path: string): string => `/${LOCALE}${path}`;

/** Свои ресурсы страницы. Префетчи переходов сюда не входят — см. catalog-pages. */
const OWN_RESOURCES = new Set(['image', 'stylesheet', 'script', 'font', 'media']);
const RESOURCE_FAILURE = 'Failed to load resource';

const contentPaths = [
  routes.about(),
  routes.contact(),
  routes.faq(),
  routes.help(),
  routes.pricing(),
  routes.becomeInstructor(),
  routes.listYourStudio(),
  routes.giftCards(),
  ...legalDocuments.map((document) => document.href),
].map(localized);

for (const path of contentPaths) {
  test(`${path} открывается без ошибок и с одним заголовком первого уровня`, async ({ page }) => {
    const problems: string[] = [];

    page.on('pageerror', (error) => problems.push(String(error)));
    page.on('console', (message) => {
      if (message.type() === 'error' && !message.text().includes(RESOURCE_FAILURE)) {
        problems.push(message.text());
      }
    });
    page.on('response', (response) => {
      if (response.status() >= 400 && OWN_RESOURCES.has(response.request().resourceType())) {
        problems.push(`${response.status()} ${response.url()}`);
      }
    });

    const response = await page.goto(path);

    expect(response?.status(), `HTTP-код ${path}`).toBe(200);
    await expect(page.locator('main')).toBeVisible();
    /* Ровно один h1: заголовок страницы живёт в баннере и нигде больше. */
    await expect(page.locator('main h1')).toHaveCount(1);
    expect(problems, `ошибки на ${path}:\n${problems.join('\n')}`).toEqual([]);
  });
}

test('ни одна ссылка подвала не ведёт в 404', async ({ page, request }) => {
  await page.goto(localized(routes.home()));

  const footer = page.locator('body footer').last();
  const hrefs = await footer
    .getByRole('link')
    .evaluateAll((nodes) =>
      nodes
        .map((node) => node.getAttribute('href') ?? '')
        .filter((href) => href.startsWith('/')),
    );

  /* Подвал — пять колонок плюс правовая: меньше десяти ссылок означает, что он не отрисовался. */
  expect(hrefs.length).toBeGreaterThan(10);

  const broken: string[] = [];
  for (const href of new Set(hrefs)) {
    const response = await request.get(href);
    if (response.status() >= 400) broken.push(`${response.status()} ${href}`);
  }

  expect(broken, `битые ссылки подвала:\n${broken.join('\n')}`).toEqual([]);
});

test('вопрос FAQ раскрывается и остаётся в разметке закрытым', async ({ page }) => {
  await page.goto(localized(routes.faq()));

  const first = page.locator('main details').first();
  const answer = first.locator('p');

  /*
   * Текст ответа присутствует в DOM до раскрытия — это и есть причина выбора
   * `<details>` вместо Radix: закрытый Accordion не отдаёт ответ ни поисковику,
   * ни поиску по странице.
   */
  await expect(answer).toHaveCount(1);
  await expect(first).not.toHaveAttribute('open', /.*/);

  await first.locator('summary').click();
  await expect(first).toHaveAttribute('open', '');
  await expect(answer).toBeVisible();
});

test('разметка FAQPage совпадает с видимыми вопросами', async ({ page }) => {
  await page.goto(localized(routes.faq()));

  const schemas = await page.locator('script[type="application/ld+json"]').allTextContents();
  const faq = schemas
    .map((raw) => JSON.parse(raw) as Record<string, unknown>)
    .flatMap((node) => ('@graph' in node ? (node['@graph'] as Record<string, unknown>[]) : [node]))
    .find((node) => node['@type'] === 'FAQPage');

  expect(faq, 'на странице вопросов нет схемы FAQPage').toBeDefined();

  const questions = (faq!.mainEntity as Array<{ name: string; acceptedAnswer: { text: string } }>).map(
    (entry) => entry.name,
  );
  const visible = await page.locator('main details summary').allInnerTexts();

  expect(questions.length).toBe(visible.length);
  /* Каждый вопрос схемы обязан быть на экране: расхождение Google считает обманом. */
  for (const question of questions) {
    expect(visible.some((text) => text.trim().startsWith(question)), question).toBe(true);
  }
});

test('справка ведёт в нужную группу вопросов', async ({ page }) => {
  await page.goto(localized(routes.help()));

  await page.getByRole('link', { name: new RegExp(en.help.topics.booking.title) }).click();
  await expect(page).toHaveURL(new RegExp(`${routes.faq()}#booking$`));
  /* Целевая группа существует: якорь без элемента — это переход в начало страницы. */
  await expect(page.locator('#booking')).toBeVisible();
});

test('правовой документ показывает статус черновика, оглавление и условия из конфигурации', async ({
  page,
}) => {
  await page.goto(localized(routes.cancellationPolicy()));

  await expect(page.getByText(en.legal.draftNotice)).toBeVisible();

  /*
   * Окно бесплатной отмены приходит из бизнес-правил, а не из текста перевода:
   * при правке `booking.freeCancellationHours` документ обязан измениться сам.
   */
  await expect(
    page.getByText(new RegExp(`${booking.freeCancellationHours}\\s*hours`)).first(),
  ).toBeVisible();

  /* Оглавление ведёт к разделу: у каждого пункта есть свой заголовок на странице. */
  const document = legalDocuments.find((entry) => entry.id === 'cancellationPolicy')!;
  const toc = page.getByRole('navigation', { name: en.legal.tocTitle });
  await expect(toc.getByRole('link')).toHaveCount(document.sections.length);

  await toc.getByRole('link').last().click();
  await expect(page).toHaveURL(new RegExp(`#${document.sections.at(-1)}$`));
});

test('все правовые документы связаны между собой', async ({ page }) => {
  await page.goto(localized(routes.terms()));

  const nav = page.getByRole('navigation', { name: en.legal.documentsTitle });
  /* Остальные пять документов: список без ссылки на себя же. */
  await expect(nav.getByRole('link')).toHaveCount(legalDocuments.length - 1);
});

test('страница тарифов показывает планы, годовую цену и сравнение', async ({ page }) => {
  await page.goto(localized(routes.pricing()));

  const plans = page.getByRole('article');
  await expect(plans).toHaveCount(orderedSubscriptionPlans.length);

  /* Рекомендуемый план помечен, и ровно один. */
  await expect(page.getByText(en.pricing.mostPopular)).toHaveCount(1);

  /* Таблица сравнения — настоящая таблица со строками по квотам. */
  const table = page.getByRole('table');
  await expect(table).toBeVisible();
  await expect(table.getByRole('columnheader')).toHaveCount(orderedSubscriptionPlans.length + 1);
});

test('подарочные карты перечисляют номиналы из конфигурации', async ({ page }) => {
  await page.goto(localized(routes.giftCards()));

  const amounts = page.getByRole('list', { name: en.giftCards.amountsTitle });
  await expect(amounts.getByRole('listitem')).toHaveCount(
    promotions.giftCard.presetAmounts.length,
  );
});

test('лендинг преподавателя называет комиссию из конфигурации', async ({ page }) => {
  await page.goto(localized(routes.becomeInstructor()));

  const rate = `${Math.round(commission.instructorRate * 100)}%`;
  await expect(page.getByText(rate).first()).toBeVisible();

  /* Ссылка «посмотреть комиссию» ведёт к своему разделу на той же странице. */
  await page.getByRole('link', { name: en.becomeInstructor.secondaryCta }).click();
  await expect(page).toHaveURL(/#earnings$/);
  await expect(page.locator('#earnings')).toBeVisible();
});

test('контактная форма не выдаёт недоставленное письмо за отправленное', async ({ page }, testInfo) => {
  await isolateRateLimit(page, `delivery-${testInfo.project.name}`);
  await page.goto(localized(routes.contact()));

  await fillContactForm(page);
  await page.getByRole('button', { name: en.contact.form.submit }).click();

  /*
   * Почтовый провайдер в тестовой сборке не настроен, поэтому письмо не уходит.
   * Правильное поведение — сказать об этом и показать адрес поддержки, а не
   * поблагодарить за обращение, которое никто не получит.
   */
  await expect(page.getByText(en.contact.form.failedTitle)).toBeVisible();
  await expect(page.getByText(site.contact.supportEmail).first()).toBeVisible();
});

test('контактная форма не отправляет пустое сообщение', async ({ page }, testInfo) => {
  await isolateRateLimit(page, `validation-${testInfo.project.name}`);
  await page.goto(localized(routes.contact()));

  await page.getByLabel(en.contact.form.nameLabel).fill('A');
  await page.getByLabel(en.contact.form.emailLabel).fill('not-an-email');
  await page.getByLabel(en.contact.form.messageLabel).fill('short');
  await page.getByRole('button', { name: en.contact.form.submit }).click();

  /* Ошибка адресуется полю: `aria-invalid` на самом поле, а не текст над формой. */
  await expect(page.getByLabel(en.contact.form.emailLabel)).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText(en.contact.form.successTitle)).toHaveCount(0);
});

/**
 * Отдельный адрес клиента на тест и на проект.
 *
 * Ограничение частоты у контактной формы — три обращения в час на адрес, и это
 * правильное продакшен-правило. Но три проекта Playwright (desktop, tablet,
 * mobile) приходят с одного и того же адреса, поэтому шестая отправка в наборе
 * законно получала 429 — и тест «форма не отправила письмо» падал не потому, что
 * форма сломана, а потому что лимитер работает.
 *
 * Заголовок подменяет идентификатор клиента (`clientIdentifier` читает
 * `x-forwarded-for`), то есть тест изображает разных посетителей — а не отключает
 * защиту, ради которой она стоит. В ключ входит имя проекта: иначе повтор
 * упавшего теста в CI становится четвёртой отправкой с того же адреса.
 */
async function isolateRateLimit(page: Page, seed: string): Promise<void> {
  /* Адрес из блока для документации (RFC 5737): в сеть он не уйдёт. */
  const octet = ([...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 250) + 1;
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `198.51.100.${octet}` });
}

async function fillContactForm(page: Page): Promise<void> {
  await page.getByLabel(en.contact.form.nameLabel).fill('Nare Grigoryan');
  await page.getByLabel(en.contact.form.emailLabel).fill('nare@example.com');
  await page
    .getByLabel(en.contact.form.messageLabel)
    .fill('I would like to book a private bachata lesson for two people on Saturday evening.');
}
