/**
 * SITEMAP и языковые альтернативы.
 *
 * Две задачи, у которых один источник — карта маршрутов:
 *
 * **1. hreflang.** Забытая альтернатива на одной странице означает потерянную
 * локаль в выдаче для этой страницы. Поэтому набор языков не набирается руками в
 * `generateMetadata`, а строится функцией: страница сообщает путь, остальное
 * достраивается для всех локалей сразу.
 *
 * **2. Карта сайта.** В неё попадают только реализованные маршруты. Соблазн
 * перечислить всё запланированное велик, но URL из карты, отвечающий 404, — это
 * ошибка в Search Console и подорванное доверие к остальной карте. Поэтому список
 * ведётся явно и проверяется тестом: `src/lib/seo/sitemap.test.ts` сверяет его с
 * файлами страниц в `src/app/[locale]`, поэтому карта не может разойтись с
 * реальностью — ни в одну сторону, ни в другую.
 *
 * Относительные адреса нужны метаданным (`Metadata.alternates` разрешает их от
 * `metadataBase`), абсолютные — карте сайта: там относительный путь недопустим.
 * Отсюда две функции вместо одной с флагом.
 */

import type { MetadataRoute } from 'next';

import { absoluteUrl, isEnabled, legalDocuments, routes, seo } from '@/config';
import { localeMeta, locales } from '@/i18n/config';

/** Путь с префиксом локали. Единственное место, где префикс склеивается. */
function localized(locale: string, path: string): string {
  return path === '/' ? `/${locale}` : `/${locale}${path}`;
}

/**
 * Относительные альтернативы для `Metadata.alternates.languages`.
 *
 * Ключ — BCP 47 (`hy-AM`), а не код локали: hreflang читает языковой тег.
 * `x-default` обязателен: он говорит поисковику, какую версию показывать тому,
 * чей язык не совпал ни с одним из наших.
 */
export function localeAlternates(path: string): Record<string, string> {
  return Object.fromEntries([
    ...locales.map((locale) => [localeMeta[locale].bcp47, localized(locale, path)]),
    ['x-default', localized(seo.hreflang.xDefault, path)],
  ]);
}

/** Абсолютные альтернативы — для карты сайта. */
export function hreflangAlternates(path: string): Record<string, string> {
  return Object.fromEntries(
    Object.entries(localeAlternates(path)).map(([key, value]) => [key, absoluteUrl(value)]),
  );
}

/* ─────────────────────────── Состав карты сайта ─────────────────────────── */

type ChangeFrequency = MetadataRoute.Sitemap[number]['changeFrequency'];

interface SitemapSpec {
  /** Путь без префикса локали — из `routes`, не строкой. */
  path: string;
  priority: number;
  changeFrequency: ChangeFrequency;
}

/**
 * Разделы каталога.
 *
 * Магазин и курсы могут быть выключены флагом поставки, и тогда их не должно
 * быть ни в навигации, ни в карте сайта: карта — обещание, что страница
 * существует.
 */
function sectionSpecs(): SitemapSpec[] {
  const { priorities, changeFrequency } = seo.sitemap;

  const specs: SitemapSpec[] = [
    { path: routes.home(), priority: priorities.home, changeFrequency: changeFrequency.home },
    {
      path: routes.discover(),
      priority: priorities.discover,
      changeFrequency: changeFrequency.catalog,
    },
    {
      path: routes.classes(),
      priority: priorities.classes,
      changeFrequency: changeFrequency.catalog,
    },
    {
      path: routes.instructors(),
      priority: priorities.instructors,
      changeFrequency: changeFrequency.catalog,
    },
    {
      path: routes.studios(),
      priority: priorities.studios,
      changeFrequency: changeFrequency.catalog,
    },
  ];

  if (isEnabled('events')) {
    specs.push({
      path: routes.events(),
      priority: priorities.events,
      changeFrequency: changeFrequency.catalog,
    });
  }

  if (isEnabled('shop')) {
    specs.push({
      path: routes.shop(),
      priority: priorities.shop,
      changeFrequency: changeFrequency.catalog,
    });
  }

  return specs;
}

/**
 * Страницы сущностей.
 *
 * Слаги приходят аргументом, а не читаются здесь: этот модуль обязан оставаться
 * без обращений к данным, иначе его нельзя проверить тестом без БД, а карта
 * сайта — единственное место, где ошибка видна только через месяц.
 */
export interface EntitySlugs {
  classes: readonly string[];
  instructors: readonly string[];
  venues: readonly string[];
  events: readonly string[];
  /**
   * Хабы направлений, у которых есть предложение.
   *
   * Не все восемнадцать: страница существует у каждого направления, но
   * приглашать поисковик на «уроки фламенко в Ереване», которых никто не ведёт,
   * значит обещать несуществующее. Отбор делает контент-слой
   * (`getStyleHubSlugs`), здесь — только состав карты.
   */
  styles: readonly string[];
}

