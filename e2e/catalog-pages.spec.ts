/**
 * Страницы каталога открываются и фильтруются.
 *
 * Проверка появилась после дефекта, который прошёл мимо всех остальных ворот.
 * Листинги читают `searchParams`, поэтому они динамические: `next build` их не
 * отрисовывает, `tsc` не видит границу сервер/клиент, а ESLint — тем более. Экран
 * падал только в браузере, на запросе, с «Functions cannot be passed directly to
 * Client Components»: страница передавала в клиентский компонент фильтров
 * функцию `buildHref`.
 *
 * Отсюда два уровня проверки:
 *
 * 1. **Каждый раздел отвечает 200 и не пишет ошибок в консоль.** Дешёвый дымовой
 *    тест, который ловит любой отказ рендера, а не только этот.
 * 2. **Фильтр и сортировка действительно ведут по адресу.** Состояние каталога
 *    живёт в URL; если ссылка чипа собирается неверно, страница остаётся зелёной
 *    на вид, но фильтр не работает.
 *
 * На узком экране фильтры уходят в шторку — тест открывает её, а не пропускает
 * проверку: «на мобильном фильтров нет» это и есть дефект прототипа, от которого
 * мы ушли.
 */

import { expect, test, type Locator, type Page } from '@playwright/test';

import { demoClasses, demoEvents, demoInstructors, demoVenues } from '../prisma/fixtures/demo';
import { limits } from '../src/config/business';
import { routes } from '../src/config/routes';
import { raw } from '../src/design/tokens';
import en from '../src/i18n/messages/en';

/** Проверки сравниваются с английским каталогом сообщений, как и остальные e2e. */
const LOCALE = 'en';

const localized = (path: string): string => `/${LOCALE}${path}`;

/** Разделы каталога плюс детальные страницы, которые уже существуют. */
const paths = [
  routes.discover(),
  routes.classes(),
  routes.instructors(),
  routes.studios(),
  routes.events(),
  routes.shop(),
  /* С фильтром и сортировкой: разбор параметров — половина кода листинга. */
  routes.classes({ style: 'hip-hop', sort: 'price' }),
  routes.instructors({ verified: true, sort: 'rating' }),
  /* Заведомо мусорные значения: страница обязана открыться, а не упасть. */
  routes.classes({ style: 'no-such-style', page: 999 }),
  routes.class(demoClasses[0]!.slug),
  routes.instructor(demoInstructors[0]!.slug),
  routes.studio(demoVenues[0]!.slug),
  routes.event(demoEvents[0]!.slug),
  /* Событие без площадки каталога: место остаётся текстом, а не ссылкой. */
  routes.event(demoEvents.find((item) => item.venueSlug === undefined)!.slug),
  /*
   * Хабы направлений в трёх состояниях наполнения. Все три — рабочие страницы, и
   * различие между ними в том, чего на них нет: у бачаты преподаватель без
   * занятий, у фламенко нет ни занятий, ни преподавателя, ни фотографии. Каждое
   * отсутствие — отдельная ветка разметки, и падает она молча.
   */
  routes.styles(),
  routes.style('hip-hop'),
  routes.style('bachata'),
  routes.style('flamenco'),
].map(localized);

/**
 * Типы ресурсов, отсутствие которых — дефект именно этой страницы.
 *
 * Переходы и префетчи сюда не входят намеренно. В шапке есть ссылки на кабинет,
 * а кабинет требует входа: Next заранее подтягивает `/sign-in`, которого пока нет
 * (аутентификация — отдельная задача плана). Считать это поломкой каталога
 * значило бы держать список «ещё не построенного» внутри теста и однажды забыть
 * его вычистить. Ссылки на несуществующие страницы — предмет отдельной проверки,
 * и она имеет смысл, когда строить уже нечего.
 */
const OWN_RESOURCES = new Set(['image', 'stylesheet', 'script', 'font', 'media']);

/** Сообщение консоли о неудачном ресурсе: адрес всё равно точнее в `response`. */
const RESOURCE_FAILURE = 'Failed to load resource';

for (const path of paths) {
  test(`${path} открывается без ошибок`, async ({ page }) => {
    const problems: string[] = [];

    /* Любое необработанное исключение на странице — отказ, без списка маркеров. */
    page.on('pageerror', (error) => problems.push(String(error)));
    page.on('console', (message) => {
      if (message.type() === 'error' && !message.text().includes(RESOURCE_FAILURE)) {
        problems.push(message.text());
      }
    });
    /*
     * Адрес не отдавшегося ресурса, а не «Failed to load resource»: без URL
     * сообщение сообщает только о факте поломки, но не о том, что искать.
     */
    page.on('response', (response) => {
      if (response.status() >= 400 && OWN_RESOURCES.has(response.request().resourceType())) {
        problems.push(`${response.status()} ${response.url()}`);
      }
    });

    const response = await page.goto(path);

    expect(response?.status(), `HTTP-код ${path}`).toBe(200);
    await expect(page.locator('main')).toBeVisible();
    expect(problems, `ошибки на ${path}:\n${problems.join('\n')}`).toEqual([]);
  });
}

