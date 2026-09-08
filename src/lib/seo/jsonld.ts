/**
 * JSON-LD — структурированные данные для поиска.
 *
 * По одной функции на тип сущности, набор типов объявлен в
 * `seo.structuredData`. Схемы собираются здесь, а не в разметке страниц, по трём
 * причинам:
 *
 * **Разметка не должна врать.** Средний рейтинг попадает в схему только когда
 * отзывов достаточно (`reviews.minCountToDisplayAverage`) — то же правило, что у
 * `RatingStars`. «5,0 по одному отзыву» в выдаче Google живёт месяцами и
 * возвращается к нам жалобой, а не трафиком.
 *
 * **Цена — целые драмы и код валюты из конфигурации.** `priceCurrency` руками в
 * трёх местах — это однажды «AMD» в двух и «USD» в третьем.
 *
 * **Адреса абсолютные.** Относительный `url` в JSON-LD молча игнорируется, и
 * ошибку видно только в валидаторе.
 *
 * Даты события собираются из даты и времени суток в поясе бизнеса: «19:00» в
 * данных — это Ереван, а не UTC сервера.
 */

import { absoluteUrl, currency, mediaUrl, reviews as reviewRules, routes, seo, site } from '@/config';
import { seedMediaPath } from '@/design/seed-media';
import type {
  ClassDetail,
  EventDetail,
  InstructorDetail,
  MediaRef,
  RatingSummary,
  VenueDetail,
} from '@/domain/content';
import { localeMeta, type Locale } from '@/i18n/config';
import { parseClock } from '@/lib/time/clock';
import { fromZonedParts, zonedParts } from '@/lib/time/schedule';

/** Узел структурированных данных. Форма проверяется валидатором, не типами. */
export type JsonLd = Record<string, unknown>;

/**
 * Абсолютный URL картинки по ссылке на медиа или `undefined`.
 *
 * Повторяет разрешение из `Media` (сначала сид-ассет, затем ключ бакета), но
 * возвращает адрес, а не разметку: компоненту нужен `next/image` с preset, схеме
 * — строка. Общей функции у них быть не может, поэтому здесь ровно одна строка
 * логики и ссылка на источник правила.
 *
 * `undefined` вместо заглушки, когда фотографии нет. Раньше здесь стоял
 * `seo.openGraph.defaultImage`, то есть путь к файлу, которого в `public` нет:
 * разметка сообщала поисковику картинку, отвечающую 404. `image` у schema.org —
 * рекомендованное свойство, а не обязательное, и его отсутствие честнее битой
 * ссылки.
 */
function imageUrl(ref: MediaRef): string | undefined {
  const key = ref.key;
  if (!key) return undefined;
  return absoluteUrl(seedMediaPath(key) || mediaUrl(key));
}

/** Свойство `image` схемы или ничего. Разворачивается в объект схемы через `...`. */
function imageProperty(ref: MediaRef): { image?: string } {
  const url = imageUrl(ref);
  return url === undefined ? {} : { image: url };
}

function entityUrl(locale: Locale, path: string): string {
  return absoluteUrl(path === '/' ? `/${locale}` : `/${locale}${path}`);
}

/* ─────────────────────────── Платформа ─────────────────────────── */

export function organizationSchema(locale: Locale, brandName: string): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': seo.structuredData.organization,
    '@id': `${absoluteUrl('/')}#organization`,
    name: brandName,
    legalName: site.legalEntity,
    url: entityUrl(locale, routes.home()),
    /*
     * `logo` не объявлен намеренно. Раньше здесь стоял адрес карточки для
     * соцсетей, во-первых отвечающий 404, во-вторых логотипом не являющийся:
     * Google ждёт саму эмблему (от 112×112, предпочтительно квадратную), а не
     * плакат 1200×630. Растрового логотипа у проекта пока нет — `BrandMark`
     * существует только как inline SVG, — и объявить его нечем. Свойство
     * рекомендованное, а не обязательное; ложный логотип хуже отсутствующего.
     */
    foundingDate: String(site.foundedYear),
    email: site.contact.email,
    address: {
      '@type': 'PostalAddress',
      addressCountry: site.address.country,
      addressLocality: site.address.city,
    },
    sameAs: Object.values(site.social),
  };
}