function entitySpecs(slugs: EntitySlugs): SitemapSpec[] {
  const { priorities, changeFrequency } = seo.sitemap;
  const entity = changeFrequency.entity;

  return [
    ...slugs.classes.map((slug) => ({
      path: routes.class(slug),
      priority: priorities.classes,
      changeFrequency: entity,
    })),
    ...slugs.instructors.map((slug) => ({
      path: routes.instructor(slug),
      priority: priorities.instructors,
      changeFrequency: entity,
    })),
    ...slugs.venues.map((slug) => ({
      path: routes.studio(slug),
      priority: priorities.studios,
      changeFrequency: entity,
    })),
    ...(isEnabled('events')
      ? slugs.events.map((slug) => ({
          path: routes.event(slug),
          priority: priorities.events,
          changeFrequency: entity,
        }))
      : []),
  ];
}

/**
 * Хабы направлений.
 *
 * Приоритет равен приоритету каталога занятий, и это не щедрость: хаб — целевая
 * страница органики («уроки бачаты в Ереване»), то есть вход на сайт, а не
 * промежуточный экран. Частота обновления каталожная: состав занятий по
 * направлению меняется вместе с расписанием.
 */
function styleSpecs(slugs: readonly string[]): SitemapSpec[] {
  const { priorities, changeFrequency } = seo.sitemap;

  return [
    {
      path: routes.styles(),
      priority: priorities.classes,
      changeFrequency: changeFrequency.catalog,
    },
    ...slugs.map((slug) => ({
      path: routes.style(slug),
      priority: priorities.classes,
      changeFrequency: changeFrequency.catalog,
    })),
  ];
}

/**
 * Контентные страницы.
 *
 * Приоритет ниже каталога и выше правовых документов: они приводят трафик по
 * запросам «как стать преподавателем в Ереване», но не являются товаром.
 *
 * `/pricing` появляется только вместе с модулем подписок: страница остаётся
 * доступной по адресу и при выключенном флаге, но приглашать поисковик на
 * «тарифы», которых пока нет, значит обещать несуществующее.
 */
function contentSpecs(): SitemapSpec[] {
  const { priorities, changeFrequency } = seo.sitemap;
  const spec = (path: string): SitemapSpec => ({
    path,
    priority: priorities.content,
    changeFrequency: changeFrequency.content,
  });

  const specs = [
    spec(routes.about()),
    spec(routes.contact()),
    spec(routes.faq()),
    spec(routes.help()),
    spec(routes.becomeInstructor()),
    spec(routes.listYourStudio()),
  ];

  if (isEnabled('subscriptions')) specs.push(spec(routes.pricing()));
  /* Подарочные карты продаются через магазин — вместе с ним они и появляются. */
  if (isEnabled('shop')) specs.push(spec(routes.giftCards()));

  return specs;
}

/**
 * Правовые документы.
 *
 * Состав берётся из `legalDocuments`: подвал, карта сайта и сам маршрут
 * `/legal/[slug]` читают один массив, поэтому документ не может быть в навигации
 * и отсутствовать в карте — или наоборот.
 */
function legalSpecs(): SitemapSpec[] {
  const { priorities, changeFrequency } = seo.sitemap;

  return legalDocuments.map((document) => ({
    path: document.href,
    priority: priorities.legal,
    changeFrequency: changeFrequency.legal,
  }));
}

/** Все пути карты сайта без префикса локали. Основа и для карты, и для теста. */
export function sitemapPaths(slugs: EntitySlugs): readonly string[] {
  return allSpecs(slugs).map((spec) => spec.path);
}

function allSpecs(slugs: EntitySlugs): SitemapSpec[] {
  return [
    ...sectionSpecs(),
    ...entitySpecs(slugs),
    ...styleSpecs(slugs.styles),
    ...contentSpecs(),
    ...legalSpecs(),
  ];
}

/**
 * Записи карты сайта.
 *
 * Одна запись на путь, а не на путь × локаль: у записи есть `alternates`, и
 * дублировать её для каждого языка означало бы сообщить поисковику о трёх
 * страницах вместо одной с тремя версиями. Канонический адрес — версия на языке
 * `x-default`.
 */
export function buildSitemap(slugs: EntitySlugs, lastModified: Date = new Date()): MetadataRoute.Sitemap {
  return allSpecs(slugs).map((spec) => ({
    url: absoluteUrl(localized(seo.hreflang.xDefault, spec.path)),
    lastModified,
    changeFrequency: spec.changeFrequency,
    priority: spec.priority,
    alternates: { languages: hreflangAlternates(spec.path) },
  }));
}
