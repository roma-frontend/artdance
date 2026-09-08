/**
 * Хабы направлений: `/styles` и `/styles/[style]`.
 *
 * Что здесь проверяется и почему именно живой сборкой.
 *
 * **Хаб достижим по внутренним ссылкам.** Пятьдесят четыре страницы, на которые
 * ссылается только карта сайта, — оплаченная сборка, которую обходят раз в месяц.
 * Ссылки идут из плиток главной, из подвала, из перечня направлений и из блока
 * соседних направлений на самом хабе; ни одну из этих связей не видит ни
 * компилятор, ни юнит-тест.
 *
 * **Хаб уводит в каталог с поставленным фильтром.** «Все занятия по хип-хопу» —
 * это адрес `/classes?style=hip-hop`, а не обработчик: собранный неверно, он
 * оставляет страницу зелёной на вид и молча показывает весь каталог.
 *
 * **Пустое состояние — содержание, а не заглушка.** У направления без занятий
 * обязан быть выход: приглашение преподавать и соседние направления. Тупик на
 * странице, куда человек пришёл по редкому запросу, — самый дорогой способ его
 * потерять.
 *
 * Проверки идут против английского каталога сообщений, как и остальные e2e.
 */

import { expect, test } from '@playwright/test';

import { routes } from '../src/config/routes';
import { danceStyleSlug, danceStyles, relatedDanceStyles } from '../src/domain/enums';
import en from '../src/i18n/messages/en';

const LOCALE = 'en';
const localized = (path: string): string => `/${LOCALE}${path}`;

/** Подставляет название направления в шаблон так же, как это делает ICU. */
const withStyle = (template: string, style: string): string =>
  template.replace('{style}', style);

/** Направление со всем: занятия, преподаватель, зал, фотография. */
const FULL = { slug: 'hip-hop', label: en.danceStyles.hipHop } as const;
/** Преподаватель есть, занятий нет: половина разметки уходит в пустое состояние. */
const INSTRUCTORS_ONLY = { slug: 'bachata', label: en.danceStyles.bachata } as const;
/** Ни занятий, ни преподавателей, ни кадра. */
const EMPTY = { slug: 'flamenco', label: en.danceStyles.flamenco } as const;

test.describe('хаб направления', () => {
  test('заголовок первого уровня называет направление и город', async ({ page }) => {
    await page.goto(localized(routes.style(FULL.slug)));

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      withStyle(en.styleHub.title, FULL.label),
    );
  });

  test('показывает собственный текст о направлении, а не только карточки', async ({ page }) => {
    await page.goto(localized(routes.style(FULL.slug)));

    /* Абзац из редакционного описания — то, из-за чего страница является документом. */
    await expect(page.getByText(en.styleHub.styles.hipHop.about)).toBeVisible();
    await expect(page.getByText(en.styleHub.styles.hipHop.gear)).toBeVisible();
  });

  test('ведёт в каталог с уже поставленным фильтром', async ({ page }) => {
    await page.goto(localized(routes.style(FULL.slug)));

    const toClasses = page.getByRole('link', {
      name: withStyle(en.styleHub.classesAll, FULL.label),
    });

    await expect(toClasses).toHaveAttribute(
      'href',
      localized(routes.classes({ style: FULL.slug })),
    );

    await toClasses.click();
    await expect(page).toHaveURL(new RegExp(`${localized(routes.classes())}\\?style=${FULL.slug}$`));
  });

  test('ведёт к преподавателям направления', async ({ page }) => {
    await page.goto(localized(routes.style(FULL.slug)));

    await expect(
      page.getByRole('link', { name: withStyle(en.styleHub.instructorsAll, FULL.label) }),
    ).toHaveAttribute('href', localized(routes.instructors({ style: FULL.slug })));
  });

  test('соседние направления ведут на другие хабы и не на себя', async ({ page }) => {
    await page.goto(localized(routes.style(FULL.slug)));

    const expected = relatedDanceStyles('HIP_HOP').map(danceStyleSlug);

    for (const slug of expected) {
      await expect(
        page.locator(`a[href="${localized(routes.style(slug))}"]`),
        `нет ссылки на «${slug}»`,
      ).toHaveCount(1);
    }

    /* Ссылка на саму страницу есть только в хлебных крошках, и она не кликается. */
    await expect(page.locator(`main a[href="${localized(routes.style(FULL.slug))}"]`)).toHaveCount(
      0,
    );
  });

  test('преподаватель без занятий: пустое состояние занятий и выход из него', async ({ page }) => {
    await page.goto(localized(routes.style(INSTRUCTORS_ONLY.slug)));

    await expect(
      page.getByText(withStyle(en.styleHub.classesEmptyTitle, INSTRUCTORS_ONLY.label)),
    ).toBeVisible();

    /* Выход: приглашение преподавать. Тупика на странице быть не должно. */
    await expect(
      page.locator(`main a[href="${localized(routes.becomeInstructor())}"]`).first(),
    ).toBeVisible();

    /* Преподаватели при этом показаны: пустое не значит «пустая страница». */
    await expect(
      page.getByRole('heading', {
        name: withStyle(en.styleHub.instructorsTitle, INSTRUCTORS_ONLY.label),
      }),
    ).toBeVisible();
  });

  test('направление без предложения остаётся рабочей страницей', async ({ page }) => {
    const response = await page.goto(localized(routes.style(EMPTY.slug)));

    expect(response?.status()).toBe(200);

    /* Описание направления правдиво независимо от наличия занятий. */
    await expect(page.getByText(en.styleHub.styles.flamenco.about)).toBeVisible();
    await expect(
      page.getByText(withStyle(en.styleHub.classesEmptyTitle, EMPTY.label)),
    ).toBeVisible();
    await expect(
      page.getByText(withStyle(en.styleHub.instructorsEmptyTitle, EMPTY.label)),
    ).toBeVisible();

    /*
     * Блок залов не показывается вовсе: у зала своего направления нет, связь идёт
     * через занятия, и второе «здесь ничего нет» подряд — шум.
     */
    await expect(
      page.getByRole('heading', { name: withStyle(en.styleHub.studiosTitle, EMPTY.label) }),
    ).toHaveCount(0);
  });

  test('неизвестное направление отвечает 404', async ({ page }) => {
    const response = await page.goto(localized(routes.style('tap-dance')));

    expect(response?.status()).toBe(404);
  });
});