/**
 * Сайт и поиск по нему.
 *
 * `SearchAction` объявляет поисковикам адрес нашего поиска. Шаблон подставляется
 * в готовый адрес `routes.discover`, а не склеивается строкой: имя параметра
 * запроса живёт в одном месте (`ListingParams.q`), и переименование не должно
 * тихо ломать разметку.
 */
export function websiteSchema(locale: Locale, brandName: string): JsonLd {
  const PLACEHOLDER = 'SEARCH_TERM_STRING';
  const searchTarget = entityUrl(locale, routes.discover({ q: PLACEHOLDER })).replace(
    PLACEHOLDER,
    '{search_term_string}',
  );

  return {
    '@context': 'https://schema.org',
    '@type': seo.structuredData.website,
    '@id': `${absoluteUrl('/')}#website`,
    name: brandName,
    url: entityUrl(locale, routes.home()),
    inLanguage: localeMeta[locale].bcp47,
    publisher: { '@id': `${absoluteUrl('/')}#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: searchTarget },
      'query-input': 'required name=search_term_string',
    },
  };
}

/* ─────────────────────────── Навигация ─────────────────────────── */

export interface Crumb {
  name: string;
  /** Путь без префикса локали. Последняя крошка — текущая страница. */
  path: string;
}

export function breadcrumbSchema(locale: Locale, trail: readonly Crumb[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': seo.structuredData.breadcrumb,
    itemListElement: trail.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: entityUrl(locale, crumb.path),
    })),
  };
}

/* ─────────────────────────── Вопросы и ответы ─────────────────────────── */

export interface FaqEntry {
  question: string;
  answer: string;
}

/**
 * Страница вопросов и ответов.
 *
 * Разметка обязана повторять то, что видно на экране: Google сверяет `FAQPage` с
 * содержимым страницы и снимает расширенный сниппет целиком, если найдёт вопрос,
 * которого на странице нет. Поэтому схема собирается из того же массива, что и
 * сам список, а не из отдельного «SEO-текста».
 *
 * Ответы — обычный текст, а не разметка: `acceptedAnswer.text` допускает
 * ограниченный HTML, но любая ссылка внутри увеличивает шанс, что сниппет не
 * появится вовсе.
 */
export function faqSchema(entries: readonly FaqEntry[]): JsonLd | null {
  /* Пустая схема хуже отсутствующей: она сообщает о странице, которой нет. */
  if (entries.length === 0) return null;

  return {
    '@context': 'https://schema.org',
    '@type': seo.structuredData.faq,
    mainEntity: entries.map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: { '@type': 'Answer', text: entry.answer },
    })),
  };
}

/* ─────────────────────────── Рейтинг ─────────────────────────── */

/**
 * Агрегированный рейтинг или `null`.
 *
 * `null` ниже порога — не перестраховка: разметка с «5,0 по одному отзыву»
 * приносит звёзды в выдачу на пустом основании, а снять их потом нельзя.
 */
export function aggregateRatingSchema(stats: RatingSummary): JsonLd | null {
  if (stats.count < reviewRules.minCountToDisplayAverage) return null;

  return {
    '@type': 'AggregateRating',
    ratingValue: stats.average,
    reviewCount: stats.count,
    bestRating: reviewRules.maxRating,
    worstRating: reviewRules.minRating,
  };
}

/** Предложение с ценой. Цена — целые драмы, код валюты из конфигурации. */
function offerSchema(price: number, url: string, available: boolean): JsonLd {
  return {
    '@type': 'Offer',
    price,
    priceCurrency: currency.code,
    url,
    availability: available
      ? 'https://schema.org/InStock'
      : 'https://schema.org/SoldOut',
  };
}

/* ─────────────────────────── Сущности ─────────────────────────── */

export function courseSchema(locale: Locale, item: ClassDetail, styleLabel: string): JsonLd {
  const url = entityUrl(locale, routes.class(item.slug));
  const rating = aggregateRatingSchema(item.rating);

  return {
    '@context': 'https://schema.org',
    '@type': seo.structuredData.danceClass,
    name: item.title,
    description: item.description,
    url,
    ...imageProperty(item.image),
    inLanguage: localeMeta[locale].bcp47,
    about: styleLabel,
    provider: { '@id': `${absoluteUrl('/')}#organization` },
    offers: offerSchema(item.price, url, item.spotsLeft > 0),
    hasCourseInstance: {
      '@type': 'CourseInstance',
      /** Занятие проходит в зале, а не онлайн: это очный формат. */
      courseMode: 'onsite',
      courseWorkload: `PT${item.durationMinutes}M`,
      location: {
        '@type': 'Place',
        name: item.venueName,
        address: {
          '@type': 'PostalAddress',
          addressCountry: site.address.country,
          addressLocality: site.address.city,
          addressRegion: item.venueDistrict,
        },
      },
      instructor: {
        '@type': 'Person',
        name: item.instructorName,
        url: entityUrl(locale, routes.instructor(item.instructorSlug)),
      },
    },
    ...(rating ? { aggregateRating: rating } : {}),
  };
}

export function personSchema(locale: Locale, item: InstructorDetail): JsonLd {
  const rating = aggregateRatingSchema(item.rating);

  return {
    '@context': 'https://schema.org',
    '@type': seo.structuredData.instructor,
    name: item.name,
    description: item.bio,
    url: entityUrl(locale, routes.instructor(item.slug)),
    ...imageProperty(item.image),
    jobTitle: item.headline,
    knowsAbout: [...item.specializations],
    worksFor: { '@id': `${absoluteUrl('/')}#organization` },
    ...(rating ? { aggregateRating: rating } : {}),
  };
}

export function localBusinessSchema(
  locale: Locale,
  item: VenueDetail,
  amenityLabels: readonly string[],
): JsonLd {
  const rating = aggregateRatingSchema(item.rating);

  return {
    '@context': 'https://schema.org',
    '@type': seo.structuredData.studio,
    name: item.name,
    description: item.description,
    url: entityUrl(locale, routes.studio(item.slug)),
    ...imageProperty(item.image),
    address: {
      '@type': 'PostalAddress',
      addressCountry: site.address.country,
      addressLocality: site.address.city,
      addressRegion: item.district,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: item.latitude,
      longitude: item.longitude,
    },
    /*
     * `priceRange` у schema.org — свободная строка, но собирать её из символов
     * («$$») незачем: у нас есть точная ставка, и она понятнее.
     */
    priceRange: `${item.pricePerHour} ${currency.code}`,
    maximumAttendeeCapacity: item.capacity,
    amenityFeature: amenityLabels.map((label) => ({
      '@type': 'LocationFeatureSpecification',
      name: label,
      value: true,
    })),
    ...(rating ? { aggregateRating: rating } : {}),
  };
}

/**
 * Момент начала и конца события.
 *
 * В данных лежат дата и время суток по Ереваду; ISO-строка собирается через
 * пояс бизнеса, а не через часовой пояс сервера — на Vercel он UTC, и наивная
 * склейка сдвинула бы начало на четыре часа.
 */
function eventInstant(day: Date, clock: string): string {
  const parts = zonedParts(day);
  return fromZonedParts({
    year: parts.year,
    month: parts.month,
    day: parts.day,
    minutesOfDay: parseClock(clock),
  }).toISOString();
}

export function eventSchema(locale: Locale, item: EventDetail): JsonLd {
  const url = entityUrl(locale, routes.event(item.slug));

  return {
    '@context': 'https://schema.org',
    '@type': seo.structuredData.event,
    name: item.title,
    description: item.description,
    url,
    ...imageProperty(item.image),
    startDate: eventInstant(item.startsAt, item.startTime),
    endDate: eventInstant(item.startsAt, item.endTime),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    inLanguage: localeMeta[locale].bcp47,
    organizer: { '@id': `${absoluteUrl('/')}#organization` },
    location: {
      '@type': 'Place',
      name: item.locationName,
      address: {
        '@type': 'PostalAddress',
        addressCountry: site.address.country,
        addressLocality: site.address.city,
        ...(item.venueDistrict === undefined ? {} : { addressRegion: item.venueDistrict }),
      },
      ...(item.latitude === undefined || item.longitude === undefined
        ? {}
        : {
            geo: {
              '@type': 'GeoCoordinates',
              latitude: item.latitude,
              longitude: item.longitude,
            },
          }),
    },
    maximumAttendeeCapacity: item.capacity,
    remainingAttendeeCapacity: item.spotsLeft,
    /*
     * Бесплатный вход — это цена ноль, а не отсутствие предложения: без `offers`
     * событие в выдаче выглядит как то, на что нельзя попасть.
     */
    offers: offerSchema(item.price, url, item.spotsLeft > 0),
  };
}