/**
 * Группа фильтров: на широком экране она в строке, на узком — в шторке.
 *
 * `fieldset` с `legend` — это роль `group` с доступным именем, поэтому искать
 * её можно по подписи, а не по классу.
 */
async function styleFilterGroup(page: Page): Promise<Locator> {
  const wide = (page.viewportSize()?.width ?? 0) >= raw.breakpoint.lg;
  if (wide) return page.getByRole('group', { name: en.common.labels.style });

  const sheet = page.getByRole('dialog');

  if (!(await sheet.isVisible())) {
    const trigger = page.getByRole('button', { name: en.catalog.filters.openCta });
    await expect(trigger).toBeVisible();
    /*
     * `force` — не «чтобы тест позеленел». Шторка выезжает с анимацией, и
     * повторная попытка Playwright после проверки попадания приходится уже на
     * затемнение; ещё через триста миллисекунд на том же месте стоит первый чип,
     * и «открыть фильтры» превращается в «выбрать направление». Кнопка уже
     * проверена как видимая, поэтому отключается именно повтор, а не проверка
     * доступности элемента.
     */
    await trigger.click({ force: true });
    await expect(sheet).toBeVisible();
  }

  return sheet.getByRole('group', { name: en.common.labels.style });
}

test('чип фильтра переносит выбор в адрес страницы', async ({ page }) => {
  await page.goto(localized(routes.classes()));

  const group = await styleFilterGroup(page);
  /* Первая ссылка — «все направления», она снимает фильтр; берём вторую. */
  const chip = group.getByRole('link').nth(1);
  await expect(chip).toBeVisible();
  await chip.click();

  await expect(page).toHaveURL(/[?&]style=/);
  /* Выбранный чип обязан объявляться текущим, а не только краситься. */
  const applied = await styleFilterGroup(page);
  await expect(applied.locator('[aria-current="page"]')).toHaveCount(1);
});

test('сброс фильтров возвращает на чистый адрес раздела', async ({ page }) => {
  await page.goto(localized(routes.classes({ style: 'hip-hop' })));

  await page.getByRole('link', { name: en.catalog.filters.reset }).first().click();

  await expect(page).toHaveURL(new RegExp(`${localized(routes.classes())}$`));
});

test('сортировка меняет порядок ссылкой, а не обработчиком', async ({ page }) => {
  await page.goto(localized(routes.classes()));

  await page.getByRole('button', { name: new RegExp(en.catalog.sort.label) }).click();

  const option = page.getByRole('menuitem', { name: en.catalog.sort.priceAsc });
  await expect(option).toBeVisible();
  /*
   * Пункт меню и есть ссылка (`asChild`), поэтому адрес проверяется на нём же:
   * порядок результатов — часть адреса страницы, а не состояние в памяти.
   */
  await expect(option).toHaveAttribute('href', /[?&]sort=/);
});


/**
 * Тупик «мест нет» обязан заканчиваться предложением (C-02).
 *
 * Проверяется именно на заполненной группе и именно через сеть: страница занятия
 * статическая, а времена приходят из `/api/availability`. Если бы доступность
 * вшили в HTML, тест прошёл бы и на замороженных данных — поэтому проверяется,
 * что запрос действительно уходит и что ссылки ведут к бронированию.
 */
test.describe('Заполненная группа предлагает альтернативы', () => {
  const soldOut = demoClasses.find((item) => item.spotsLeft <= 0);

  test('ближайшие свободные времена приходят запросом и ведут на бронирование', async ({
    page,
  }) => {
    test.skip(!soldOut, 'в демо-данных нет заполненной группы');

    const availabilityCalls: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/availability')) availabilityCalls.push(request.url());
    });

    await page.goto(localized(routes.class(soldOut!.slug)));

    /* Заголовок появляется только после ответа: до него на месте блока скелет. */
    await expect(
      page.getByRole('heading', { level: 3, name: en.booking.alternativesTitle }),
    ).toBeVisible();

    expect(availabilityCalls.length, 'доступность обязана запрашиваться, а не быть в HTML')
      .toBeGreaterThan(0);

    const bookingHref = localized(routes.instructorBooking(soldOut!.instructorSlug));
    /*
     * Ссылки считаются внутри самого блока: на странице есть ещё кнопка записи и
     * закреплённая панель, и они ведут туда же.
     */
    const section = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { level: 3, name: en.booking.alternativesTitle }) });
    const offers = section.locator(`a[href="${bookingHref}"]`);

    /* Предложений не больше предела из бизнес-правил, и каждое ведёт к брони. */
    await expect(offers.first()).toBeVisible();
    expect(await offers.count()).toBeLessThanOrEqual(limits.alternativeSlots);
  });

  test('свободная группа альтернативы не показывает: они дублировали бы календарь', async ({
    page,
  }) => {
    const available = demoClasses.find((item) => item.spotsLeft > 0);
    test.skip(!available, 'в демо-данных нет свободной группы');

    await page.goto(localized(routes.class(available!.slug)));

    await expect(
      page.getByRole('heading', { level: 3, name: en.booking.alternativesTitle }),
    ).toHaveCount(0);
  });
});