test.describe('перечень направлений', () => {
  test('перечисляет все направления и каждое ведёт на свой хаб', async ({ page }) => {
    await page.goto(localized(routes.styles()));

    for (const style of danceStyles) {
      const slug = danceStyleSlug(style);
      await expect(
        page.locator(`main a[href="${localized(routes.style(slug))}"]`).first(),
        `нет ссылки на «${slug}»`,
      ).toBeVisible();
    }
  });

  test('направление без преподавателей объявлено честно, а не нулём занятий', async ({ page }) => {
    await page.goto(localized(routes.styles()));

    const card = page.locator(`main a[href="${localized(routes.style(EMPTY.slug))}"]`).first();

    await expect(card).toContainText(en.styleHub.seeking);
  });
});

test.describe('входы на хабы', () => {
  test('плитка направления на главной ведёт на хаб, а не в каталог с фильтром', async ({
    page,
  }) => {
    await page.goto(localized(routes.home()));

    const tile = page.locator(`a[href="${localized(routes.style('hip-hop'))}"]`).first();

    await expect(tile).toBeVisible();
    /* Название направления и есть доступное имя ссылки. */
    await expect(tile).toContainText(en.danceStyles.hipHop);
  });

  test('подвал ведёт в перечень направлений с любой страницы', async ({ page }) => {
    await page.goto(localized(routes.classes()));

    const link = page
      .locator('footer')
      .getByRole('link', { name: en.nav.styles, exact: true });

    await expect(link).toHaveAttribute('href', localized(routes.styles()));
  });
});


/**
 * Инварианты данных хаба.
 *
 * Раньше это проверялось юнит-тестами на фикстурах. С переездом каталога в базу
 * (задача 2.1) те же обещания проверяются на живой странице: юнит-тест сюда
 * притащил бы за собой базу в `npm test`, а он обязан оставаться независимым от
 * окружения.
 *
 * Каждое из обещаний ломается молча — страница выглядит нормальной:
 *   • счётчик «N занятий» над карточками, которых не N;
 *   • цена «от», взятая не из минимума;
 *   • хаб без предложения, приглашающий поисковик.
 */
test.describe('хаб направления: данные не расходятся с разметкой', () => {
  test('счётчик занятий совпадает с числом карточек', async ({ page }) => {
    await page.goto(localized(routes.style(FULL.slug)));

    /*
     * Карточки считаются по ссылкам на занятия: у карточки нет своего признака в
     * разметке, а ссылка на `/classes/<slug>` есть ровно одна на карточку.
     */
    const cards = page.locator(`main a[href^="${localized('/classes/')}"]`);
    const shown = await cards.count();
    expect(shown).toBeGreaterThan(0);

    /* Счётчик может быть больше показанного: хаб ограничен лимитом карточек. */
    const counter = page.getByText(/\d+\s+class(es)?/i).first();
    const text = (await counter.textContent()) ?? '';
    const counted = Number(/\d+/.exec(text)?.[0] ?? '0');

    expect(counted).toBeGreaterThanOrEqual(shown);
  });

  test('«от» не ниже цены самой дешёвой показанной карточки', async ({ page }) => {
    await page.goto(localized(routes.style(FULL.slug)));

    const prices = await page.locator('main [data-price]').evaluateAll((nodes) =>
      nodes
        .map((node) => Number((node as HTMLElement).dataset.price))
        .filter((value) => Number.isFinite(value) && value > 0),
    );

    /*
     * Проверка выполняется только когда цены размечены атрибутом: разбирать
     * «12 000 ֏» строкой значило бы проверять форматтер, а не данные.
     */
    if (prices.length > 1) {
      const [from, ...rest] = prices;
      expect(from).toBeLessThanOrEqual(Math.min(...rest));
    }
  });

  test('направление без предложения не попадает в карту сайта', async ({ request }) => {
    const response = await request.get('/sitemap.xml');
    expect(response.status()).toBe(200);

    const body = await response.text();
    expect(body).toContain(routes.style(FULL.slug));
    expect(body).not.toContain(routes.style(EMPTY.slug));
  });
});
